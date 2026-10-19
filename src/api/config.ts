const DEFAULT_API_URL = "https://mini-user-api.onrender.com";

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** The API that real sign-ins use (VITE_API_URL). */
export function primaryApiUrl(): string {
  return normalize(import.meta.env.VITE_API_URL || DEFAULT_API_URL);
}

/**
 * The isolated public-demo API (VITE_DEMO_API_URL), or null when no demo is
 * configured. A demo that points at the same API as real sign-ins is
 * rejected: demo sessions must never reach the production database.
 */
export function demoApiUrl(): string | null {
  const configured = import.meta.env.VITE_DEMO_API_URL;
  if (!configured?.trim()) return null;

  const url = normalize(configured);
  return url === primaryApiUrl() ? null : url;
}
