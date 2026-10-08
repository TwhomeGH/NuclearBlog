import { describe, expect, it } from "vitest";
import { albumInfoSchema, externalPhotoSchema } from "../src/utils/album-schema";
import { parseChartOption, getLegendSelection } from "../src/utils/echarts-option";

describe("相簿資料邊界", () => {
 it("接受本地與外鏈相簿", () => {
  expect(albumInfoSchema.parse({ title: "旅行", mode: "local" }).title).toBe("旅行");
  expect(externalPhotoSchema.parse({ src: "https://example.com/a.jpg", tags: ["風景"] }).tags).toEqual(["風景"]);
 });
 it.each([null, [], { tags: "風景" }, { columns: -1 }, { photos: {} }])("拒絕格式錯誤的相簿 %j", value => {
  expect(albumInfoSchema.safeParse(value).success).toBe(false);
 });
 it.each([null, {}, { src: 12 }, { src: "" }, { src: "a.jpg", width: "100" }])("拒絕格式錯誤的照片 %j", value => {
  expect(externalPhotoSchema.safeParse(value).success).toBe(false);
 });
});

describe("文章圖表資料邊界", () => {
 it("保留多座標與額外 ECharts 設定", () => {
  const value = { title: [{ text: "趨勢" }], xAxis: [{ data: ["一", "二"] }], series: [{ type: "line", data: [1, { value: 2 }] }], dataZoom: [{ type: "inside" }] };
  expect(parseChartOption(JSON.stringify(value))).toEqual(value);
 });
 it.each([null, [], {}, { series: [] }, { series: [null] }, { series: [{type: "line", data: {}}] }, {series: [{type: "line"}], title: {text: 123}}, {series: [{type: "line"}], grid: 10}])("拒絕不安全的閱讀器輸入 %j", value => {
  expect(() => parseChartOption(JSON.stringify(value))).toThrow();
 });
 it("保留合法圖例選取狀態", () => {
  expect(getLegendSelection([{ selected: { A: false, B: true } }])).toEqual({ A: false, B: true });
  expect(getLegendSelection([{ selected: { A: "false" } }])).toBeUndefined();
  expect(getLegendSelection(undefined)).toBeUndefined();
 });
});
