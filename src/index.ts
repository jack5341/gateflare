import { parseConfig } from "./config";
import { createLogger } from "./logger";
import { matchRoute } from "./router";
import { checkAllowlist } from "./allowlist";
import { checkRateLimit, buildRateLimitKey } from "./ratelimit";
import { injectAuth } from "./inject";
import { rewritePath } from "./rewrite";
import { sanitizeResponse } from "./sanitize";
import { appendToBuffer, flushToR2 } from "./r2backup";
import { handleCorsPreflight, applyCorsHeaders } from "./cors";
import type { Env, RequestContext } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID().slice(0, 6);
    const url = new URL(request.url);
    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for") ??
      "unknown";

    const config = parseConfig(env);
    const ctx: RequestContext = {
      request_id: requestId,
      ip,
      route: null,
      started_at: startedAt,
    };

    const route = matchRoute(url.pathname, config.routes);
    ctx.route = route;

    const logger = createLogger(
      config.log_level,
      requestId,
      route?.path ?? null
    );

    const activeCors = route?.cors ?? config.cors;
    if (activeCors?.enabled) {
      const preflight = handleCorsPreflight(request, activeCors);
      if (preflight) {
        return preflight;
      }
    }

    if (!route) {
      const entry = logger.warn("no route matched", { path: url.pathname });
      if (config.r2_backup?.enabled) appendToBuffer(entry);
      return new Response("Not Found", { status: 404 });
    }

    if (config.ip_allowlist?.enabled) {
      if (!env.GATEWAY_KV) {
        logger.error("GATEWAY_KV binding is missing but ip_allowlist is enabled");
        return new Response("Internal Server Error: Missing KV binding", { status: 500 });
      }
      const allowed = await checkAllowlist(ip, config.ip_allowlist, env.GATEWAY_KV);
      if (!allowed) {
        const entry = logger.warn("ip blocked", { ip });
        if (config.r2_backup?.enabled) appendToBuffer(entry);
        return new Response("Forbidden", { status: 403 });
      }
    }

    const activeRateLimit = route.rate_limit ?? config.rate_limit;
    if (activeRateLimit?.enabled) {
      if (!env.GATEWAY_KV) {
        logger.error("GATEWAY_KV binding is missing but rate_limit is enabled");
        return new Response("Internal Server Error: Missing KV binding", { status: 500 });
      }
      const rlKey = buildRateLimitKey(activeRateLimit, route.path, ip);
      const rl = await checkRateLimit(rlKey, activeRateLimit, env.GATEWAY_KV);
      if (!rl.allowed) {
        const entry = logger.warn("rate limit exceeded", { key: rlKey });
        if (config.r2_backup?.enabled) appendToBuffer(entry);
        return new Response("Too Many Requests", {
          status: 429,
          headers: { "retry-after": String(activeRateLimit.window_seconds) },
        });
      }
    }

    let path = url.pathname;
    if (route.rewrite) {
      path = rewritePath(path, route.rewrite);
    }

    const upstreamUrl = new URL(path + (url.search || ""), route.upstream);

    const outHeaders = new Headers(request.headers);

    for (const name of route.headers?.strip ?? []) {
      outHeaders.delete(name);
    }

    injectAuth(outHeaders, route, env);

    for (const [name, value] of Object.entries(route.headers?.inject ?? {})) {
      outHeaders.set(name, value);
    }

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl.toString(), {
        method: request.method,
        headers: outHeaders,
        body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
      });
    } catch (err) {
      const entry = logger.error("upstream fetch failed", {
        upstream: route.upstream,
        error: String(err),
      });
      if (config.r2_backup?.enabled) appendToBuffer(entry);
      return new Response("Bad Gateway", { status: 502 });
    }

    const response = sanitizeResponse(
      upstreamResponse,
      route.headers?.strip ?? []
    );

    if (activeCors?.enabled) {
      applyCorsHeaders(response.headers, activeCors);
    }

    const duration = Date.now() - startedAt;
    const entry = logger.info("request forwarded", {
      status: response.status,
      duration_ms: duration,
      upstream: route.upstream,
      ip,
    });

    if (config.r2_backup?.enabled) {
      if (env.GATEWAY_LOGS) {
        appendToBuffer(entry);
        await flushToR2(env.GATEWAY_LOGS, config.r2_backup.prefix ?? "logs/");
      } else {
        logger.warn("GATEWAY_LOGS binding is missing but r2_backup is enabled");
      }
    }

    return response;
  },
};
