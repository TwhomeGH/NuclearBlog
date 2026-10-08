import { parseChartOption, isRecord, getLegendSelection } from "../utils/echarts-option";
import type { ECharts, EChartsOption, ECElementEvent } from "echarts";

// 只有頁面包含圖表時才下載 ECharts；由本站提供，不依賴外部 CDN。
let library: Promise<typeof import("echarts")> | undefined;
function loadLibrary() {
  return library ??= import("echarts").catch((error) => { library = undefined; throw error; });
}

class InteractiveChart extends HTMLElement {
  private chart?: ECharts;
  private resize?: ResizeObserver;
  private theme?: MutationObserver;
  private generation = 0;

  connectedCallback() { void this.mount(); }
  disconnectedCallback() {
    this.generation++;
    this.resize?.disconnect();
    this.theme?.disconnect();
    this.chart?.dispose();
    this.chart = undefined;
  }

  private async mount() {
    const generation = ++this.generation;
    const current = () => this.isConnected && generation === this.generation;
    try {
      const option = parseChartOption(this.getAttribute("data-echarts") || "null");
      const echarts = await loadLibrary();
      if (!current()) return;
      this.replaceChildren();
      const hint = document.createElement("p");
      hint.className = "echarts-hint";
      hint.textContent = "滑鼠移入或點選資料點查看數值；點圖例切換系列。鍵盤可聚焦圖表後使用左右方向鍵。";
      const stage = document.createElement("div");
      stage.className = "echarts-stage";
      stage.tabIndex = 0;
      stage.setAttribute("role", "region");
      const title = !Array.isArray(option.title) && typeof option.title?.text === "string" ? option.title.text : "互動圖表";
      stage.setAttribute("aria-label", title);
      const selection = document.createElement("p");
      selection.className = "echarts-selection";
      selection.setAttribute("aria-live", "polite");
      selection.textContent = "尚未選取資料點";
      this.append(hint, stage, selection);
      const categories = !Array.isArray(option.xAxis) && option.xAxis && "data" in option.xAxis && Array.isArray(option.xAxis.data) ? option.xAxis.data : [];
      let index = -1;
      const describe = (i: number) => {
        const values = option.series.map((series) => {
          const item = series.data?.[i];
          const value = isRecord(item) ? item.value : item;
          return `${series.name || "資料"}：${Array.isArray(value) ? value.join(" / ") : value ?? "無資料"}`;
        });
        selection.textContent = `${categories[i] ?? i + 1} — ${values.join("；")}`;
      };
      const base: EChartsOption = {
        grid: { left: 16, right: 24, top: 100, bottom: 36, containLabel: true },
        legend: { top: 42, type: "scroll" },
        ...option,
        tooltip: { trigger: "axis", triggerOn: "mousemove|click|mousewheel", confine: true, ...option.tooltip, renderMode: "richText" },
        aria: { enabled: true },
        animation: !matchMedia("(prefers-reduced-motion: reduce)").matches,
        series: option.series.map((series) => ({ showSymbol: true, symbolSize: 10, ...series })),
      };
      // 以實際文字尺寸保留標題、副標題、圖例和座標名稱的間距。
      const layout = (): EChartsOption => {
        if (Array.isArray(option.title) || Array.isArray(option.legend) || Array.isArray(option.grid)) return {};
        const width = Math.max(100, stage.clientWidth - 24);
        const rawTitle = option.title || {};
        const textStyle = { fontSize: stage.clientWidth < 480 ? 16 : 18, lineHeight: 24, width, overflow: "break" as const, ...rawTitle.textStyle };
        const subtextStyle = { fontSize: 12, lineHeight: 18, width, overflow: "break" as const, ...rawTitle.subtextStyle };
        const height = (text: string | undefined, style: NonNullable<ConstructorParameters<typeof echarts.graphic.Text>[0]>["style"]) => text ? new echarts.graphic.Text({ style: { text, ...style } }).getBoundingRect().height : 0;
        const titleTop = typeof rawTitle.top === "number" ? rawTitle.top : 8;
        const itemGap = rawTitle.itemGap ?? 8;
        const titleHeight = rawTitle.show === false ? 0 : height(rawTitle.text, textStyle) + (rawTitle.subtext ? itemGap + height(rawTitle.subtext, subtextStyle) : 0);
        const titleBottom = titleHeight ? titleTop + titleHeight + 10 : 0;
        const rawLegend = option.legend || {};
        const legendTop = Math.max(typeof rawLegend.top === "number" ? rawLegend.top : 0, titleBottom + 12);
        const gridTop = Math.max(typeof option.grid?.top === "number" ? option.grid.top : 0, legendTop + (rawLegend.show === false ? 28 : 60));
        stage.style.minHeight = `${gridTop + 240}px`;
        return {
          title: { top: 8, itemGap: 8, ...rawTitle, textStyle, subtextStyle },
          legend: { type: "scroll", left: "center", ...rawLegend, top: typeof rawLegend.top === "string" ? rawLegend.top : legendTop },
          grid: { left: 16, right: 24, bottom: 36, containLabel: true, ...option.grid, top: typeof option.grid?.top === "string" ? option.grid.top : gridTop },
        };
      };
      let dark = document.documentElement.classList.contains("dark");
      const draw = () => {
        const selected = getLegendSelection(this.chart?.getOption().legend);
        this.chart?.dispose();
        const spacing = layout();
        this.chart = echarts.init(stage, dark ? "dark" : undefined, { renderer: "svg" });
        this.chart.setOption({ ...base, ...spacing, backgroundColor: "transparent" });
        if (selected) this.chart.setOption({ legend: { selected } });
        this.chart.on("click", (params: ECElementEvent) => {
          if (params.componentType !== "series") return;
          index = params.dataIndex;
          describe(index);
        });
      };
      draw();
      stage.addEventListener("keydown", (event) => {
        if (!categories.length || !["ArrowLeft", "ArrowRight", "Escape"].includes(event.key)) return;
        event.preventDefault();
        if (event.key === "Escape") { this.chart?.dispatchAction({ type: "hideTip" }); return; }
        index = (index + (event.key === "ArrowRight" ? 1 : -1) + categories.length) % categories.length;
        describe(index);
        this.chart?.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: index });
      });
      let lastWidth = stage.clientWidth;
      this.resize = new ResizeObserver(() => {
        if (stage.clientWidth !== lastWidth) { lastWidth = stage.clientWidth; this.chart?.setOption(layout()); }
        this.chart?.resize();
      });
      this.resize.observe(stage);
      this.theme = new MutationObserver(() => {
        const next = document.documentElement.classList.contains("dark");
        if (next !== dark) { dark = next; draw(); }
      });
      this.theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      this.dataset.ready = "true";
    } catch (error) {
      if (!current()) return;
      this.chart?.dispose();
      this.replaceChildren();
      const message = document.createElement("p");
      message.textContent = `圖表無法載入：${error instanceof Error ? error.message : "請檢查 JSON 語法"}`;
      message.setAttribute("role", "alert");
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "重試";
      retry.addEventListener("click", () => { void this.mount(); }, { once: true });
      this.append(message, retry);
    }
  }
}
if (!customElements.get("interactive-chart")) customElements.define("interactive-chart", InteractiveChart);
