const HOUR = 3600000;
const KEY = "project-summary-v1";

function count(value) {
  if (typeof value !== "number" && typeof value !== "string") throw new Error("Invalid count");
  if (typeof value === "string" && !/^\d+$/.test(value)) throw new Error("Invalid count");
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("Invalid count");
  return result;
}

export function summarize(payload, now) {
  if (!Array.isArray(payload)) throw new Error("Invalid response");
  const rows = payload.find(item => item?.metricName === "Traffic")?.information;
  // 不加維度，只接受單筆全站彙總，避免加總跨維度訪客造成重複計算。
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Missing aggregate Traffic");
  return {
    sessions: count(rows[0].totalSessionCount),
    botSessions: count(rows[0].totalBotSessionCount),
    updatedAt: new Date(now).toISOString(),
    periodHours: 72,
  };
}

export class ClarityStats {
  constructor(state, env) { this.state = state; this.env = env; }

  async fetch(request) {
    if (request.method === "POST") {
      // 此路徑只由 scheduled 透過 DO binding 呼叫，外部 Worker 不轉送 POST。
      if (!this.env.CLARITY_API_TOKEN) return new Response("Missing secret", { status: 503 });
      const now = Date.now();
      const reserved = await this.state.blockConcurrencyWhile(async () => {
        const next = await this.state.storage.get("nextAttempt") || 0;
        if (now < next) return false;
        // 發送前持久化預留，失敗／重啟／重複排程也不會立刻重試。
        await this.state.storage.put("nextAttempt", now + 6 * HOUR);
        return true;
      });
      if (!reserved) return new Response("Cooldown", { status: 202 });
      try {
        const response = await fetch("https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3", {
          headers: { Authorization: `Bearer ${this.env.CLARITY_API_TOKEN}` },
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        if (response.status === 429) {
          await this.state.storage.put("nextAttempt", Date.now() + 24 * HOUR);
          console.warn("Clarity quota reached; updates paused for 24 hours.");
          return new Response("Cooldown", { status: 202 });
        }
        if (!response.ok) {
          console.warn(`Clarity returned HTTP ${response.status}; check Secret and project access.`);
          throw new Error("Upstream failed");
        }
        const snapshot = summarize(await response.json(), now);
        await this.state.storage.put("snapshot", snapshot);
        console.info("Clarity snapshot updated.");
        return new Response("Updated");
      } catch {
        // 不輸出原始回應或 Token，保留上一份有效資料。
        console.warn("Clarity update failed; retaining previous snapshot until next scheduled attempt.");
        return new Response("Update failed", { status: 502 });
      }
    }
    const snapshot = await this.state.storage.get("snapshot");
    if (!snapshot) return Response.json({ status: "unavailable" }, { status: 503 });
    return Response.json({ ...snapshot, stale: Date.now() - Date.parse(snapshot.updatedAt) > 12 * HOUR });
  }
}

function stub(env) { return env.STATS.get(env.STATS.idFromName(KEY)); }

export default {
  async scheduled(_event, env) {
    await stub(env).fetch(new Request("https://internal/refresh", { method: "POST" }));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/stats" || url.search) return new Response("Not found", { status: 404 });
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    // 公開讀取永遠不更新上游，訪客數量不影響 Clarity API 配額。
    const response = await stub(env).fetch(new Request("https://internal/snapshot"));
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN);
    headers.set("Cache-Control", response.ok ? "public, max-age=300" : "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  },
};
