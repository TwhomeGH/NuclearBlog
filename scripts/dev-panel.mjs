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
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pidusage from "pidusage";
import { listMediaAssets } from "../src/plugins/video-assets.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASTRO_BIN = path.join(root, "node_modules", "astro", "bin", "astro.mjs");
const LOCK_FILE = path.join(root, ".astro", "dev.json");
const LOG_FILE = path.join(root, ".astro", "dev.log");
const HOST = "127.0.0.1";
const PORT = Number(process.env.PANEL_PORT || 4323);
const PANEL_LOCK = path.join(root, ".astro", "dev-panel.json");

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

// 記下自己的 pid，啟動時接手舊面板，避免殘留多個面板（幽靈）。
function killPreviousPanel() {
	try {
		const data = JSON.parse(fs.readFileSync(PANEL_LOCK, "utf-8"));
		if (data && data.pid && data.pid !== process.pid && isAlive(data.pid)) {
			try {
				process.kill(data.pid, "SIGTERM");
			} catch {
				// 忽略
			}
		}
	} catch {
		// 沒有舊面板
	}
}

function writePanelLock(port) {
	try {
		fs.mkdirSync(path.dirname(PANEL_LOCK), { recursive: true });
		fs.writeFileSync(
			PANEL_LOCK,
			JSON.stringify({ pid: process.pid, port }),
		);
	} catch {
		// 寫不進去就算了
	}
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
// 效能取樣（CPU / 記憶體 / 響應延遲）
// ---------------------------------------------------------------------------

const LATENCY_HISTORY = 60;
const metrics = {
	time: 0,
	system: {
		totalMem: os.totalmem(),
		freeMem: os.freemem(),
		cpuCount: os.cpus().length,
	},
	panel: { cpu: 0, memRss: 0 },
	dev: { running: false, pid: 0, cpu: 0, memRss: 0, uptimeSec: 0 },
	latency: { last: null, min: null, max: null, avg: null, bytes: 0, samples: [] },
};

let lastSelfCpu = process.cpuUsage();
let lastSelfAt = Date.now();

async function sampleMetrics() {
	const now = Date.now();
	const elapsedMs = now - lastSelfAt || 1;

	const selfCpu = process.cpuUsage(lastSelfCpu);
	lastSelfCpu = process.cpuUsage();
	lastSelfAt = now;
	metrics.panel.cpu = ((selfCpu.user + selfCpu.system) / 1000 / elapsedMs) * 100;
	metrics.panel.memRss = process.memoryUsage().rss;

	metrics.system = {
		totalMem: os.totalmem(),
		freeMem: os.freemem(),
		cpuCount: os.cpus().length,
	};

	const status = getStatus();
	metrics.dev.running = status.running;
	if (status.running) {
		metrics.dev.pid = status.pid;
		metrics.dev.uptimeSec = status.startedAt
			? Math.max(0, Math.round((now - Date.parse(status.startedAt)) / 1000))
			: 0;
		try {
			const usage = await pidusage(status.pid);
			metrics.dev.cpu = usage.cpu;
			metrics.dev.memRss = usage.memory;
		} catch {
			metrics.dev.cpu = 0;
			metrics.dev.memRss = 0;
		}
	} else {
		metrics.dev.pid = 0;
		metrics.dev.cpu = 0;
		metrics.dev.memRss = 0;
		metrics.dev.uptimeSec = 0;
	}

	metrics.time = Date.now();
}

async function sampleLatency() {
	const status = getStatus();
	if (!status.running || !status.url) return;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 5000);
	const t0 = performance.now();
	try {
		const response = await fetch(status.url, {
			signal: controller.signal,
			headers: { "cache-control": "no-cache" },
		});
		const body = await response.arrayBuffer();
		metrics.latency.bytes = body.byteLength;
	} catch {
		// 逾時或錯誤仍計入延遲
	} finally {
		clearTimeout(timer);
	}
	const ms = Math.round(performance.now() - t0);
	const lat = metrics.latency;
	lat.last = ms;
	lat.samples.push(ms);
	if (lat.samples.length > LATENCY_HISTORY) lat.samples.shift();
	lat.min = Math.min(...lat.samples);
	lat.max = Math.max(...lat.samples);
	lat.avg = Math.round(
		lat.samples.reduce((a, b) => a + b, 0) / lat.samples.length,
	);
}

function startSampling() {
	sampleMetrics().catch(() => {});
	setInterval(() => sampleMetrics().catch(() => {}), 2000);
	setInterval(() => sampleLatency().catch(() => {}), 5000);
}

// ---------------------------------------------------------------------------
// 傳輸量 / Range 測試
// ---------------------------------------------------------------------------

