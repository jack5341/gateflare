import type { AllowlistConfig } from "./types";

export async function checkAllowlist(
  ip: string,
  config: AllowlistConfig,
  kv: KVNamespace
): Promise<boolean> {
  if (!config.enabled) return true;

  if (config.allow) {
    for (const entry of config.allow) {
      if (entry.includes("/")) {
        if (inCidr(ip, entry)) return true;
      } else {
        if (ip === entry) return true;
      }
    }
  }

  const kvEntry = await kv.get(`allowlist:${ip}`);
  if (kvEntry !== null) return true;

  return false;
}

function ipToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function inCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  if (!range || !bits) return false;

  const mask = ~(0xffffffff >>> parseInt(bits, 10)) >>> 0;
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);

  return (ipInt & mask) === (rangeInt & mask);
}
