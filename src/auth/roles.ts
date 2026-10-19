// Mirrors app/permissions.py in the API. The API returns canonical role
// values; normalisation here keeps older deployments ("user", "Admin")
// working the same way.

export const ROLES = ["admin", "manager", "member", "viewer"] as const;

export type Role = (typeof ROLES)[number];

const LEGACY_ALIASES: Record<string, Role> = {
  user: "member",
  auditor: "viewer",
};

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Case-insensitive; unknown values get the least-privileged role. */
export function normalizeRole(role?: string): Role {
  const key = role?.trim().toLowerCase() ?? "";

  if (isRole(key)) return key;
  return LEGACY_ALIASES[key] ?? "member";
}

/** Navigation hint only — the backend remains the authority on access. */
export function isAdminRole(role?: string): boolean {
  return normalizeRole(role) === "admin";
}
