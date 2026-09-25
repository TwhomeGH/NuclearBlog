export type FloatingPosition = { x: number; y: number };
export type FloatingPanelOptions = { key: string; side: "left" | "right" };
const clamp = (value: number, max = 1) => Math.max(0, Math.min(max, value));

export function readFloatingPosition(value: string | null, fallback: FloatingPosition): FloatingPosition {
	try {
		const saved = JSON.parse(value || "null");
		if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return { x: clamp(saved.x), y: clamp(saved.y) };
	} catch { /* 儲存空間不可用時保留預設位置。 */ }
	return { ...fallback };
}

/** Astro 與 Svelte 共用：只從專用把手拖曳，避免攔截播放及文章捲動。 */
export function floatingPanel(node: HTMLElement, options: FloatingPanelOptions) {
	const defaults = { x: options.side === "left" ? 0 : 1, y: 1 };
	let position = { ...defaults };
	try { position = readFloatingPosition(localStorage.getItem(options.key), defaults); } catch { /* noop */ }
	const events = new AbortController();
	let frame = 0;
	let suppressClick = false;
	let drag: { id: number; x: number; y: number; left: number; top: number; handle: HTMLElement; moved: boolean } | null = null;
	function bounds() {
		const viewport = window.visualViewport;
		const width = viewport?.width ?? document.documentElement.clientWidth;
		const height = viewport?.height ?? window.innerHeight;
		const left = (viewport?.offsetLeft ?? 0) + 16;
		const top = (viewport?.offsetTop ?? 0) + 16;
		return { left, top, x: Math.max(0, width - node.offsetWidth - 32), y: Math.max(0, height - node.offsetHeight - 32) };
	}
	function place() {
		const b = bounds();
		node.style.left = `${b.left + position.x * b.x}px`;
		node.style.top = `${b.top + position.y * b.y}px`;
		node.style.right = "auto";
		node.style.bottom = "auto";
	}
	function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(place); }
	function save() { try { localStorage.setItem(options.key, JSON.stringify(position)); } catch { /* noop */ } }
	function move(left: number, top: number) {
		const b = bounds();
		position = { x: b.x ? clamp((left - b.left) / b.x) : position.x, y: b.y ? clamp((top - b.top) / b.y) : position.y };
		place();
	}
	function reset() { position = { ...defaults }; place(); save(); }
	const listenerOptions = { signal: events.signal };
	node.addEventListener("pointerdown", (event) => {
		const handle = (event.target as Element).closest<HTMLElement>("[data-floating-drag]");
		if (!handle || event.button !== 0 || drag) return;
		event.preventDefault();
		suppressClick = false;
		handle.focus({ preventScroll: true });
		const rect = node.getBoundingClientRect();
		drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, handle, moved: false };
		handle.setPointerCapture(event.pointerId);
		node.dataset.dragging = "true";
	}, listenerOptions);
	node.addEventListener("pointermove", (event) => {
		if (drag?.id !== event.pointerId) return;
		if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
		drag.moved = true;
		move(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
	}, listenerOptions);
	function finish(event: PointerEvent) {
		if (drag?.id !== event.pointerId) return;
		suppressClick = drag.moved;
		const handle = drag.handle;
		drag = null;
		delete node.dataset.dragging;
		if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
		save();
	}
	node.addEventListener("pointerup", finish, listenerOptions);
	node.addEventListener("pointercancel", finish, listenerOptions);
	node.addEventListener("lostpointercapture", finish, listenerOptions);
	node.addEventListener("keydown", (event) => {
		if (!(event.target as Element).closest("[data-floating-drag]")) return;
		const step = event.shiftKey ? 8 : 24;
		const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
		if (event.key === "Home") { event.preventDefault(); reset(); }
		if (delta[event.key]) {
			event.preventDefault();
			const rect = node.getBoundingClientRect();
			move(rect.left + delta[event.key][0], rect.top + delta[event.key][1]); save();
		}
	}, listenerOptions);
	node.addEventListener("click", (event) => {
        if (suppressClick && event.detail !== 0 && (event.target as Element).closest("[data-floating-drag]")) {
            event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false;
        }
    }, { ...listenerOptions, capture: true });
    node.addEventListener("click", (event) => {
		if ((event.target as Element).closest("[data-floating-reset]")) reset();
	}, listenerOptions);
	window.addEventListener("resize", schedule, listenerOptions);
	window.visualViewport?.addEventListener("resize", schedule, listenerOptions);
	window.visualViewport?.addEventListener("scroll", schedule, listenerOptions);
	const resize = new ResizeObserver(schedule);
	resize.observe(node);
	place();
	return { destroy() { events.abort(); resize.disconnect(); cancelAnimationFrame(frame); } };
}