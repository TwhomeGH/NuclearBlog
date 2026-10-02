import { describe, expect, it } from "vitest";
import { rehypeVideoWidth } from "../src/plugins/rehype-video-width.mjs";

interface El {
	type: string;
	tagName: string;
	properties: Record<string, unknown>;
	children: El[];
}

function makeVideo(
	props: Record<string, unknown> = {},
): El {
	return {
		type: "element",
		tagName: "video",
		properties: {
			src: "./clip.mp4",
			controls: "true",
			autoplay: "false",
			muted: "true",
			width: "100%",
			height: "468px",
			...props,
		},
		children: [{ type: "text", value: "Demo" } as unknown as El],
	};
}

function makeTree(video: El): El {
	return { type: "root", tagName: "root", properties: {}, children: [video] };
}

describe("rehypeVideoWidth", () => {
	const plugin = rehypeVideoWidth();

	it("包成 figure 並把字串布林值正規化", () => {
		const tree = makeTree(makeVideo());
		plugin(tree);
		const figure = tree.children[0];
		expect(figure.tagName).toBe("figure");
		expect(figure.properties.style).toContain("width:100%");
		expect(figure.properties.style).toContain("height:468px");

		const video = figure.children[0];
		expect(video.tagName).toBe("video");
		expect(video.properties.controls).toBe(true);
		// autoplay="false" 不可變成自動播放
		expect(Boolean(video.properties.autoplay)).toBe(false);
		expect(video.properties.muted).toBe(true);
		// hast 的正規化屬性名是 playsInline（序列化為 playsinline）
		expect(
			Boolean(
				video.properties.playsInline ?? video.properties.playsinline,
			),
		).toBe(true);
		expect(video.properties.preload).toBe("metadata");
		expect(video.properties.style).toContain("aspect-ratio:16/9");
	});

	it("preload 可被覆寫", () => {
		const tree = makeTree(makeVideo({ preload: "none" }));
		plugin(tree);
		expect(tree.children[0].children[0].properties.preload).toBe("none");
	});
});
