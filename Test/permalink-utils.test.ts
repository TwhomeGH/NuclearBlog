import { afterEach, describe, expect, it } from "vitest";
import {
	clearPostIdMap,
	generatePermalinkSlug,
	getPermalinkPath,
	getPostNumericId,
	hasCustomPermalink,
	initPostIdMap,
} from "@utils/permalink-utils";

type FakePost = ReturnType<typeof makePost>;

function makePost(id: string, published: string, extra: Record<string, unknown> = {}) {
	return {
		id,
		data: { published: new Date(published), ...extra },
	} as never;
}

describe("hasCustomPermalink", () => {
	it("有 permalink 為 true，否則 false", () => {
		expect(hasCustomPermalink({ data: { permalink: "/x/" } } as never)).toBe(
			true,
		);
		expect(hasCustomPermalink({ data: {} } as never)).toBe(false);
	});
});

describe("generatePermalinkSlug（自訂 permalink）", () => {
	it("移除頭尾斜線", () => {
		const post = makePost("a.md", "2026-01-01", { permalink: "/my-post/" });
		expect(generatePermalinkSlug(post)).toBe("my-post");
	});
});

describe("getPermalinkPath", () => {
	it("回傳根目錄下的路徑", () => {
		const post = makePost("a.md", "2026-01-01", { permalink: "/foo" });
		expect(getPermalinkPath(post)).toBe("/foo/");
	});
});

describe("post id map", () => {
	afterEach(() => clearPostIdMap());

	it("未初始化時回傳 0", () => {
		clearPostIdMap();
		expect(getPostNumericId("a.md")).toBe(0);
	});

	it("依發佈時間升序編號，最早為 1", () => {
		const posts: FakePost[] = [
			makePost("b.md", "2026-02-01"),
			makePost("a.md", "2026-01-01"),
		];
		initPostIdMap(posts);
		expect(getPostNumericId("a.md")).toBe(1);
		expect(getPostNumericId("b.md")).toBe(2);
	});

	it("未知 id 回傳 0", () => {
		initPostIdMap([makePost("a.md", "2026-01-01")]);
		expect(getPostNumericId("missing.md")).toBe(0);
	});
});
