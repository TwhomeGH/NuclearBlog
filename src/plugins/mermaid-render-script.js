(() => {
	// 单例模式：检查是否已经初始化过
	if (window.mermaidInitialized) {
		// 如果已经初始化过，只确保 renderMermaidDiagrams 函数可用
		if (typeof window.renderMermaidDiagrams !== "function") {
			window.renderMermaidDiagrams = renderMermaidDiagrams;
		}
		return;
	}

	window.mermaidInitialized = true;

	// 记录当前主题状态，避免不必要的重新渲染
	let currentTheme = null;
	let isRendering = false; // 防止并发渲染
	let retryCount = 0;
	const MAX_RETRIES = 3;
	const RETRY_DELAY = 1000; // 1秒

	// 检查主题是否真的发生了变化
	function hasThemeChanged() {
		const isDark = document.documentElement.classList.contains("dark");
		const newTheme = isDark ? "dark" : "default";

		if (currentTheme !== newTheme) {
			currentTheme = newTheme;
			return true;
		}
		return false;
	}

	// 等待 Mermaid 库加载完成
	function waitForMermaid(timeout = 10000) {
		return new Promise((resolve, reject) => {
			const startTime = Date.now();

			function check() {
				if (
					window.mermaid &&
					typeof window.mermaid.initialize === "function"
				) {
					resolve(window.mermaid);
				} else if (Date.now() - startTime > timeout) {
					reject(
						new Error(
							"Mermaid library failed to load within timeout",
						),
					);
				} else {
					setTimeout(check, 100);
				}
			}

			check();
		});
	}

	// 设置 MutationObserver 监听 html 元素的 class 属性变化
	function setupMutationObserver() {
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (
					mutation.type === "attributes" &&
					mutation.attributeName === "class"
				) {
					// 检查是否是 dark 类的变化
					const target = mutation.target;
					const wasDark = mutation.oldValue
						? mutation.oldValue.includes("dark")
						: false;
					const isDark = target.classList.contains("dark");

					if (wasDark !== isDark) {
						if (hasThemeChanged()) {
							// 延迟渲染，避免主题切换时的闪烁
							setTimeout(() => renderMermaidDiagrams(), 150);
						}
					}
				}
			});
		});

		// 开始观察 html 元素的 class 属性变化
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
			attributeOldValue: true,
		});
	}

	// 預設適合文章寬度並鎖定；解除鎖定後才允許移動。
	function attachZoomControls(element, diagramElement) {
		if (element.__zoomAttached) return;
		element.__zoomAttached = true;
		const viewport = document.createElement("div");
		viewport.className = "mermaid-viewport";
		viewport.tabIndex = 0;
		viewport.setAttribute("aria-label", "圖表；預設鎖定，解除鎖定後可移動，按 Escape 適合寬度並鎖定");
		const wrapper = document.createElement("div");
		wrapper.className = "mermaid-zoom-wrapper";
		wrapper.appendChild(diagramElement);
		viewport.appendChild(wrapper);
		const controls = document.createElement("div");
		controls.className = "mermaid-zoom-controls";
		const status = document.createElement("span");
		status.setAttribute("aria-live", "polite");
		const zoomIn = createZoomButton("zoom-in", "放大圖表", "+");
		const zoomOut = createZoomButton("zoom-out", "縮小圖表", "−");
		const lockButton = createZoomButton("lock", "解除鎖定圖表", "解除鎖定");
		controls.append(lockButton, zoomIn, zoomOut, createZoomButton("reset", "適合文章寬度", "適合寬度"), status);
		element.append(controls, viewport);
		let scale = 1;
		let locked = true;
		let tx = 0, ty = 0;
		function pan(x, y) {
			const marginX = viewport.clientWidth * 0.75;
			const marginY = viewport.clientHeight * 0.75;
			tx = Math.max(-wrapper.offsetWidth + viewport.clientWidth - marginX, Math.min(marginX, x));
			ty = Math.max(-wrapper.offsetHeight + viewport.clientHeight - marginY, Math.min(marginY, y));
			wrapper.style.transform = `translate(${tx}px, ${ty}px)`;
		}
		let drag = null;
		function setLocked(value) {
			locked = value;
			if (drag && viewport.hasPointerCapture(drag.id)) viewport.releasePointerCapture(drag.id);
			drag = null;
			viewport.classList.toggle("is-locked", locked);
			viewport.style.overflow = "hidden";
			viewport.style.touchAction = locked ? "pan-y pinch-zoom" : "none";
			lockButton.textContent = locked ? "解除鎖定" : "鎖定位置";
			lockButton.title = locked ? "解除鎖定圖表" : "鎖定圖表位置";
			lockButton.setAttribute("aria-label", lockButton.title);
			lockButton.setAttribute("aria-pressed", String(!locked));
		}
		function setScale(next) {
			scale = Math.max(1, Math.min(4, next));
			wrapper.style.width = `${scale * 100}%`;
			viewport.classList.toggle("is-zoomed", scale > 1);
			viewport.style.maxHeight = scale > 1 ? "70dvh" : "none";
			pan(0, 0);
			status.textContent = `${Math.round(scale * 100)}%`;
			zoomOut.disabled = scale === 1;
			zoomIn.disabled = scale === 4;
		}
		controls.addEventListener("click", (event) => {
			const action = event.target.closest("button")?.dataset.action;
			if (action === "zoom-in") setScale(scale * 1.25);
			if (action === "zoom-out") setScale(scale / 1.25);
			if (action === "reset") { setScale(1); setLocked(true); }
			if (action === "lock") setLocked(!locked);
		});
		viewport.addEventListener("keydown", (event) => {
			if (event.key === "Escape") { event.preventDefault(); setScale(1); setLocked(true); }
			const delta = { ArrowLeft: [24, 0], ArrowRight: [-24, 0], ArrowUp: [0, 24], ArrowDown: [0, -24] };
			if (!locked && delta[event.key]) { event.preventDefault(); pan(tx + delta[event.key][0], ty + delta[event.key][1]); }
			if (locked && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", " "].includes(event.key)) event.preventDefault();
		});
		viewport.addEventListener("pointerdown", (event) => {
			// 解鎖後滑鼠、觸控與觸控筆都可在 100% 直接拖曳。
			if (locked || event.button !== 0 || drag) return;
			event.preventDefault();
			viewport.focus({ preventScroll: true });
			drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: tx, top: ty };
			viewport.setPointerCapture(event.pointerId);
		});
		viewport.addEventListener("pointermove", (event) => {
			if (drag?.id !== event.pointerId) return;
			pan(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
		});
		function finish(event) {
			if (drag?.id !== event.pointerId) return;
			drag = null;
			if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
		}
		viewport.addEventListener("pointerup", finish);
		viewport.addEventListener("pointercancel", finish);
		viewport.addEventListener("lostpointercapture", finish);
		setScale(1);
		setLocked(true);
	}

	function createZoomButton(action, title, label) {
		const button = document.createElement("button");
		button.className = "btn-regular rounded-lg";
		button.type = "button";
		button.setAttribute("aria-label", title);
		button.dataset.action = action;
		button.title = title;
		button.textContent = label;
		return button;
	}

	function createMermaidImage(svg) {
		// Mermaid 的百分比尺寸放進 img 時可能退回 300×150，先依 viewBox 補齊固有比例。
		const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
		const root = doc.documentElement;
		const box = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
		if (box?.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) {
			root.setAttribute("width", String(box[2]));
			root.setAttribute("height", String(box[3]));
			root.style.removeProperty("max-width");
			root.style.removeProperty("width");
			root.style.removeProperty("height");
		}
		const blob = new Blob([new XMLSerializer().serializeToString(root)], { type: "image/svg+xml" });
		const objectUrl = URL.createObjectURL(blob);
		const image = document.createElement("img");

		image.src = objectUrl;
		image.alt = "Mermaid diagram";
		image.className = "mermaid-rendered-svg";
		image.style.width = "100%";
		image.style.maxWidth = "100%";
		image.style.height = "auto";
		image.draggable = false;

		image.addEventListener(
			"load",
			() => URL.revokeObjectURL(objectUrl),
			{ once: true },
		);

		return image;
	}

	function setElementText(element, className, text) {
		element.textContent = "";
		const message = document.createElement("div");
		message.className = className;
		message.textContent = text;
		element.appendChild(message);
	}

	// 设置其他事件监听器
	function setupEventListeners() {
		// 监听页面切换
		document.addEventListener("astro:page-load", () => {
			// 重新初始化主题状态
			currentTheme = null;
			retryCount = 0; // 重置重试计数
			if (hasThemeChanged()) {
				setTimeout(() => renderMermaidDiagrams(), 100);
			}
		});

		// 监听页面可见性变化，页面重新可见时重新渲染
		document.addEventListener("visibilitychange", () => {
			if (!document.hidden) {
				setTimeout(() => renderMermaidDiagrams(), 200);
			}
		});
	}

	async function initializeMermaid() {
		try {
			await waitForMermaid();

			// 初始化 Mermaid 配置
			window.mermaid.initialize({
				startOnLoad: false,
				theme: "default",
				themeVariables: {
					fontFamily: "inherit",
					fontSize: "16px",
				},
				securityLevel: "strict",
				// 添加错误处理配置
				errorLevel: "warn",
				logLevel: "error",
			});

			// 渲染所有 Mermaid 图表
			await renderMermaidDiagrams();
		} catch (error) {
			console.error("Failed to initialize Mermaid:", error);
			// 如果初始化失败，尝试重新加载
			if (retryCount < MAX_RETRIES) {
				retryCount++;
				setTimeout(() => initializeMermaid(), RETRY_DELAY * retryCount);
			}
		}
	}

	async function renderMermaidDiagrams() {
		// 防止并发渲染
		if (isRendering) {
			return;
		}

		// 检查 Mermaid 是否可用
		if (!window.mermaid || typeof window.mermaid.render !== "function") {
			console.warn("Mermaid not available, skipping render");
			return;
		}

		isRendering = true;

		try {
			const mermaidElements = document.querySelectorAll(
				".mermaid[data-mermaid-code]",
			);

			if (mermaidElements.length === 0) {
				isRendering = false;
				return;
			}

			// 延迟检测主题，确保 DOM 已经更新
			await new Promise((resolve) => setTimeout(resolve, 100));

			const htmlElement = document.documentElement;
			const isDark = htmlElement.classList.contains("dark");
			const theme = isDark ? "dark" : "default";

			// 更新 Mermaid 主题（只需要更新一次）
			window.mermaid.initialize({
				startOnLoad: false,
				theme: theme,
				themeVariables: {
					fontFamily: "inherit",
					fontSize: "16px",
					// 强制应用主题变量
					primaryColor: isDark ? "#ffffff" : "#000000",
					primaryTextColor: isDark ? "#ffffff" : "#000000",
					primaryBorderColor: isDark ? "#ffffff" : "#000000",
					lineColor: isDark ? "#ffffff" : "#000000",
					secondaryColor: isDark ? "#333333" : "#f0f0f0",
					tertiaryColor: isDark ? "#555555" : "#e0e0e0",
				},
				securityLevel: "strict",
				errorLevel: "warn",
				logLevel: "error",
			});

			// 批量渲染所有图表，添加重试机制
			const renderPromises = Array.from(mermaidElements).map(
				async (element, index) => {
					let attempts = 0;
					const maxAttempts = 3;

					while (attempts < maxAttempts) {
						try {
							const code =
								element.getAttribute("data-mermaid-code");

							if (!code) {
								break;
							}

							// 显示加载状态
							setElementText(
								element,
								"mermaid-loading",
								"Rendering diagram...",
							);

							// 渲染图表
							const { svg } = await window.mermaid.render(
								`mermaid-${Date.now()}-${index}-${attempts}`,
								code,
							);

							const diagramImage = createMermaidImage(svg);

							element.textContent = "";
							element.__zoomAttached = false;
							element.appendChild(diagramImage);

							// 添加响应式支持
							diagramImage.style.filter = isDark
								? "brightness(0.9) contrast(1.1)"
								: "none";
							attachZoomControls(element, diagramImage);

							// 渲染成功，跳出重试循环
							break;
						} catch (error) {
							attempts++;
							console.warn(
								`Mermaid rendering attempt ${attempts} failed for element ${index}:`,
								error,
							);

							if (attempts >= maxAttempts) {
								console.error(
									`Failed to render Mermaid diagram after ${maxAttempts} attempts:`,
									error,
								);
								element.textContent = "";
								const errorContainer =
									document.createElement("div");
								errorContainer.className = "mermaid-error";

								const errorText = document.createElement("p");
								errorText.textContent = `Failed to render diagram after ${maxAttempts} attempts.`;

								const retryButton =
									document.createElement("button");
								retryButton.textContent = "Retry Page";
								retryButton.style.marginTop = "8px";
								retryButton.style.padding = "4px 8px";
								retryButton.style.background = "var(--primary)";
								retryButton.style.color = "white";
								retryButton.style.border = "none";
								retryButton.style.borderRadius = "4px";
								retryButton.style.cursor = "pointer";
								retryButton.addEventListener("click", () =>
									location.reload(),
								);

								errorContainer.append(errorText, retryButton);
								element.appendChild(errorContainer);
							} else {
								// 等待一段时间后重试
								await new Promise((resolve) =>
									setTimeout(resolve, 500 * attempts),
								);
							}
						}
					}
				},
			);

			// 等待所有渲染完成
			await Promise.all(renderPromises);
			retryCount = 0; // 重置重试计数
		} catch (error) {
			console.error("Error in renderMermaidDiagrams:", error);

			// 如果渲染失败，尝试重新渲染
			if (retryCount < MAX_RETRIES) {
				retryCount++;
				setTimeout(
					() => renderMermaidDiagrams(),
					RETRY_DELAY * retryCount,
				);
			}
		} finally {
			isRendering = false;
		}
	}

	// 初始化主题状态
	function initializeThemeState() {
		const isDark = document.documentElement.classList.contains("dark");
		currentTheme = isDark ? "dark" : "default";
	}

	// 加载 Mermaid 库
	async function loadMermaid() {
		if (typeof window.mermaid !== "undefined") {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src =
				"https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";

			script.onload = () => {
				console.log("Mermaid library loaded successfully");
				resolve();
			};

			script.onerror = (error) => {
				console.error("Failed to load Mermaid library:", error);
				// 尝试备用 CDN
				const fallbackScript = document.createElement("script");
				fallbackScript.src =
					"https://unpkg.com/mermaid@11/dist/mermaid.min.js";

				fallbackScript.onload = () => {
					console.log("Mermaid library loaded from fallback CDN");
					resolve();
				};

				fallbackScript.onerror = () => {
					reject(
						new Error(
							"Failed to load Mermaid from both primary and fallback CDNs",
						),
					);
				};

				document.head.appendChild(fallbackScript);
			};

			document.head.appendChild(script);
		});
	}

	// 主初始化函数
	async function initialize() {
		try {
			// 设置监听器
			setupMutationObserver();
			setupEventListeners();

			// 初始化主题状态
			initializeThemeState();

			// 加载并初始化 Mermaid
			await loadMermaid();
			await initializeMermaid();

			// 将 renderMermaidDiagrams 暴露到全局作用域，以便在解密后调用
			window.renderMermaidDiagrams = renderMermaidDiagrams;
		} catch (error) {
			console.error("Failed to initialize Mermaid system:", error);
		}
	}

	// 启动初始化
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initialize);
	} else {
		initialize();
	}
})();
