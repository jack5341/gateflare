import { z } from "zod";
import type { GatewayConfig } from "./types";
import type { Env } from "./types";

const RateLimitSchema = z.object({
  enabled: z.boolean({ invalid_type_error: "rate_limit.enabled must be a boolean" }).default(false),
  requests: z.number({ invalid_type_error: "rate_limit.requests must be a number" }).int().positive("rate_limit.requests must be positive").default(100),
  window_seconds: z.number({ invalid_type_error: "rate_limit.window_seconds must be a number" }).int().positive("rate_limit.window_seconds must be positive").default(60),
  by: z.enum(["ip", "global"], { invalid_type_error: "rate_limit.by must be 'ip' or 'global'" }).default("ip"),
});

const RewriteSchema = z.object({
  strip_prefix: z.string({ invalid_type_error: "rewrite.strip_prefix must be a string" }).optional(),
  add_prefix: z.string({ invalid_type_error: "rewrite.add_prefix must be a string" }).optional(),
});

const HeadersSchema = z.object({
  strip: z.array(z.string({ invalid_type_error: "headers.strip items must be strings" })).optional(),
  inject: z.record(z.string({ invalid_type_error: "headers.inject values must be strings" })).optional(),
});

const RouteSchema = z.object({
  path: z.string({ required_error: "route.path is required", invalid_type_error: "route.path must be a string" }),
  upstream: z.string({ required_error: "route.upstream is required" }).url("route.upstream must be a valid URL"),
  secret_ref: z.string({ invalid_type_error: "route.secret_ref must be a string" }).optional(),
  auth_style: z.enum(["bearer", "header"], { invalid_type_error: "route.auth_style must be 'bearer' or 'header'" }).optional(),
  auth_header: z.string({ invalid_type_error: "route.auth_header must be a string" }).optional(),
  rate_limit: RateLimitSchema.optional(),
  rewrite: RewriteSchema.optional(),
  headers: HeadersSchema.optional(),
});

const AllowlistSchema = z.object({
  enabled: z.boolean({ invalid_type_error: "ip_allowlist.enabled must be a boolean" }).default(false),
  allow: z.array(z.string({ invalid_type_error: "ip_allowlist.allow items must be strings" })).optional(),
});

const R2BackupSchema = z.object({
  enabled: z.boolean({ invalid_type_error: "r2_backup.enabled must be a boolean" }).default(false),
  bucket: z.string({ invalid_type_error: "r2_backup.bucket must be a string" }).optional(),
  prefix: z.string({ invalid_type_error: "r2_backup.prefix must be a string" }).optional(),
});

const GatewayConfigSchema = z.object({
  log_level: z.enum(["debug", "info", "warn", "error"], { invalid_type_error: "log_level must be debug, info, warn, or error" }).default("info"),
  environment: z.string({ invalid_type_error: "environment must be a string" }).optional(),
  rate_limit: RateLimitSchema.optional(),
  ip_allowlist: AllowlistSchema.optional(),
  r2_backup: R2BackupSchema.optional(),
  routes: z.array(RouteSchema, { invalid_type_error: "routes must be an array" }).default([]),
});

export function parseConfig(env: Env): GatewayConfig {
  const raw = env.GATEWAY_CONFIG;

  if (!raw) {
    return GatewayConfigSchema.parse({ routes: [] }) as GatewayConfig;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GATEWAY_CONFIG is not valid JSON");
  }

  const result = GatewayConfigSchema.safeParse(parsed);
  if (!result.success) {
    const errorMessages = result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    throw new Error(`Invalid GATEWAY_CONFIG: ${errorMessages}`);
  }

  return result.data as GatewayConfig;
}
