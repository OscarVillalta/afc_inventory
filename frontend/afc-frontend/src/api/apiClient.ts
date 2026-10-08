// TODO: Move to environment variable for production deployment
const BASE_URL = "http://192.168.1.177:5000/api"; // Updated for local development

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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
    throw new ApiError(res.status, message || "API request failed");
  }

  return res.json();
}
