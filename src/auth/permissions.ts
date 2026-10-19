import type { Profile } from "../api/client";
import { normalizeRole, type Role } from "./roles";

export type Permission =
  | "users:read"
  | "users:manage"
  | "access_requests:submit"
  | "access_requests:review"
  | "activity:read_team"
  | "activity:read_all"
  | "audit:read";

/**
 * Same matrix as app/permissions.py. Only used when the API doesn't send
 * `permissions` on /profile (older deployments); the API's list wins.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    "users:read",
    "users:manage",
    "access_requests:submit",
    "access_requests:review",
    "activity:read_team",
    "activity:read_all",
    "audit:read",
  ],
  manager: ["access_requests:submit", "access_requests:review", "activity:read_team"],
  member: ["access_requests:submit"],
  viewer: ["activity:read_all", "audit:read"],
};

export function permissionsFor(profile: Profile | null): ReadonlySet<string> {
  if (!profile) return new Set();

  if (Array.isArray(profile.permissions)) return new Set(profile.permissions);

  return new Set(ROLE_PERMISSIONS[normalizeRole(profile.role)]);
}
