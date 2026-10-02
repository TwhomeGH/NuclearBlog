import { describe, expect, it } from "vitest";
import { rehypeImageWidth } from "../src/plugins/rehype-image-width.mjs";

interface El {
	type: string;
	tagName: string;
	properties: Record<string, unknown>;
	children: El[];
}

function makeImg(alt: string): El {
	return {
		type: "element",
		tagName: "img",
		properties: { src: "./x.jpg", alt },
		children: [],
	};
}

function makeTree(imgs: El[]): El {
	return {
		type: "root",
		tagName: "root",
		properties: {},
		children: [
			{ type: "element", tagName: "p", properties: {}, children: imgs },
		],
	};
}

describe("rehypeImageWidth", () => {
	const plugin = rehypeImageWidth();

	it("單張圖片包成 figure，解析 alt 的 h-344px", () => {
		const tree = makeTree([makeImg("ice0 h-344px")]);
		plugin(tree);
		const figure = tree.children[0];
		expect(figure.tagName).toBe("figure");
		const img = figure.children[0];
		expect(img.tagName).toBe("img");
		expect(img.properties.alt).toBe("ice0");
		expect(img.properties.style).toContain("height:344px");
		expect(img.properties.sizes).toContain("720px");
	});

	it("w-50% 解析成 width:50%", () => {
		const tree = makeTree([makeImg("x w-50%")]);
		plugin(tree);
		expect(tree.children[0].children[0].properties.style).toContain(
			"width:50%",
		);
	});

	it("多張圖片用 flex div 包住，sizes 使用半寬", () => {
		const tree = makeTree([makeImg("a"), makeImg("b")]);
		plugin(tree);
		const div = tree.children[0];
		expect(div.tagName).toBe("div");
		expect(div.children).toHaveLength(2);
		expect(div.children[0].children[0].properties.sizes).toContain("360px");
	});
});
