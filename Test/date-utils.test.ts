import { describe, expect, it } from "vitest";
import { formatDateToYYYYMMDD } from "@utils/date-utils";

describe("formatDateToYYYYMMDD", () => {
	it("以 UTC 輸出 YYYY-MM-DD", () => {
		expect(formatDateToYYYYMMDD(new Date("2026-10-01T00:00:00Z"))).toBe(
			"2026-10-01",
		);
	});

	it("月/日補零", () => {
		expect(formatDateToYYYYMMDD(new Date("2026-01-05T12:34:56Z"))).toBe(
			"2026-01-05",
		);
	});

	it("跨日邊界以 UTC 為準", () => {
		expect(formatDateToYYYYMMDD(new Date("2026-10-01T23:59:59Z"))).toBe(
			"2026-10-01",
		);
	});
});