async function fetchBytes(url, headers = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 30000);
	const t0 = performance.now();
	try {
		const response = await fetch(url, { headers, signal: controller.signal });
		const body = await response.arrayBuffer();
		return {
			status: response.status,
			bytes: body.byteLength,
			contentLength: response.headers.get("content-length"),
			contentRange: response.headers.get("content-range"),
			acceptRanges: response.headers.get("accept-ranges"),
			ms: Math.round(performance.now() - t0),
		};
	} catch (error) {
		return { error: String(error), ms: Math.round(performance.now() - t0) };
	} finally {
		clearTimeout(timer);
	}
}

// 對 dev server 的同一個檔案，比較「完整下載」與「Range 前 1KB」的傳輸量。
async function rangeTest(pathname) {
	const status = getStatus();
	if (!status.running || !status.url) return { error: "dev server 未執行" };
	const base = status.url.replace(/\/$/, "");
	const url = base + pathname;
	const full = await fetchBytes(url);
	const ranged = await fetchBytes(url, { Range: "bytes=0-1023" });
	let savingPct = null;
	if (
		typeof full.bytes === "number" &&
		full.bytes > 0 &&
		typeof ranged.bytes === "number"
	) {
		savingPct = Math.round((1 - ranged.bytes / full.bytes) * 100);
	}
	return { url, full, ranged, savingPct };
}

const MEDIA_REQUESTS_LIMIT = 50;
const mediaRequests = [];

