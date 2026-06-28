export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export function resolveWsUrl(token) {
  const base = import.meta.env.VITE_WS_URL || (() => {
    const url = new URL(API_BASE);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${url.host}/ws`;
  })();

  return `${base}?token=${encodeURIComponent(token)}`;
}

export async function apiFetch(path, { token, ...options } = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Request failed");
  }
  return body;
}
