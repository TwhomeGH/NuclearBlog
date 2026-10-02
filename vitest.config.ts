import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
	resolve: {
		// 對齊 tsconfig.json 的 paths，讓測試能用同樣的別名匯入。
		alias: {
			"@components": r("./src/components"),
			"@assets": r("./src/assets"),
			"@constants": r("./src/constants"),
			"@utils": r("./src/utils"),
			"@i18n": r("./src/i18n"),
			"@layouts": r("./src/layouts"),
			"@": r("./src"),
		},
	},
	test: {
		include: ["Test/**/*.test.ts"],
		environment: "node",
	},
});