// 以面板為代理轉送媒體請求，才能記錄瀏覽器實際送出的 Range 與位元組量。
async function proxyMedia(req, res, mediaPath) {
	const status = getStatus();
	if (!status.running || !status.url) {
		res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
		res.end("dev server 未執行");
		return;
	}
	const target = status.url.replace(/\/$/, "") + mediaPath;
	const headers = {};
	if (req.headers.range) headers.Range = req.headers.range;
	const t0 = Date.now();
	let upstream;
	try {
		upstream = await fetch(target, { headers });
	} catch (error) {
		res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
		res.end("upstream error: " + error);
		return;
	}
	const outHeaders = {
		"content-type":
			upstream.headers.get("content-type") || "application/octet-stream",
		"cache-control": "no-store",
	};
	for (const name of ["content-length", "content-range", "accept-ranges"]) {
		const value = upstream.headers.get(name);
		if (value) outHeaders[name] = value;
	}
	res.writeHead(upstream.status, outHeaders);
	let bytes = 0;
	if (upstream.body) {
		for await (const chunk of upstream.body) {
			bytes += chunk.length;
			res.write(chunk);
		}
	}
	res.end();
	mediaRequests.unshift({
		time: Date.now(),
		range: req.headers.range || "(無)",
		status: upstream.status,
		contentRange: upstream.headers.get("content-range") || "",
		bytes,
		ms: Date.now() - t0,
	});
	if (mediaRequests.length > MEDIA_REQUESTS_LIMIT) {
		mediaRequests.length = MEDIA_REQUESTS_LIMIT;
	}
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
  .tabs { display: flex; gap: 6px; margin-bottom: 16px; }
  .tab { font: inherit; font-size: 13px; padding: 6px 14px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: #8b93a1; cursor: pointer; }
  .tab.active { background: #1a1f29; border-color: #2a2f3a; color: #e6e6e6; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .card { padding: 16px 18px; background: #12151b; border: 1px solid #232936; border-radius: 10px; }
  .card .k { font-size: 12px; color: #8b93a1; margin-bottom: 8px; }
  .card .v { font-size: 22px; font-weight: 600; line-height: 1.3; }
  .card .sub { font-size: 12px; color: #8b93a1; margin-top: 8px; line-height: 1.5; }
  .bar { height: 8px; background: #232936; border-radius: 999px; overflow: hidden; margin-top: 12px; }
  .bar > i { display: block; height: 100%; background: #4ade80; }
  .lat { display: flex; align-items: flex-end; justify-content: flex-end; gap: 2px; height: 64px; padding: 8px 0; margin-top: 12px; }
  .lat > span { flex: 1; background: #3b82f6; border-radius: 2px 2px 0 0; min-height: 2px; max-width: 14px; }
  .mrow { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11.5px; color: #c9d1d9; padding: 6px 8px; border-bottom: 1px solid #1c212b; word-break: break-all; }
  .mrow code { color: #7dd3fc; }
  #range-player { width: auto; height: auto; max-width: 720px; max-height: 60vh; margin: 12px auto 0; background: #000; border-radius: 8px; }
  .range-grid { display: grid; gap: 4px 20px; }
  @media (min-width: 1080px) {
    .range-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
    #media-log { max-height: 340px; overflow: auto; }
  }
  @media (max-width: 640px) {
    body { padding: 14px; }
    h1 { font-size: 16px; }
  }
</style>
</head>
<body>
  <header>
    <h1>Astro Dev 控制台</h1>
    <div id="status" class="status off" aria-live="polite">載入中…</div>
    <a id="openLink" class="button" href="#" target="_blank" rel="noopener" hidden>開啟網站 ↗</a>
  </header>
  <nav class="tabs">
    <button class="tab active" data-tab="control">控制</button>
    <button class="tab" data-tab="perf">效能</button>
  </nav>
  <section id="tab-control">
  <div class="actions">
    <button id="start" class="primary">啟動</button>
    <button id="restart">重啟</button>
    <button id="restartForce">清快取重啟</button>
    <button id="stop" class="danger">停止</button>
    <button id="refresh">重新整理</button>
  </div>
  <pre id="logs">載入日誌中…</pre>
  <p class="hint">此面板只綁定 127.0.0.1。關閉面板（Ctrl+C）不會停止 dev server。</p>
  </section>

  <section id="tab-perf" hidden>
    <div class="cards">
      <div class="card"><div class="k">Dev CPU</div><div class="v" id="m-dev-cpu">–</div><div class="sub" id="m-dev-pid">–</div></div>
      <div class="card"><div class="k">Dev 記憶體</div><div class="v" id="m-dev-mem">–</div><div class="sub" id="m-dev-uptime">–</div></div>
      <div class="card"><div class="k">面板 CPU</div><div class="v" id="m-panel-cpu">–</div><div class="sub" id="m-panel-mem">–</div></div>
      <div class="card"><div class="k">系統記憶體</div><div class="v" id="m-sys-mem">–</div><div class="sub" id="m-sys-sub">–</div><div class="bar"><i id="m-sys-bar" style="width:0%"></i></div></div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div class="k">響應延遲 <span class="sub" style="display:inline">（每 5s 對 dev server 發一次請求，單位 ms）</span></div>
      <div class="v" id="m-lat-last">–</div>
      <div class="sub" id="m-lat-stats">等待取樣</div>
      <div class="lat" id="m-lat-bars"></div>
      <div class="sub" id="m-lat-axis" style="text-align:right">–</div>
      <div class="sub"><span style="color:#3b82f6">▮</span> 正常 &lt;500ms&nbsp;&nbsp;<span style="color:#fbbf24">▮</span> 500–2000ms&nbsp;&nbsp;<span style="color:#f87171">▮</span> &gt;2000ms（每根 = 一次取樣，滑鼠移入看數值）</div>
    </div>
    <div class="card">
      <div class="k">影片 Range 測試（實際播放）</div>
      <div class="sub">瀏覽器播放／拖曳時，只會用 <code>Range: bytes=A-</code> 要求「從第 A 個位元組開始」的資料，伺服器回 <code>206</code> 只送這一段（不必整檔下載）。右側即時列出每個請求。</div>
      <div class="range-grid">
        <div class="range-left">
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            <select id="m-media" style="flex:1;min-width:200px;font:inherit;font-size:13px;padding:8px;border-radius:8px;background:#1a1f29;color:#e6e6e6;border:1px solid #2a2f3a"></select>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            <button id="load-player">載入播放器</button>
            <button id="clear-media">清空統計</button>
            <button id="copy-media">複製紀錄</button>
            <button id="range-test">對照 1KB vs 完整</button>
          </div>
          <video id="range-player" controls playsinline preload="metadata" style="display:none"></video>
          <pre id="range-result" style="height:auto;margin-top:10px;display:none;max-height:160px"></pre>
        </div>
        <div class="range-right">
          <div class="sub" id="media-summary" style="margin-top:10px">—</div>
          <div id="media-log" style="margin-top:6px"></div>
        </div>
      </div>
    </div>
    <p class="hint">CPU/記憶體每 2s、延遲每 5s；Range 測試為手動。</p>
  </section>
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
  // ---- 效能分頁 ----
  function fmtBytes(n) {
    if (!n) return "0 B";
    var units = ["B", "KB", "MB", "GB"];
    var i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (i === 3 ? n.toFixed(1) : Math.round(n)) + " " + units[i];
  }
  var perfTab = false;
  function setTab(name) {
    perfTab = name === "perf";
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === name);
    }
    $("tab-control").hidden = name !== "control";
    $("tab-perf").hidden = name !== "perf";
    if (perfTab) { refreshMetrics(); loadMediaOptions(); refreshMediaLog(); }
  }
  var tabEls = document.querySelectorAll(".tab");
  for (var ti = 0; ti < tabEls.length; ti++) {
    (function (el) { el.onclick = function () { setTab(el.getAttribute("data-tab")); }; })(tabEls[ti]);
  }
  function refreshMetrics() {
    if (!perfTab) return;
    api("/api/metrics").then(function (m) {
      $("m-dev-cpu").textContent = m.dev.running ? Math.round(m.dev.cpu) + "%" : "離線";
      $("m-dev-pid").textContent = m.dev.running ? "pid " + m.dev.pid : "未執行";
      $("m-dev-mem").textContent = m.dev.running ? fmtBytes(m.dev.memRss) : "–";
      $("m-dev-uptime").textContent = m.dev.running
        ? "uptime " + m.dev.uptimeSec + "s · " + Math.round(m.dev.memRss / m.system.totalMem * 100) + "% 系統 RAM"
        : "–";
      $("m-panel-cpu").textContent = m.panel.cpu.toFixed(1) + "%";
      $("m-panel-mem").textContent = fmtBytes(m.panel.memRss);
      var usedBytes = m.system.totalMem - m.system.freeMem;
      var usedPct = Math.round(usedBytes / m.system.totalMem * 100);
      $("m-sys-mem").textContent = (usedBytes / 1073741824).toFixed(1) + " / " + (m.system.totalMem / 1073741824).toFixed(1) + " GB";
      $("m-sys-sub").textContent = "可用 " + fmtBytes(m.system.freeMem) + " · " + usedPct + "% 已用 · " + m.system.cpuCount + " 核";
      $("m-sys-bar").style.width = usedPct + "%";
      $("m-sys-bar").style.background = usedPct >= 85 ? "#f87171" : usedPct >= 65 ? "#fbbf24" : "#4ade80";
      $("m-lat-last").textContent = m.latency.last != null ? m.latency.last + " ms" : "–";
      $("m-lat-stats").textContent = m.latency.min != null
        ? "min " + m.latency.min + " / avg " + m.latency.avg + " / max " + m.latency.max + " ms · 本次傳輸 " + fmtBytes(m.latency.bytes)
        : "等待取樣";
      var samples = m.latency.samples || [];
      var max = Math.max.apply(null, samples.concat([1]));
      var html = "";
      for (var i = 0; i < samples.length; i++) {
        var s = samples[i];
        var h = Math.max(3, Math.round(s / max * 56));
        var color = s > 2000 ? "#f87171" : s > 500 ? "#fbbf24" : "#3b82f6";
        html += '<span style="height:' + h + 'px;background:' + color + '" title="' + s + ' ms"></span>';
      }
      $("m-lat-bars").innerHTML = html;
      $("m-lat-axis").textContent = "頂點 " + max + " ms · " + samples.length + " 個樣本（每 5s）";
    }).catch(function () {});
  }
  var mediaLoaded = false;
  var mediaSizes = {};
  function loadMediaOptions() {
    if (mediaLoaded) return;
    mediaLoaded = true;
    api("/api/media").then(function (list) {
      var sel = $("m-media");
      list.forEach(function (m) { mediaSizes[m.url] = m.size; });
      if (!list.length) {
        sel.innerHTML = '<option value="">（沒有找到本地影片）</option>';
        return;
      }
      sel.innerHTML = list.map(function (m) {
        return '<option value="' + m.url + '">' + m.url + '（' + fmtBytes(m.size) + '）</option>';
      }).join("");
      loadPlayer();
    }).catch(function () { mediaLoaded = false; });
  }
  function loadPlayer() {
    var path = $("m-media").value;
    var video = $("range-player");
    if (!path) { video.style.display = "none"; return; }
    video.style.display = "block";
    lastMediaSig = "";
    api("/api/media-requests/clear", { method: "POST" }).then(refreshMediaLog);
    video.src = "/media-proxy?path=" + encodeURIComponent(path);
    video.load();
  }
  function clearMedia() {
    lastMediaSig = "";
    api("/api/media-requests/clear", { method: "POST" }).then(refreshMediaLog);
  }
  var lastMediaSig = "";
  function mediaRowText(r) {
    return "Range: " + r.range + " → HTTP " + r.status
      + (r.contentRange ? " · " + r.contentRange : "")
      + " · " + fmtBytes(r.bytes) + " · " + r.ms + " ms";
  }
  function mediaSummaryText(reqs, size) {
    if (!reqs.length) return "尚無請求：按「載入播放器」後播放或拖曳進度。";
    var total = reqs.reduce(function (a, r) { return a + r.bytes; }, 0);
    var s = "本次 " + reqs.length + " 個 Range 請求，累計傳輸 " + fmtBytes(total);
    if (size) s += "（完整檔 " + fmtBytes(size) + "）";
    if (size && total > size) s += "；超過完整檔是因為拖曳／重播又重抓了部分資料";
    return s;
  }
  function refreshMediaLog() {
    if (!perfTab) return;
    api("/api/media-requests").then(function (d) {
      var reqs = d.requests || [];
      var sig = JSON.stringify(reqs);
      if (sig === lastMediaSig) return; // 內容沒變就不重繪，方便選取與複製
      lastMediaSig = sig;
      $("media-log").innerHTML = reqs.map(function (r) {
        return '<div class="mrow"><code>' + mediaRowText(r) + '</code></div>';
      }).join("");
      $("media-summary").textContent = mediaSummaryText(reqs, mediaSizes[$("m-media").value]);
    }).catch(function () {});
  }
  function copyMediaLog() {
    var lines = [$("media-summary").textContent];
    var rows = document.querySelectorAll("#media-log .mrow");
    for (var i = 0; i < rows.length; i++) lines.push(rows[i].textContent);
    var text = lines.join("\\n");
    var button = $("copy-media");
    var flash = function () {
      var old = button.textContent;
      button.textContent = "已複製";
      setTimeout(function () { button.textContent = old; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(flash).catch(function () {});
    } else {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); flash(); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
    }
  }
  $("load-player").onclick = loadPlayer;
  $("clear-media").onclick = clearMedia;
  $("copy-media").onclick = copyMediaLog;
  function runRangeTest() {
    var sel = $("m-media");
    var path = sel.value || "/";
    var box = $("range-result");
    box.style.display = "block";
    box.textContent = "測試中… " + path;
    api("/api/range-test?path=" + encodeURIComponent(path)).then(function (r) {
      if (r.error) { box.textContent = "錯誤：" + r.error; return; }
      function line(s) {
        if (s.error) return "錯誤：" + s.error;
        var parts = ["HTTP " + s.status, "傳輸 " + fmtBytes(s.bytes), s.ms + " ms"];
        if (s.contentRange) parts.push("Content-Range: " + s.contentRange);
        if (s.acceptRanges) parts.push("Accept-Ranges: " + s.acceptRanges);
        return parts.join(" · ");
      }
      var lines = [
        "URL: " + r.url,
        "",
        "① 完整下載（不帶 Range）",
        "   " + line(r.full),
        "",
        "② Range 請求（bytes=0-1023）",
        "   " + line(r.ranged),
      ];
      if (r.savingPct != null) {
        var ratio = (r.ranged.bytes / r.full.bytes) * 100;
        lines.push("");
        lines.push("→ Range 只下載 " + fmtBytes(r.ranged.bytes) + "（完整 " + fmtBytes(r.full.bytes) + "），約 " + ratio.toFixed(2) + "% 流量");
      }
      box.textContent = lines.join("\\n");
    }).catch(function (e) { box.textContent = "錯誤：" + e; });
  }
  $("range-test").onclick = runRangeTest;
  setTab("control");
  refreshStatus();
  refreshLogs();
  setInterval(function () { if (!busy) refreshStatus(); }, 3000);
  setInterval(function () { if (!busy) refreshLogs(); }, 3000);
  setInterval(refreshMetrics, 2000);
  setInterval(refreshMediaLog, 1000);
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
		if (req.method === "GET" && url.pathname === "/api/metrics") {
			return sendJson(res, metrics);
		}
		if (req.method === "GET" && url.pathname === "/api/media") {
			return sendJson(
				res,
				listMediaAssets().map(({ url: mediaUrl, size }) => ({
					url: mediaUrl,
					size,
				})),
			);
		}
		if (req.method === "GET" && url.pathname === "/api/range-test") {
			return sendJson(
				res,
				await rangeTest(url.searchParams.get("path") || "/"),
			);
		}
		if (req.method === "GET" && url.pathname === "/media-proxy") {
			return proxyMedia(req, res, url.searchParams.get("path") || "/");
		}
		if (req.method === "GET" && url.pathname === "/api/media-requests") {
			return sendJson(res, { requests: mediaRequests });
		}
		if (
			req.method === "POST" &&
			url.pathname === "/api/media-requests/clear"
		) {
			mediaRequests.length = 0;
			return sendJson(res, { ok: true });
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
	writePanelLock(actualPort);
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

process.on("exit", () => {
	try {
		fs.unlinkSync(PANEL_LOCK);
	} catch {
		// 已經不在了
	}
});

killPreviousPanel();
startSampling();
server.listen(currentPort, HOST);
