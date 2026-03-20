import type { RouteConfig } from "./types";

export function matchRoute(
  path: string,
  routes: RouteConfig[]
): RouteConfig | null {
  for (const route of routes) {
    if (matches(path, route.path)) {
      return route;
    }
  }
  return null;
}

function matches(path: string, pattern: string): boolean {
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return path === prefix || path.startsWith(prefix + "/");
  }
  return path === pattern;
}
