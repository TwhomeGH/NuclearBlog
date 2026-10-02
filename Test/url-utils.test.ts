import { describe, expect, it } from "vitest";
import {
	getCategoryUrl,
	getDir,
	getFileDirFromPath,
	getPostUrlBySlug,
	getTagUrl,
	pathsEqual,
	removeFileExtension,
} from "@utils/url-utils";

describe("removeFileExtension", () => {
	it.each([
		["posts/foo.md", "posts/foo"],
		["foo.mdx", "foo"],
		["foo.markdown", "foo"],
		["foo.MD", "foo"],
		["foo.txt", "foo.txt"],
		["no-extension", "no-extension"],
	])("%s -> %s", (input, expected) => {
		expect(removeFileExtension(input)).toBe(expected);
	});
});

describe("pathsEqual", () => {
	it("忽略頭尾斜線與大小寫", () => {
		expect(pathsEqual("/Archive/", "archive")).toBe(true);
		expect(pathsEqual("a/b", "a/b/")).toBe(true);
		expect(pathsEqual("/a", "/b")).toBe(false);
	});
});

describe("getPostUrlBySlug", () => {
	it("產生 /posts/<slug>/ 並移除副檔名", () => {
		expect(getPostUrlBySlug("iceFixed/index.md")).toBe(
			"/posts/iceFixed/index/",
		);
		expect(getPostUrlBySlug("hello")).toBe("/posts/hello/");
	});
});

describe("getDir", () => {
	it("回傳含結尾斜線的目錄", () => {
		expect(getDir("WeightManagement/chapter-08.md")).toBe(
			"WeightManagement/",
		);
	});
	it("沒有斜線時回傳 /", () => {
		expect(getDir("foo.md")).toBe("/");
	});
});

describe("getFileDirFromPath", () => {
	it("移除 src/ 前綴與檔名", () => {
		expect(getFileDirFromPath("src/content/posts/x.md")).toBe(
			"content/posts",
		);
	});
});

describe("getTagUrl", () => {
	it("對標籤做 URL 編碼", () => {
		expect(getTagUrl("冰塊")).toBe("/archive/?tag=%E5%86%B0%E5%A1%8A");
	});
	it("空標籤回傳 /archive/", () => {
		expect(getTagUrl("")).toBe("/archive/");
	});
});

describe("getCategoryUrl", () => {
	it("對分類做 URL 編碼", () => {
		expect(getCategoryUrl("Learn")).toBe("/archive/?category=Learn");
	});
	it("空分類視為未分類", () => {
		expect(getCategoryUrl("")).toBe("/archive/?uncategorized=true");
		expect(getCategoryUrl(null)).toBe("/archive/?uncategorized=true");
	});
});
