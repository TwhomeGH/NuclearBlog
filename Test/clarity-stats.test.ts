import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { ClarityStats, summarize } from "../workers/clarity-stats/index.mjs";

function setup() {
  const data = new Map();
  let queue = Promise.resolve();
  const state = {
    storage: { get: async (key: string) => data.get(key), put: async (key: string, value: unknown) => { data.set(key, value); } },
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => { const result = queue.then(fn); queue = result.then(() => {}); return result; },
  };
  return { data, object: new ClarityStats(state, { CLARITY_API_TOKEN: "test-token" }) };
}
const refresh = () => new Request("https://internal/refresh", { method: "POST" });
const payload = [{ metricName: "Traffic", information: [{ totalSessionCount: "10", totalBotSessionCount: "2" }] }];
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Clarity export quota and public snapshot", () => {
  it("returns empty cache as a readable state and identifies pre-diagnostics attempts", async () => {
    const { object, data } = setup();
    data.set("nextAttempt", Date.now() + 3600000);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const response = await object.fetch(new Request("https://internal/snapshot"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.hasData).toBe(false);
    expect(body.diagnostics.reason).toBe("legacy_attempt_unknown");
    expect(body.sessions).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("distinguishes missing credentials from waiting for first scheduled update", async () => {
    const { object } = setup();
    const request = new Request("https://internal/snapshot");
    expect((await (await object.fetch(request)).json()).diagnostics.reason).toBe("awaiting_first_update");
    object.env.CLARITY_API_TOKEN = "";
    expect((await (await object.fetch(request)).json()).diagnostics.reason).toBe("missing_token");
  });
  it.each([
    [401, "unauthorized"], [403, "forbidden"], [500, "upstream_http_error"],
  ])("persists HTTP %s without exposing response contents", async (status, reason) => {
    const { object } = setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret-body", { status })));
    await object.fetch(refresh());
    const response = await object.fetch(new Request("https://internal/snapshot"));
    const body = await response.json();
    expect(body.diagnostics.reason).toBe(reason);
    expect(body.diagnostics.upstreamStatus).toBe(status);
    expect(body.diagnostics.lastAttemptAt).toBeTruthy();
    expect(body.diagnostics.nextEligibleAt).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("secret-body");
  });
  it.each([["not json", "invalid_json"], ["[]", "invalid_schema"]])("identifies malformed upstream data", async (payload, reason) => {
    const { object } = setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(payload)));
    await object.fetch(refresh());
    expect((await (await object.fetch(new Request("https://internal/snapshot"))).json()).diagnostics.reason).toBe(reason);
  });
  it("reports scheduled update failure instead of silently resolving", async () => {
    const env = { STATS: { idFromName: () => "fixed", get: () => ({ fetch: async () => Response.json({ reason: "missing_token" }, { status: 503 }) }) } };
    await expect(worker.scheduled({ cron: "17 */6 * * *", scheduledTime: Date.now() }, env)).rejects.toThrow("missing_token");
  });
  it("concurrent updates reserve one request and survive new object instances", async () => {
    const { object } = setup();
    const fetcher = vi.fn().mockResolvedValue(Response.json(payload)); vi.stubGlobal("fetch", fetcher);
    await Promise.all([object.fetch(refresh()), object.fetch(refresh())]);
    await new ClarityStats(object.state, object.env).fetch(refresh());
    expect(fetcher).toHaveBeenCalledTimes(1);
    const result = await (await object.fetch(new Request("https://internal/snapshot"))).json();
    expect(result.sessions).toBe(10); expect(result.periodHours).toBe(72);
    expect(JSON.stringify(result)).not.toContain("test-token");
  });
  it("429 preserves last snapshot and pauses for 24 hours", async () => {
    const { object, data } = setup(); data.set("snapshot", summarize(payload, Date.now()));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    const before = Date.now(); await object.fetch(refresh());
    expect(data.get("nextAttempt")).toBeGreaterThanOrEqual(before + 86400000);
    expect(data.get("snapshot").sessions).toBe(10);
  });
  it("network failures consume a slot and preserve previous data", async () => {
    const { object, data } = setup(); data.set("snapshot", summarize(payload, Date.now()));
    const fetcher = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetcher);
    await object.fetch(refresh()); await object.fetch(refresh());
    expect(fetcher).toHaveBeenCalledTimes(1); expect(data.get("snapshot").sessions).toBe(10);
  });
  it("public GET reads only; POST and query parameters cannot refresh", async () => {
    const reader = vi.fn().mockResolvedValue(Response.json({ status: "unavailable" }, { status: 503 }));
    const env = { ALLOWED_ORIGIN: "https://example.com", STATS: { idFromName: () => "fixed", get: () => ({ fetch: reader }) } };
    expect((await worker.fetch(new Request("https://example.com/stats", { method: "POST" }), env)).status).toBe(405);
    expect((await worker.fetch(new Request("https://example.com/stats?refresh=1"), env)).status).toBe(404);
    expect(reader).not.toHaveBeenCalled();
    const response = await worker.fetch(new Request("https://example.com/stats"), env);
    expect(reader.mock.calls[0][0].method).toBe("GET");
    expect(response.status).toBe(503); expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
  });
  it("rejects missing, dimensioned and malformed aggregates; accepts real zeros", () => {
    expect(() => summarize([], Date.now())).toThrow();
    expect(() => summarize([{ metricName: "Traffic", information: [{}, {}] }], Date.now())).toThrow();
    expect(() => summarize([{ metricName: "Traffic", information: [{ totalSessionCount: null, totalBotSessionCount: "0" }] }], Date.now())).toThrow();
    expect(summarize([{ metricName: "Traffic", information: [{ totalSessionCount: "0", totalBotSessionCount: "0" }] }], Date.now()).sessions).toBe(0);
  });
});
