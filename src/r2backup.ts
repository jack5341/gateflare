import type { LogEntry } from "./types";

const logBuffer: string[] = [];

export function appendToBuffer(entry: LogEntry): void {
  logBuffer.push(JSON.stringify(entry));
}

export async function flushToR2(
  bucket: R2Bucket,
  prefix: string
): Promise<void> {
  if (logBuffer.length === 0) return;

  const date = new Date().toISOString().slice(0, 10);
  const key = `${prefix}${date}.jsonl`;

  try {
    const existing = await bucket.get(key);
    const previous = existing ? await existing.text() : "";
    const body = (previous ? previous + "\n" : "") + logBuffer.join("\n");

    await bucket.put(key, body, {
      httpMetadata: { contentType: "application/x-ndjson" },
    });

    logBuffer.length = 0;
  } catch {
    // fail silently — never block the request
  }
}
