import fs from "node:fs";

// 資料快取時效（小時）。可用 ANIME_CACHE_TTL_HOURS 覆寫，預設 6 小時。
export const ANIME_CACHE_TTL_MS =
	(Number(process.env.ANIME_CACHE_TTL_HOURS) || 6) * 60 * 60 * 1000;

/**
 * 資料檔是否仍在快取時效內。
 * 設 ANIME_FORCE_UPDATE=1 可強制忽略快取、重新抓取。
 */
export function isCacheFresh(outputFile) {
	if (process.env.ANIME_FORCE_UPDATE === "1") return false;
	try {
		const stat = fs.statSync(outputFile);
		return Date.now() - stat.mtimeMs < ANIME_CACHE_TTL_MS;
	} catch {
		// 檔案不存在 → 需要抓取
		return false;
	}
}
