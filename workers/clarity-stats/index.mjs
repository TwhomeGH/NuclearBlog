const HOUR = 3600000;
const KEY = "project-summary-v1";

function log(event, fields = {}) {
  console.log(JSON.stringify({ service: "clarity-stats", event, ...fields }));
}

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

  async outcome(reason, details = {}) {
    const result = { reason, recordedAt: new Date().toISOString(), ...details };
    await this.state.storage.put("diagnostics", result);
    log("refresh_result", result);
    return result;
  }

  async fetch(request) {
    if (request.method === "POST") {
      // 此路徑只由 scheduled 透過 DO binding 呼叫，外部 Worker 不轉送 POST。
      if (!this.env.CLARITY_API_TOKEN?.trim()) {
        return Response.json(await this.outcome("missing_token"), { status: 503 });
      }
      const now = Date.now();
      const reserved = await this.state.blockConcurrencyWhile(async () => {
        const next = await this.state.storage.get("nextAttempt") || 0;
        if (now < next) return false;
        // 發送前持久化預留，失敗／重啟／重複排程也不會立刻重試。
        await this.state.storage.put("nextAttempt", now + 6 * HOUR);
        await this.state.storage.put("lastAttemptAt", new Date(now).toISOString());
        await this.state.storage.put("diagnostics", { reason: "updating", recordedAt: new Date(now).toISOString() });
        return true;
      });
      if (!reserved) {
        log("refresh_skipped", { reason: "cooldown", nextEligibleAt: new Date(await this.state.storage.get("nextAttempt")).toISOString() });
        return Response.json({ reason: "cooldown" }, { status: 202 });
      }
      log("refresh_started", { periodHours: 72, attemptAt: new Date(now).toISOString() });
      let phase = "network";
      let upstreamStatus;
      try {
        const response = await fetch("https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3", {
          headers: { Authorization: `Bearer ${this.env.CLARITY_API_TOKEN}` },
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        upstreamStatus = response.status;
        if (response.status === 429) {
          await this.state.storage.put("nextAttempt", Date.now() + 24 * HOUR);
          return Response.json(await this.outcome("rate_limited", { upstreamStatus }), { status: 429 });
        }
        if (!response.ok) {
          const reason = response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "upstream_http_error";
          return Response.json(await this.outcome(reason, { upstreamStatus }), { status: 502 });
        }
        phase = "json";
        const payload = await response.json();
        phase = "schema";
        const snapshot = summarize(payload, now);
        phase = "storage";
        await this.state.storage.put("snapshot", snapshot);
        return Response.json(await this.outcome("updated", { upstreamStatus, durationMs: Date.now() - now }));
      } catch (error) {
        // 不輸出原始回應或 Token，保留上一份有效資料。
        const reason = phase === "json" ? "invalid_json" : phase === "schema" ? "invalid_schema" : phase === "storage" ? "storage_error" : error?.name === "TimeoutError" ? "timeout" : "network_error";
        return Response.json(await this.outcome(reason, { upstreamStatus, durationMs: Date.now() - now }), { status: 502 });
      }
    }
    const snapshot = await this.state.storage.get("snapshot");
    const lastResult = await this.state.storage.get("diagnostics");
    const next = await this.state.storage.get("nextAttempt");
    const diagnostics = {
      reason: !this.env.CLARITY_API_TOKEN?.trim() ? "missing_token" : lastResult?.reason || (snapshot ? "legacy_snapshot" : next ? "legacy_attempt_unknown" : "awaiting_first_update"),
      lastAttemptAt: await this.state.storage.get("lastAttemptAt") || null,
      lastResultAt: lastResult?.recordedAt || null,
      upstreamStatus: lastResult?.upstreamStatus || null,
      nextEligibleAt: next ? new Date(next).toISOString() : null,
      lastSuccessAt: snapshot?.updatedAt || null,
    };
    if (!snapshot) {
      log("snapshot_unavailable", diagnostics);
      return Response.json({ status: "unavailable", hasData: false, diagnostics }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ ...snapshot, status: "available", hasData: true, diagnostics, stale: Date.now() - Date.parse(snapshot.updatedAt) > 12 * HOUR });
  }
}

function stub(env) { return env.STATS.get(env.STATS.idFromName(KEY)); }

export default {
  async scheduled(event, env) {
    log("scheduled_started", { cron: event.cron, scheduledTime: event.scheduledTime });
    try {
      const response = await stub(env).fetch(new Request("https://internal/refresh", { method: "POST" }));
      const result = await response.json();
      log("scheduled_finished", { status: response.status, reason: result.reason });
      if (!response.ok) throw new Error(`Clarity scheduled update failed: ${result.reason}`);
    } catch (error) {
      log("scheduled_failed");
      throw error;
    }
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/stats" || url.search) return new Response("Not found", { status: 404 });
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    // 公開讀取永遠不更新上游，訪客數量不影響 Clarity API 配額。
    const response = await stub(env).fetch(new Request("https://internal/snapshot"));
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN);
    headers.set("Cache-Control", response.headers.get("Cache-Control") || (response.ok ? "public, max-age=300" : "no-store"));
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  },
};
