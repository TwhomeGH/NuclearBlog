import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { visit } from "unist-util-visit";

/**
 * 影片資源管線。
 *
 * 作者在 Markdown 內以相對路徑引用影片（例如 `::video[..]{ src="./clip.mp4" }`）。
 * 此模組會：
 *   1. 依檔案內容計算 sha256 短雜湊，改寫成 `/media/<name>.<hash>.<ext>`。
 *      → 內容不變 = URL 不變 = 可永久快取；內容改變 = URL 改變 = 自動失效。
 *   2. 開發時以同源中介層提供該 URL（支援 HTTP Range 分段請求）。
 *   3. 建置時把檔案複製到 `dist/media/...`，由主機以 immutable 標頭長期快取。
 *
 * 網址由「檔案內容」決定，因此 remark 外掛與 integration 不需共享狀態即可得到一致結果。
 */

const VIDEO_EXTENSIONS = new Set([
	".mp4",
	".webm",
	".ogv",
	".ogg",
	".mov",
	".m4v",
]);

const MIME_TYPES = {
	".mp4": "video/mp4",
	".webm": "video/webm",
	".ogv": "video/ogg",
	".ogg": "video/ogg",
	".mov": "video/quicktime",
	".m4v": "video/x-m4v",
};

const MEDIA_PREFIX = "/media/";
const HASH_LENGTH = 10;
const CONTENT_DIR = "src/content/posts";

function hashBuffer(buffer) {
	return createHash("sha256").update(buffer).digest("hex").slice(0, HASH_LENGTH);
}

function mediaUrl(absPath, hash) {
	const ext = path.extname(absPath).toLowerCase();
	const base = path.basename(absPath, ext);
	return `${MEDIA_PREFIX}${encodeURIComponent(base)}.${hash}${ext}`;
}

function urlForFile(absPath) {
	if (!fs.existsSync(absPath)) return null;
	const ext = path.extname(absPath).toLowerCase();
	if (!VIDEO_EXTENSIONS.has(ext)) return null;
	return mediaUrl(absPath, hashBuffer(fs.readFileSync(absPath)));
}

function isRemote(src) {
	return (
		!src ||
		src.startsWith("/") ||
		src.startsWith("//") ||
		src.startsWith("#") ||
		/^[a-z][a-z0-9+.-]*:/i.test(src)
	);
}

function resolveLocalSource(src, mdPath) {
	if (isRemote(src)) return null;
	const clean = decodeURIComponent(src.split("?")[0].split("#")[0]);
	const baseDir = mdPath ? path.dirname(mdPath) : process.cwd();
	const abs = path.resolve(baseDir, clean);
	return VIDEO_EXTENSIONS.has(path.extname(abs).toLowerCase()) &&
		fs.existsSync(abs)
		? abs
		: null;
}

/** 掃描內容目錄，回傳 public URL → 絕對路徑的索引。 */
function buildIndex() {
	const root = path.resolve(process.cwd(), CONTENT_DIR);
	const index = new Map();
	if (!fs.existsSync(root)) return index;

	const walk = (dir) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
				continue;
			}
			const ext = path.extname(entry.name).toLowerCase();
			if (!VIDEO_EXTENSIONS.has(ext)) continue;
			index.set(mediaUrl(full, hashBuffer(fs.readFileSync(full))), full);
		}
	};

	walk(root);
	return index;
}

/** 列出內容目錄中的影片資源（public URL、絕對路徑、位元組大小），供工具使用。 */
export function listMediaAssets() {
	const assets = [];
	for (const [url, abs] of buildIndex()) {
		let size = 0;
		try {
			size = fs.statSync(abs).size;
		} catch {
			// 讀不到大小就算了
		}
		assets.push({ url, abs, size });
	}
	return assets;
}

function serveRange(req, res, abs) {
	const stat = fs.statSync(abs);
	const ext = path.extname(abs).toLowerCase();
	res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
	res.setHeader("Accept-Ranges", "bytes");
	res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

	const range = req.headers.range;
	if (!range) {
		res.statusCode = 200;
		res.setHeader("Content-Length", stat.size);
		fs.createReadStream(abs).pipe(res);
		return;
	}

	const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
	if (!match) {
		res.statusCode = 416;
		res.setHeader("Content-Range", `bytes */${stat.size}`);
		res.end();
		return;
	}

	let start = match[1] === "" ? null : Number(match[1]);
	let end = match[2] === "" ? null : Number(match[2]);

	if (start === null && end !== null) {
		start = Math.max(0, stat.size - end);
		end = stat.size - 1;
	} else {
		if (start === null) start = 0;
		if (end === null || end >= stat.size) end = stat.size - 1;
	}

	if (start > end || start >= stat.size) {
		res.statusCode = 416;
		res.setHeader("Content-Range", `bytes */${stat.size}`);
		res.end();
		return;
	}

	res.statusCode = 206;
	res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
	res.setHeader("Content-Length", end - start + 1);
	fs.createReadStream(abs, { start, end }).pipe(res);
}

/** remark 外掛：改寫 ::video 指令中的相對影片路徑。 */
export function remarkVideoAssets() {
	return (tree, file) => {
		const mdPath =
			file && typeof file.path === "string" && !file.path.startsWith("<")
				? file.path
				: undefined;

		visit(tree, (node) => {
			if (
				(node.type !== "leafDirective" &&
					node.type !== "containerDirective") ||
				node.name !== "video"
			) {
				return;
			}

			const attributes = node.attributes || (node.attributes = {});
			const abs = resolveLocalSource(attributes.src, mdPath);
			if (!abs) return;

			const url = urlForFile(abs);
			if (url) attributes.src = url;
		});
	};
}

/** Astro integration：開發服務 + 建置輸出。 */
export function videoAssets() {
	return {
		name: "nuclear-video-assets",
		hooks: {
			"astro:server:setup": ({ server }) => {
				let index = buildIndex();
				server.middlewares.use((req, res, next) => {
					if (!req.url || !req.url.startsWith(MEDIA_PREFIX)) return next();

					const pathname = decodeURIComponent(req.url.split("?")[0]);
					let abs = index.get(pathname);
					if (!abs) {
						index = buildIndex();
						abs = index.get(pathname);
					}
					if (!abs) return next();

					serveRange(req, res, abs);
				});
			},
			"astro:build:done": ({ dir }) => {
				const outDir = fileURLToPath(dir);
				for (const [url, abs] of buildIndex()) {
					const dest = path.join(outDir, url.replace(/^\//, ""));
					fs.mkdirSync(path.dirname(dest), { recursive: true });
					fs.copyFileSync(abs, dest);
				}
			},
		},
	};
}
