import type { RouteConfig, Env } from "./types";

export function injectAuth(
  headers: Headers,
  route: RouteConfig,
  env: Env
): void {
  if (!route.secret_ref) return;

  const secret = env[route.secret_ref];
  if (typeof secret !== "string" || !secret) return;

  if (route.auth_style === "bearer") {
    headers.set("authorization", `Bearer ${secret}`);
  } else if (route.auth_style === "header" && route.auth_header) {
    headers.set(route.auth_header, secret);
  }
}
