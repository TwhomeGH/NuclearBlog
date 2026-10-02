import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isCacheFresh } from "../scripts/lib/anime-cache.mjs";

const dir = mkdtempSync(path.join(tmpdir(), "anime-cache-"));
const file = path.join(dir, "data.json");

afterEach(() => {
	delete process.env.ANIME_FORCE_UPDATE;
	rmSync(file, { force: true });
});

describe("isCacheFresh", () => {
	it("檔案不存在 → false", () => {
		expect(isCacheFresh(file)).toBe(false);
	});

	it("檔案剛寫入 → true", () => {
		writeFileSync(file, "[]");
		expect(isCacheFresh(file)).toBe(true);
	});

	it("檔案超過 TTL → false", () => {
		writeFileSync(file, "[]");
		const old = Date.now() / 1000 - 24 * 60 * 60;
		utimesSync(file, old, old);
		expect(isCacheFresh(file)).toBe(false);
	});

	it("ANIME_FORCE_UPDATE=1 即使新鮮也強制 false", () => {
		writeFileSync(file, "[]");
		process.env.ANIME_FORCE_UPDATE = "1";
		expect(isCacheFresh(file)).toBe(false);
	});
});
