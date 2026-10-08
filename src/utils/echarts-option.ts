import type { EChartsOption, SeriesOption } from "echarts";

export function isRecord(value: unknown): value is Record<string, unknown> {
 return value !== null && typeof value === "object" && !Array.isArray(value);
}

type ChartSeries = SeriesOption & { name?: string; data?: unknown[] };
export type ArticleChartOption = EChartsOption & { series: ChartSeries[] };

// 檢查閱讀器會存取的結構；其他 ECharts 選項保留給套件解析。
export function parseChartOption(source: string): ArticleChartOption {
 const option: unknown = JSON.parse(source);
 if (!isRecord(option) || !Array.isArray(option.series) || !option.series.length) {
  throw new Error("請提供 JSON 物件及非空的 series 陣列。");
 }
 for (const series of option.series) {
  if (!isRecord(series) || typeof series.type !== "string" ||
      (series.name !== undefined && typeof series.name !== "string") ||
      (series.data !== undefined && !Array.isArray(series.data))) {
   throw new Error("series 必須包含 type 字串，data 必須是陣列。");
  }
 }
 for (const key of ["title", "legend", "grid", "xAxis", "yAxis", "tooltip"]) {
  const value = option[key];
  if (value !== undefined && !isRecord(value) && !(Array.isArray(value) && value.every(isRecord))) {
   throw new Error(`${key} 必須是物件或物件陣列。`);
  }
 }
 const titles = Array.isArray(option.title) ? option.title : [option.title];
 for (const title of titles) {
  if (!isRecord(title)) continue;
  for (const key of ["text", "subtext"]) {
   if (title[key] !== undefined && typeof title[key] !== "string") throw new Error(`title.${key} 必須是字串。`);
  }
 }
 // JSON 不含函式；此處只宣告套件接受的選項形狀，並非驗證所有圖表類型的完整 schema。
 return option as ArticleChartOption;
}

export function getLegendSelection(value: unknown): Record<string, boolean> | undefined {
 if (!Array.isArray(value) || !isRecord(value[0]) || !isRecord(value[0].selected)) return;
 const selected = value[0].selected;
 if (!Object.values(selected).every(item => typeof item === "boolean")) return;
 return selected as Record<string, boolean>;
}
