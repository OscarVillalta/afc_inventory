const BASE_URL = "http://127.0.0.1:5000/api"; // Adjust later for production

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const method = options.method || "GET";

  const headers: HeadersInit = {
    ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    method,
    headers,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "API request failed");
  }

  return res.json();
}
