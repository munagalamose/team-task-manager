const TOKEN_KEY = "ttm_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers: HeadersInit = {
    ...(options.json !== undefined
      ? { "Content-Type": "application/json" }
      : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const token = getToken();
  if (token) (headers as Record<string, string>)["Authorization"] =
    `Bearer ${token}`;

  const res = await fetch(path, {
    ...options,
    headers,
    body:
      options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || "Invalid response" };
  }

  if (!res.ok) {
    let msg = res.statusText;
    if (typeof data === "object" && data && "error" in data) {
      const err = (data as { error: unknown }).error;
      if (typeof err === "string") msg = err;
      else if (typeof err === "object" && err && "fieldErrors" in err) {
        const fe = (err as { fieldErrors: Record<string, string[]> }).fieldErrors;
        const first = Object.values(fe).flat()[0];
        msg = first ?? JSON.stringify(err);
      } else msg = JSON.stringify(err);
    }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data as T;
}
