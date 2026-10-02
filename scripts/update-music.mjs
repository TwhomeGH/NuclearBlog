#!/usr/bin/env node
// 於 build 時預先解析音樂播放清單：抓取歌曲資訊、下載專輯封面到 public/music/，
// 並寫出 src/data/music-player.json。歌單未變且本地資料仍新鮮時直接跳過，
// 讓執行時不必再呼叫 meting API。
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const CONFIG_FILE = join(projectRoot, "src", "config.ts");
const OUTPUT_FILE = join(projectRoot, "src", "data", "music-player.json");
const COVER_DIR = join(projectRoot, "public", "music");
const CACHE_TTL_MS = (Number(process.env.MUSIC_CACHE_TTL_HOURS) || 24) * 60 * 60 * 1000;

function log(...args) {
	console.log("[music]", ...args);
}

function readMusicConfig() {
	const src = readFileSync(CONFIG_FILE, "utf-8");
	const block = src.match(/export const musicPlayerConfig[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
	if (!block) return null;
	const body = block[1];
	const pick = (key) => {
		const m = body.match(new RegExp(`${key}\\s*:\\s*"([^"]*)"`));
		return m ? m[1] : undefined;
	};
	return {
		mode: pick("mode"),
		meting_api: pick("meting_api"),
		id: pick("id"),
		server: pick("server"),
		type: pick("type"),
	};
}

function isFresh(file, ttlMs) {
	try {
		return Date.now() - statSync(file).mtimeMs < ttlMs;
	} catch {
		return false;
	}
}

function songIdFrom(song) {
	if (song.id != null) return String(song.id).replace(/[^a-zA-Z0-9._-]/g, "_");
	try {
		const qid = new URL(song.url).searchParams.get("id");
		if (qid) return qid;
	} catch {
		// 忽略非法 URL
	}
	return createHash("sha1")
		.update(String(song.url || song.pic || Math.random()))
		.digest("hex")
		.slice(0, 10);
}

function extFromUrl(url, contentType) {
	try {
		const ext = extname(new URL(url).pathname).toLowerCase();
		if (ext && ext.length <= 5) return ext;
	} catch {
		// 忽略非法 URL
	}
	if (contentType?.includes("png")) return ".png";
	if (contentType?.includes("webp")) return ".webp";
	if (contentType?.includes("gif")) return ".gif";
	return ".jpg";
}

async function downloadCover(url, baseName) {
	if (!url) return "";
	// 已知副檔名：本地已有就重用，不再下載
	for (const ext of [".jpg", ".jpeg", ".png", ".webp", ".gif"]) {
		if (existsSync(join(COVER_DIR, baseName + ext))) return `/music/${baseName}${ext}`;
	}
	const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
	if (!res.ok) throw new Error(`封面 HTTP ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	const ext = extFromUrl(url, res.headers.get("content-type"));
	mkdirSync(COVER_DIR, { recursive: true });
	writeFileSync(join(COVER_DIR, baseName + ext), buf);
	return `/music/${baseName}${ext}`;
}

async function main() {
	const cfg = readMusicConfig();
	if (!cfg) {
		log("找不到 musicPlayerConfig，跳過");
		return;
	}
	if (cfg.mode !== "meting") {
		log(`mode=${cfg.mode}，非 meting，跳過`);
		return;
	}
	if (!cfg.meting_api || !cfg.id) {
		log("meting_api / id 未設定，跳過");
		return;
	}

	const cacheKey = `${cfg.server}|${cfg.type}|${cfg.id}`;

	// 歌單未變、資料仍新鮮 → 跳過（MUSIC_FORCE_UPDATE=1 可強制）
	if (existsSync(OUTPUT_FILE) && !process.env.MUSIC_FORCE_UPDATE && isFresh(OUTPUT_FILE, CACHE_TTL_MS)) {
		try {
			const prev = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"));
			if (prev.key === cacheKey && Array.isArray(prev.songs) && prev.songs.length > 0) {
				log("資料已是最新，跳過");
				return;
			}
		} catch {
			// 壞掉就重抓
		}
	}

	const apiUrl = cfg.meting_api
		.replace(":server", cfg.server)
		.replace(":type", cfg.type)
		.replace(":id", cfg.id)
		.replace(":auth", "")
		.replace(":r", Date.now().toString());

	log(`抓取 ${cfg.server} ${cfg.type} ${cfg.id} …`);
	const res = await fetch(apiUrl, { headers: { "user-agent": "Mozilla/5.0" } });
	if (!res.ok) throw new Error(`meting API HTTP ${res.status}`);
	const raw = await res.json();
	const list = Array.isArray(raw) ? raw : [raw];

	const songs = [];
	for (const song of list) {
		if (!song) continue;
		const id = songIdFrom(song);
		let dur = song.duration ?? 0;
		if (dur > 10000) dur = Math.floor(dur / 1000);
		if (!Number.isFinite(dur) || dur <= 0) dur = 0;

		let cover = "";
		try {
			cover = await downloadCover(song.pic, String(id));
		} catch (error) {
			log(`封面下載失敗（${id}）：${error.message}`);
		}

		songs.push({
			id,
			title: song.name ?? song.title ?? "",
			artist: song.artist ?? song.author ?? "",
			cover,
			duration: dur,
			url: song.url ?? "",
		});
	}

	if (songs.length === 0) {
		log("未取得任何歌曲，保留現有資料");
		return;
	}

	mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
	writeFileSync(
		OUTPUT_FILE,
		`${JSON.stringify({ key: cacheKey, updatedAt: new Date().toISOString(), songs }, null, "\t")}\n`,
	);
	log(`已寫出 ${songs.length} 首 → ${OUTPUT_FILE}`);
}

main().catch((error) => {
	// 非致命：build 不因第三方 API 失敗而中斷
	console.warn("[music] 更新失敗，保留現有資料：", error.message);
});
