import { visit } from "unist-util-visit";

/** 保留 JSON 在 HTML 屬性中，由全域客戶端組件按需繪圖。 */
export function remarkEcharts() {
  return (tree) => {
    visit(tree, "code", (node) => {
      if (node.lang !== "echarts") return;
      node.type = "echarts";
      node.data = {
        hName: "interactive-chart",
        hProperties: { "data-echarts": node.value },
        hChildren: [{ type: "element", tagName: "p", properties: {}, children: [{ type: "text", value: "互動圖表載入中…（需要 JavaScript）" }] }],
      };
    });
  };
}
