import type { Profile } from "../api/client";
import { normalizeRole, type Role } from "./roles";

export type Permission =
  | "users:read"
  | "users:manage"
  | "access_requests:submit"
  | "access_requests:review"
  | "activity:read"
  | "audit:read"
  | "roles:manage"
  | "settings:manage";

/**
 * The API's default policy (DEFAULT_ROLE_PERMISSIONS in app/permissions.py).
 * Only used when the API doesn't send `permissions` on /profile (older
 * deployments); the API's list — which reflects the configured policy — wins.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    "users:read",
    "users:manage",
    "access_requests:submit",
    "access_requests:review",
    "activity:read",
    "audit:read",
    "roles:manage",
    "settings:manage",
  ],
  manager: ["access_requests:submit", "access_requests:review", "activity:read"],
  member: ["access_requests:submit"],
  // audit:read is Admin-only by policy.
  viewer: ["activity:read"],
};

export function permissionsFor(profile: Profile | null): ReadonlySet<string> {
  if (!profile) return new Set();

  if (Array.isArray(profile.permissions)) return new Set(profile.permissions);

  return new Set(ROLE_PERMISSIONS[normalizeRole(profile.role)]);
}
