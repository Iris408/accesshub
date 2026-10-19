// The login page stores the JWT under this key; keep it stable so existing
// sessions keep working.
export const TOKEN_KEY = "token";

// Which API issued the token. Demo tokens are only ever sent to the demo API.
const SESSION_KIND_KEY = "accesshub.session";

export type SessionKind = "standard" | "demo";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, kind: SessionKind = "standard"): void {
  localStorage.setItem(TOKEN_KEY, token);

  if (kind === "demo") localStorage.setItem(SESSION_KIND_KEY, "demo");
  else localStorage.removeItem(SESSION_KIND_KEY);
}

export function isDemoSession(): boolean {
  return localStorage.getItem(SESSION_KIND_KEY) === "demo";
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KIND_KEY);
}
