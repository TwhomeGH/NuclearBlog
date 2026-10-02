#!/usr/bin/env node
/**
 * 本地 Astro Dev 控制台。
 *
 * 啟動後提供一個只綁定 127.0.0.1 的小網頁，用來查看／操作背景的 `astro dev`
 * daemon（狀態、啟動、停止、重啟、日誌），省去每次在終端手動下指令。
 *
 *   node scripts/dev-panel.mjs        # 或 pnpm dev:panel
 *
 * 狀態與日誌直接讀 Astro 的 `.astro/dev.json` 與 `.astro/dev.log`，不再每次
 * spawn `astro dev status/logs`（那會每次重新載入完整 config，約 5 秒）。
 *
 * 環境變數：
 *   PANEL_PORT=4323   面板起始埠號（被占用時自動往上找）
 *   PANEL_NO_OPEN=1   不要自動開瀏覽器
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASTRO_BIN = path.join(root, "node_modules", "astro", "bin", "astro.mjs");
const LOCK_FILE = path.join(root, ".astro", "dev.json");
const LOG_FILE = path.join(root, ".astro", "dev.log");
const HOST = "127.0.0.1";
const PORT = Number(process.env.PANEL_PORT || 4323);

// 去除 CLI 輸出的 ANSI 控制碼（刻意使用 \u001b）。
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 讀取 Astro dev 狀態（讀 lock 檔，毫秒級）
// ---------------------------------------------------------------------------

function isAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function readLock() {
	try {
		const data = JSON.parse(fs.readFileSync(LOCK_FILE, "utf-8"));
		if (typeof data?.pid !== "number") return null;
		return data;
	} catch {
		return null;
	}
}

function getStatus() {
	const lock = readLock();
	if (lock && isAlive(lock.pid)) {
		return {
			running: true,
			pid: lock.pid,
			url: lock.url,
			background: !!lock.background,
			startedAt: lock.startedAt,
		};
	}
	return { running: false };
}

// CLI 會輸出 JSON 行（{"message":...}），轉成可讀純文字。
function formatOutput(text) {
	const clean = text.replace(ANSI_PATTERN, "").replace(/\r\n/g, "\n").trim();
	const messages = [];
	for (const line of clean.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
			try {
				const parsed = JSON.parse(trimmed);
				if (parsed.message) {
					messages.push(parsed.message);
					continue;
				}
			} catch {
				// 不是 JSON，照原樣保留
			}
		}
		if (trimmed) messages.push(line);
	}
	return messages.join("\n");
}

// 讀 log 檔尾端（不用 spawn CLI）。
const MAX_LOG_BYTES = 96 * 1024;
function getLogs() {
	try {
		const stat = fs.statSync(LOG_FILE);
		const start = Math.max(0, stat.size - MAX_LOG_BYTES);
		const length = stat.size - start;
		const buffer = Buffer.alloc(length);
		const fd = fs.openSync(LOG_FILE, "r");
		try {
			fs.readSync(fd, buffer, 0, length, start);
		} finally {
			fs.closeSync(fd);
		}
		return { size: stat.size, text: formatOutput(buffer.toString("utf-8")) };
	} catch {
		return { size: 0, text: "" };
	}
}

// ---------------------------------------------------------------------------
// 執行 astro CLI（僅啟停需要；逾時一定返回，避免請求卡死）
// ---------------------------------------------------------------------------

function killTree(pid) {
	try {
		if (process.platform === "win32") {
			spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
		} else {
			process.kill(pid, "SIGKILL");
		}
	} catch {
		// 已經結束就算了
	}
}

function runAstro(args, timeout = 90000) {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [ASTRO_BIN, ...args], {
			cwd: root,
			env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
		});
		let out = "";
		let err = "";
		let settled = false;
		let timedOut = false;
		const finish = (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve({ code, out, err, timedOut });
		};
		const timer = setTimeout(() => {
			timedOut = true;
			killTree(child.pid);
			// 不等 close：即使子行程沒乖乖結束也要讓請求返回
			setTimeout(() => finish(-1), 1500);
		}, timeout);
		child.stdout.on("data", (d) => (out += d.toString()));
		child.stderr.on("data", (d) => (err += d.toString()));
		child.on("error", () => finish(-1));
		child.on("close", (code) => finish(code));
	});
}

// 直接終止 daemon（等同 astro dev stop，但不用等 5 秒的 CLI 啟動）。
async function killServer() {
	const lock = readLock();
	if (lock && isAlive(lock.pid)) {
		try {
			process.kill(lock.pid, "SIGTERM");
		} catch {
			// 忽略
		}
		const deadline = Date.now() + 5000;
		while (Date.now() < deadline && isAlive(lock.pid)) await sleep(100);
		if (isAlive(lock.pid)) {
			try {
				process.kill(lock.pid, "SIGKILL");
			} catch {
				// 忽略
			}
		}
	}
	try {
		fs.unlinkSync(LOCK_FILE);
	} catch {
		// 沒有就算了
	}
	return getStatus();
}

async function startServer({ force = false } = {}) {
	if (getStatus().running) await killServer();
	const args = ["dev"];
	if (force) args.push("--force");
	args.push("--background", "--host", "0.0.0.0");
	const result = await runAstro(args, 120000);

	// 等 lock 出現且 pid 存活（CLI 就緒、daemonize 後會寫入 lock）。
	const deadline = Date.now() + 20000;
	while (Date.now() < deadline) {
		const status = getStatus();
		if (status.running) {
			return {
				ok: true,
				output: formatOutput(result.out + result.err),
				status,
			};
		}
		await sleep(300);
	}
	return {
		ok: false,
		output: formatOutput(result.out + result.err),
		status: getStatus(),
	};
}

async function stopServer() {
	const before = getStatus();
	if (!before.running) {
		return { ok: true, output: "目前沒有執行中的 dev server。", status: before };
	}
	const status = await killServer();
	return { ok: true, output: `已停止 dev server（pid ${before.pid}）。`, status };
}

// 序列化啟停操作，避免面板輪詢與按鈕同時觸發造成競態。
let queue = Promise.resolve();
function exclusive(fn) {
	const next = queue.then(fn, fn);
	queue = next.catch(() => {});
	return next;
}

// ---------------------------------------------------------------------------
// HTTP 介面
// ---------------------------------------------------------------------------

const PAGE = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Astro Dev 控制台</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-family: ui-sans-serif, system-ui, "Segoe UI", "Noto Sans TC", sans-serif; background: #0f1115; color: #e6e6e6; }
  h1 { font-size: 18px; margin: 0 0 16px; font-weight: 600; }
  header { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
  .status { padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; }
  .status.on { background: #10361f; color: #4ade80; }
  .status.off { background: #3a1414; color: #f87171; }
  .status.busy { background: #3a2f12; color: #fbbf24; }
  .status a { color: inherit; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  button, a.button { font: inherit; font-size: 13px; padding: 8px 14px; border-radius: 8px; border: 1px solid #2a2f3a; background: #1a1f29; color: #e6e6e6; cursor: pointer; text-decoration: none; }
  button:hover, a.button:hover { background: #232936; }
  button.danger { border-color: #5b1d1d; color: #fca5a5; }
  button.primary { border-color: #1e4d33; background: #10361f; color: #86efac; }
  button:disabled, a.button[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
  .spinner { display: inline-block; width: 11px; height: 11px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: -1px; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  pre { margin: 0; padding: 16px; background: #0a0c10; border: 1px solid #232936; border-radius: 10px; height: 60vh; overflow: auto; font-family: ui-monospace, Menlo, Consolas, "JetBrains Mono", monospace; font-size: 12.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .hint { font-size: 12px; color: #8b93a1; margin-top: 10px; }
</style>
</head>
<body>
  <header>
    <h1>Astro Dev 控制台</h1>
    <div id="status" class="status off" aria-live="polite">載入中…</div>
    <a id="openLink" class="button" href="#" target="_blank" rel="noopener" hidden>開啟網站 ↗</a>
  </header>
  <div class="actions">
    <button id="start" class="primary">啟動</button>
    <button id="restart">重啟</button>
    <button id="restartForce">清快取重啟</button>
    <button id="stop" class="danger">停止</button>
    <button id="refresh">重新整理</button>
  </div>
  <pre id="logs">載入日誌中…</pre>
  <p class="hint">此面板只綁定 127.0.0.1。關閉面板（Ctrl+C）不會停止 dev server。</p>
<script>
  var $ = function (id) { return document.getElementById(id); };
  function api(path, opts) { return fetch(path, opts).then(function (r) { return r.json(); }); }

  var ACTION_IDS = ["start", "restart", "restartForce", "stop", "refresh"];
  var busy = false;
  var busyTimer = null;
  var busyStart = 0;

  function setEnabled(on) {
    ACTION_IDS.forEach(function (id) { $(id).disabled = !on; });
  }
  // 操作進行中：禁用按鈕、狀態列顯示轉圈與累計秒數，避免誤以為沒反應而重複點擊。
  function beginBusy(label) {
    busy = true;
    setEnabled(false);
    var el = $("status");
    el.className = "status busy";
    el.innerHTML = '<span class="spinner"></span>' + label + '… <span id="elapsed">0</span>s';
    busyStart = Date.now();
    clearInterval(busyTimer);
    busyTimer = setInterval(function () {
      var e = $("elapsed");
      if (e) e.textContent = Math.floor((Date.now() - busyStart) / 1000);
    }, 250);
  }
  function endBusy() {
    busy = false;
    clearInterval(busyTimer);
    setEnabled(true);
  }
  function renderStatus(s) {
    var el = $("status");
    var link = $("openLink");
    if (s && s.running) {
      el.className = "status on";
      el.textContent = "執行中 · pid " + s.pid + " · " + s.url;
      link.href = s.url;
      link.hidden = false;
    } else {
      el.className = "status off";
      el.textContent = "已停止";
      link.hidden = true;
    }
  }
  function refreshStatus(statusOverride) {
    if (statusOverride) { renderStatus(statusOverride); return Promise.resolve(); }
    if (busy) return Promise.resolve();
    return api("/api/status").then(renderStatus).catch(function () {});
  }
  function refreshLogs() {
    return api("/api/logs").then(function (d) { $("logs").textContent = d.text || "(尚無日誌)"; }).catch(function () {});
  }
  function act(path, label) {
    if (busy) return;
    beginBusy(label);
    api(path, { method: "POST" })
      .then(function (res) { renderStatus(res && res.status); })
      .catch(function () { var el = $("status"); el.className = "status off"; el.textContent = "操作失敗"; })
      .then(function () { endBusy(); return refreshLogs(); });
  }
  $("start").onclick = function () { act("/api/start", "啟動中"); };
  $("stop").onclick = function () { act("/api/stop", "停止中"); };
  $("restart").onclick = function () { act("/api/restart", "重啟中"); };
  $("restartForce").onclick = function () { act("/api/restart?force=1", "清快取重啟中"); };
  $("refresh").onclick = function () { if (busy) return; refreshStatus(); refreshLogs(); };
  refreshStatus();
  refreshLogs();
  setInterval(function () { if (!busy) refreshStatus(); }, 3000);
  setInterval(function () { if (!busy) refreshLogs(); }, 3000);
</script>
</body>
</html>`;

function sendJson(res, data, code = 200) {
	const body = JSON.stringify(data);
	res.writeHead(code, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
	});
	res.end(body);
}

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url || "/", `http://${HOST}`);
	try {
		if (req.method === "GET" && url.pathname === "/") {
			res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			res.end(PAGE);
			return;
		}
		if (req.method === "GET" && url.pathname === "/api/status") {
			return sendJson(res, getStatus());
		}
		if (req.method === "GET" && url.pathname === "/api/logs") {
			return sendJson(res, getLogs());
		}
		if (req.method === "POST" && url.pathname === "/api/start") {
			const force = url.searchParams.get("force") === "1";
			return sendJson(res, await exclusive(() => startServer({ force })));
		}
		if (req.method === "POST" && url.pathname === "/api/stop") {
			return sendJson(res, await exclusive(stopServer));
		}
		if (req.method === "POST" && url.pathname === "/api/restart") {
			const force = url.searchParams.get("force") === "1";
			return sendJson(
				res,
				await exclusive(async () => {
					await stopServer();
					return startServer({ force });
				}),
			);
		}
		res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
		res.end("Not found");
	} catch (error) {
		sendJson(res, { error: String(error) }, 500);
	}
});

function openBrowser(url) {
	const command =
		process.platform === "win32"
			? `start "" "${url}"`
			: process.platform === "darwin"
				? `open "${url}"`
				: `xdg-open "${url}"`;
	spawn(command, { shell: true, stdio: "ignore", detached: true }).unref();
}

const MAX_PORT_TRIES = 20;
let currentPort = PORT;

server.on("listening", () => {
	const actualPort = server.address().port;
	const url = `http://${HOST}:${actualPort}/`;
	console.log(`\nAstro Dev 控制台：${url}`);
	if (actualPort !== PORT) {
		console.log(`（埠 ${PORT} 已被占用，自動改用 ${actualPort}）`);
	}
	console.log("按 Ctrl+C 關閉面板（不會停止 dev server）。\n");
	if (process.env.PANEL_NO_OPEN !== "1") openBrowser(url);
});

server.on("error", (error) => {
	if (error.code === "EADDRINUSE" && currentPort - PORT < MAX_PORT_TRIES) {
		currentPort += 1;
		console.warn(`面板埠 ${currentPort - 1} 已被占用，改試 ${currentPort}…`);
		server.listen(currentPort, HOST);
		return;
	}
	console.error(error);
	process.exit(1);
});

server.listen(currentPort, HOST);
