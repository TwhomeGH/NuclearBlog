import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import { loadEnv } from "./load-env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv();

const MAX_URLS_PER_REQUEST = 10000; // IndexNow API 限制最大 10000 个 URL
const MAX_TOTAL_URLS = 50000;

function normalizeIndexNowHost(value) {
	const host = String(value || "")
		.trim()
		.toLowerCase();
	if (!/^[a-z0-9.-]+(?::\d{1,5})?$/.test(host)) {
		throw new Error("INDEXNOW_HOST contains unsupported characters");
	}
	return host;
}

function normalizeIndexNowKey(value) {
	const key = String(value || "").trim();
	if (!/^[a-zA-Z0-9_-]{8,128}$/.test(key)) {
		throw new Error("INDEXNOW_KEY contains unsupported characters");
	}
	return key;
}

function normalizeSubmitUrl(urlText, expectedHost) {
	const url = new URL(String(urlText || "").trim());
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new Error(`Unsupported sitemap URL protocol: ${url.protocol}`);
	}
	if (url.host.toLowerCase() !== expectedHost) {
		throw new Error(
			`Sitemap URL host does not match INDEXNOW_HOST: ${url.host}`,
		);
	}
	url.hash = "";
	return url.toString();
}

function getValidatedSitemapUrls(sitemapPath, expectedHost) {
	const sitemapContent = fs.readFileSync(sitemapPath, "utf-8");
	const sitemap = parse(sitemapContent, {
		blockTextElements: {
			script: false,
			style: false,
			pre: false,
		},
	});
	const urls = [];

	for (const node of sitemap.querySelectorAll("loc")) {
		if (urls.length >= MAX_TOTAL_URLS) {
			console.warn(
				`⚠ Sitemap URL limit reached (${MAX_TOTAL_URLS}), remaining URLs skipped`,
			);
			break;
		}
		try {
			urls.push(normalizeSubmitUrl(node.textContent, expectedHost));
		} catch (error) {
			console.warn(`⚠ Skipping sitemap URL: ${error.message}`);
		}
	}

	const uniqueUrls = [...new Set(urls)];
	if (uniqueUrls.length === 0) {
		console.error("❌ No URLs found in sitemap");
		return [];
	}

	console.log(`✓ Parsed ${uniqueUrls.length} allowed URLs from sitemap`);
	return uniqueUrls;
}

function buildIndexNowPayload({ host, apiKey, urls }) {
	return {
		host,
		key: apiKey,
		keyLocation: new URL(`/${apiKey}.txt`, `https://${host}`).toString(),
		urlList: urls,
	};
}

// 提交 URL 到 Bing IndexNow API
async function submitToIndexNow(urls) {
	if (!urls || urls.length === 0) {
		console.log("⚠ No URLs to submit");
		return;
	}

	const urlChunks = [];

	for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
		urlChunks.push(urls.slice(i, i + MAX_URLS_PER_REQUEST));
	}

	if (!process.env.INDEXNOW_KEY || !process.env.INDEXNOW_HOST) {
		console.error(
			"❌ Missing required environment variables: INDEXNOW_KEY or INDEXNOW_HOST",
		);
		console.error("   Please configure these variables in the .env file");
		return;
	}

	const apiKey = normalizeIndexNowKey(process.env.INDEXNOW_KEY);
	const host = normalizeIndexNowHost(process.env.INDEXNOW_HOST);

	for (let i = 0; i < urlChunks.length; i++) {
		const chunk = urlChunks[i];
		console.log(
			`\n📊 Submitting batch ${i + 1}/${urlChunks.length} URLs (${chunk.length} URLs)...`,
		);

		try {
			const response = await fetch("https://api.indexnow.org/IndexNow", {
				method: "POST",
				headers: {
					"Content-Type": "application/json; charset=utf-8",
				},
				// lgtm[js/file-access-to-http] Sitemap URLs are intentionally
				// submitted to IndexNow after validation, canonicalization, and caps.
				body: JSON.stringify(
					buildIndexNowPayload({ host, apiKey, urls: chunk }),
				),
			});

			if (response.status === 200) {
				console.log(`✅ Batch ${i + 1} URLs submitted successfully`);
			} else if (response.status === 202) {
				console.warn(
					`⚠ Batch ${i + 1} request accepted but still processing (Status code: ${response.status})`,
				);
				console.warn(
					"This is not a standard success status code, you may need to check API documentation",
				);
			} else {
				console.error(
					`❌ Batch ${i + 1} URLs submission failed, Status code: ${response.status}`,
				);
				const responseBody = await response.text();
				console.error(`   Response body: ${responseBody}`);

				// 根据状态码提供更详细的错误信息
				switch (response.status) {
					case 400:
						console.error("   Error: Request format is invalid");
						break;
					case 403:
						console.error(
							"   Error: API key is invalid or authentication failed",
						);
						break;
					case 422:
						console.error(
							"   Error: URL does not belong to specified host or key mismatch",
						);
						break;
					case 429:
						console.error(
							"   Error: Request too frequent, may be considered as spam",
						);
						break;
					default:
						console.error(
							`   Error: Other error, status code ${response.status}`,
						);
				}
			}
		} catch (error) {
			console.error(
				`❌ Error occurred during batch ${i + 1} URL submission:`,
				error.message,
			);
		}
	}
}

// 主函数
async function main() {
	console.log("🚀 Starting Bing IndexNow URL submission task...\n");

	// 构建输出目录路径
	const distDir = path.join(__dirname, "../dist");
	const sitemapPath = path.join(distDir, "sitemap-0.xml");

	if (!fs.existsSync(sitemapPath)) {
		console.error(`❌ Sitemap file not found: ${sitemapPath}`);
		console.error(
			"   Please ensure the project is built before running this script",
		);
		process.exit(1);
	}

	try {
		if (!process.env.INDEXNOW_KEY || !process.env.INDEXNOW_HOST) {
			console.error(
				"❌ Missing required environment variables: INDEXNOW_KEY or INDEXNOW_HOST",
			);
			console.error(
				"   Please configure these variables in the .env file",
			);
			return;
		}

		const host = normalizeIndexNowHost(process.env.INDEXNOW_HOST);
		const urls = getValidatedSitemapUrls(sitemapPath, host);

		if (urls.length === 0) {
			console.log(
				"⚠ No URLs matching the host found, skipping submission",
			);
			return;
		}

		// 提交 URL 到 IndexNow
		await submitToIndexNow(urls);

		console.log("\n🎉 Bing IndexNow URL submission task completed!");
	} catch (error) {
		console.error("❌ Error occurred during execution:", error.message);
		process.exit(1);
	}
}

// 运行主函数
await main();
