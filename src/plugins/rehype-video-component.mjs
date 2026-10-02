/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * @breif 建立視頻組件
 *
 * @param {*} properties
 * @param {*} children
 * @returns
 */

export function VideoComponent(properties = {}, children = []) {
	return h(
		"video",
		{
			src: properties.src,
			controls: properties.controls !== "false",
			autoplay: properties.autoplay === "true",
			loop: properties.loop === "true",
			muted: properties.muted === "true",
			playsinline: properties.playsinline !== "false",
			preload: properties.preload || "metadata",
			poster: properties.poster,
			style: properties.style,
			className: properties.className || properties.class,
		},
		children,
	);
}
