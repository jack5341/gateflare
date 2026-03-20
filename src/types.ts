export type LogLevel = "debug" | "info" | "warn" | "error";

export interface RateLimitConfig {
  enabled: boolean;
  requests: number;
  window_seconds: number;
  by: "ip" | "global";
}

export interface RewriteConfig {
  strip_prefix?: string;
  add_prefix?: string;
}

export interface HeadersConfig {
  strip?: string[];
  inject?: Record<string, string>;
}

export interface RouteConfig {
  path: string;
  upstream: string;
  secret_ref?: string;
  auth_style?: "bearer" | "header";
  auth_header?: string;
  rate_limit?: RateLimitConfig;
  rewrite?: RewriteConfig;
  headers?: HeadersConfig;
  cors?: CorsConfig;
}

export interface AllowlistConfig {
  enabled: boolean;
  allow?: string[];
}

export interface R2BackupConfig {
  enabled: boolean;
  bucket?: string;
  prefix?: string;
}

export interface CorsConfig {
  enabled: boolean;
  origin?: string | string[];
  methods?: string | string[];
  headers?: string | string[];
  max_age?: number;
  credentials?: boolean;
}

export interface GatewayConfig {
  log_level: LogLevel;
  environment?: string;
  rate_limit?: RateLimitConfig;
  ip_allowlist?: AllowlistConfig;
  r2_backup?: R2BackupConfig;
  cors?: CorsConfig;
  routes: RouteConfig[];
}

export interface Env {
  GATEWAY_KV: KVNamespace;
  GATEWAY_LOGS: R2Bucket;
  GATEWAY_CONFIG: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  request_id: string;
  route: string | null;
  message: string;
  meta?: Record<string, unknown>;
}

export interface RequestContext {
  request_id: string;
  ip: string;
  route: RouteConfig | null;
  started_at: number;
}
