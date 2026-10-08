const TOKEN_KEY = "access_token";

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const parsed = JSON.parse(atob(padded));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function readAccessToken(): string | null {
  const token = readStoredToken();
  return token && token.trim() ? token.trim() : null;
}

/** True only when the stored login token says the user is an Admin. */
export function isAdminUser(): boolean {
  try {
    const token = readAccessToken();
    if (!token) return false;
    const role = decodeJwtPayload(token)?.role;
    return typeof role === "string" && role.trim().toLowerCase() === "admin";
  } catch {
    return false;
  }
}
