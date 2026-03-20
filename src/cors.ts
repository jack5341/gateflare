import type { CorsConfig } from "./types";

export function handleCorsPreflight(
  request: Request,
  config: CorsConfig
): Response | null {
  if (request.method !== "OPTIONS") return null;

  const headers = new Headers();
  applyCorsHeaders(headers, config);

  return new Response(null, {
    status: 204,
    headers,
  });
}

export function applyCorsHeaders(headers: Headers, config: CorsConfig): void {
  if (!config.enabled) return;

  const origins = Array.isArray(config.origin)
    ? config.origin.join(", ")
    : config.origin || "*";
  headers.set("Access-Control-Allow-Origin", origins);

  const methods = Array.isArray(config.methods)
    ? config.methods.join(", ")
    : config.methods || "GET, POST, PUT, DELETE, PATCH, OPTIONS";
  headers.set("Access-Control-Allow-Methods", methods);

  const allowedHeaders = Array.isArray(config.headers)
    ? config.headers.join(", ")
    : config.headers || "*";
  headers.set("Access-Control-Allow-Headers", allowedHeaders);

  if (config.max_age) {
    headers.set("Access-Control-Max-Age", String(config.max_age));
  }

  if (config.credentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }
}
