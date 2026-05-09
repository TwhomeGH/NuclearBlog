import { visit } from "unist-util-visit";

export function rehypeImageWidth() {
	const regexW = / w-([0-9]+)(%|px)?/;
	const regexH = / h-([0-9]+)(%|px)?/;

	const processImg = (imgNode) => {
		const alt = imgNode.properties.alt || "";
		const matchW = alt.match(regexW);
		const matchH = alt.match(regexH);

		let width = "100%";
		let height = "auto";

		if (matchW) {
			width = matchW[2] ? `${matchW[1]}${matchW[2]}` : `${matchW[1]}%`;
		}
		if (matchH) {
			height = matchH[2] ? `${matchH[1]}${matchH[2]}` : `${matchH[1]}%`;
		}

		imgNode.properties.alt = alt
			.replace(regexW, "")
			.replace(regexH, "")
			.trim();

		imgNode.properties.style = `display:block; margin:0 auto; width:${width}; height:${height}; object-fit:contain;`;

		return {
			type: "element",
			tagName: "figure",
			properties: { style: "margin:1em 0; flex:1;" },
			children: [imgNode],
		};
	};

	return (tree) => {
		visit(tree, "element", (node, index, parent) => {
			// 如果 <p> 裡有多個 <img>
			if (node.tagName === "p") {
				const imgChildren = node.children.filter(
					(child) => child.tagName === "img",
				);

				if (imgChildren.length > 1) {
					const figures = imgChildren.map(processImg);

					const flexWrapper = {
						type: "element",
						tagName: "div",
						properties: {
							style: "display:flex; justify-content:center; gap:1em; margin:1em 0; flex-wrap:wrap;",
						},
						children: figures,
					};

					parent.children[index] = flexWrapper;
				} else if (
					imgChildren.length === 1 &&
					node.children.length === 1 &&
					node.children[0].tagName === "img"
				) {
					// 單張圖片 → figure
					parent.children[index] = processImg(node.children[0]);
				}
			}
		});
	};
}
