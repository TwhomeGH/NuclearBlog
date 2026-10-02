import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

// 外掛的 flat config 可能是單一物件或陣列，統一展開。
const asArray = (config) => (Array.isArray(config) ? config : [config]);

export default tseslint.config(
	{
		ignores: [
			"dist/**",
			".astro/**",
			"node_modules/**",
			"public/**",
			"**/*.css",
		],
	},
	js.configs.recommended,
	...asArray(tseslint.configs.recommended),
	...asArray(astro.configs["flat/recommended"]),
	...asArray(svelte.configs["flat/recommended"]),
	...asArray(svelte.configs["flat/prettier"]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			// 沿用舊 biome.json 的規則意圖
			"no-param-reassign": "error",
			"prefer-const": "error",
			"no-else-return": "error",
			"object-shorthand": "error",
			"no-useless-rename": "error",
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-empty-object-type": "off",
		},
	},
	{
		// 與舊 biome.json 一致：在樣板檔關掉會誤報的規則
		files: ["**/*.astro", "**/*.svelte", "**/*.vue"],
		rules: {
			"prefer-const": "off",
			"@typescript-eslint/no-unused-vars": "off",
		},
	},
	{
		// TS 型別（例如 ImageMetadata、EventListener、NodeJS）由 tsc 檢查，
		// no-undef 在 TS/樣板檔會誤報，依 typescript-eslint 官方建議關閉。
		files: ["**/*.{ts,tsx,mts,cts,astro,svelte,vue}"],
		rules: {
			"no-undef": "off",
		},
	},
	{
		// Astro 的 env.d.ts 慣例就是 triple-slash reference。
		files: ["**/*.d.ts"],
		rules: {
			"@typescript-eslint/triple-slash-reference": "off",
		},
	},
	{
		files: ["**/*.svelte"],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
			},
		},
	},
);
