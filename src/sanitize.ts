const DEFAULT_STRIP = ["cf-ray", "cf-cache-status", "server"];

export function sanitizeResponse(response: Response, strip: string[]): Response {
  const headers = new Headers(response.headers);

  for (const name of [...DEFAULT_STRIP, ...strip]) {
    headers.delete(name);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
