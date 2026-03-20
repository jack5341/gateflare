import type { RewriteConfig } from "./types";

export function rewritePath(path: string, rewrite: RewriteConfig): string {
  let result = path;

  if (rewrite.strip_prefix && result.startsWith(rewrite.strip_prefix)) {
    result = result.slice(rewrite.strip_prefix.length) || "/";
  }

  if (rewrite.add_prefix) {
    result = rewrite.add_prefix + result;
  }

  return result;
}
