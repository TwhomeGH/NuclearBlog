import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { remarkVideoAssets } from "../src/plugins/video-assets.mjs";

const dir = mkdtempSync(path.join(tmpdir(), "video-assets-"));
writeFileSync(path.join(dir, "clip.mp4"), "fake video bytes");
const postPath = path.join(dir, "post.md");

interface VideoNode {
	type: string;
	name: string;
	attributes: { src: string };
	children: unknown[];
}
interface Tree {
	type: "root";
	children: VideoNode[];
}

function treeWithVideo(src: string): Tree {
	return {
		type: "root",
		children: [
			{ type: "leafDirective", name: "video", attributes: { src }, children: [] },
		],
	};
}

describe("remarkVideoAssets", () => {
	const transform = remarkVideoAssets();

	it("把本地影片改寫成 /media/<name>.<hash>.mp4", () => {
		const tree = treeWithVideo("./clip.mp4");
		transform(tree, { path: postPath });
		expect(tree.children[0].attributes.src).toMatch(
			/^\/media\/clip\.[0-9a-f]{10}\.mp4$/,
		);
	});

	it("相同內容 -> 相同 URL（可長快取）", () => {
		const a = treeWithVideo("./clip.mp4");
		const b = treeWithVideo("./clip.mp4");
		transform(a, { path: postPath });
		transform(b, { path: postPath });
		expect(a.children[0].attributes.src).toBe(b.children[0].attributes.src);
	});

	it("外部 URL 不改寫", () => {
		const tree = treeWithVideo("https://example.com/x.mp4");
		transform(tree, { path: postPath });
		expect(tree.children[0].attributes.src).toBe(
			"https://example.com/x.mp4",
		);
	});

	it("站內絕對路徑（public/）不改寫", () => {
		const tree = treeWithVideo("/videos/x.mp4");
		transform(tree, { path: postPath });
		expect(tree.children[0].attributes.src).toBe("/videos/x.mp4");
	});

	it("本地檔案不存在時保留原樣", () => {
		const tree = treeWithVideo("./missing.mp4");
		transform(tree, { path: postPath });
		expect(tree.children[0].attributes.src).toBe("./missing.mp4");
	});
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));
