import type { User } from "../../api/client";
import { ROLES, normalizeRole, type Role } from "../../auth/roles";
import type { SortState } from "../ui/DataTable";

export const ALL_ROLES = "all";

export type StatusFilter = "all" | "active" | "inactive";

export type UserSortKey = "username" | "id" | "role" | "status";

export type UserQuery = {
  search: string;
  /** `ALL_ROLES` or a role. */
  role: string;
  status: StatusFilter;
  sort: SortState<UserSortKey>;
  page: number;
  pageSize: number;
};

export type UserQueryResult = {
  rows: User[];
  matchCount: number;
  pageCount: number;
  /** Current page, clamped to the available range. */
  page: number;
  /** 1-based index of the first row on the page (0 when empty). */
  start: number;
  end: number;
};

/** Older API deployments don't send `is_active`; status is then unknown. */
export function hasStatus(users: User[]): boolean {
  return users.some((user) => typeof user.is_active === "boolean");
}

export function isActive(user: User): boolean {
  return user.is_active !== false;
}

function matchesSearch(user: User, search: string): boolean {
  const term = search.trim().toLowerCase().replace(/^#/, "");
  if (!term) return true;

  return (
    (user.username ?? "").toLowerCase().includes(term) ||
    String(user.id) === term
  );
}

function matchesStatus(user: User, status: StatusFilter): boolean {
  if (status === "all") return true;
  return status === "active" ? isActive(user) : !isActive(user);
}

function compareUsers(a: User, b: User, key: UserSortKey): number {
  const byName = (a.username ?? "").localeCompare(b.username ?? "", undefined, {
    sensitivity: "base",
  });

  switch (key) {
    case "id":
      return a.id - b.id;
    case "role":
      return (
        ROLES.indexOf(normalizeRole(a.role)) - ROLES.indexOf(normalizeRole(b.role)) ||
        byName
      );
    case "status":
      return Number(isActive(b)) - Number(isActive(a)) || byName;
    case "username":
      return byName;
  }
}

/** Filter → sort → paginate, all derived from the API response. */
export function queryUsers(users: User[], query: UserQuery): UserQueryResult {
  const matches = users.filter(
    (user) =>
      matchesSearch(user, query.search) &&
      matchesStatus(user, query.status) &&
      (query.role === ALL_ROLES || normalizeRole(user.role) === query.role)
  );

  const direction = query.sort.direction === "asc" ? 1 : -1;
  const sorted = [...matches].sort(
    (a, b) => compareUsers(a, b, query.sort.key) * direction
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const offset = (page - 1) * query.pageSize;
  const rows = sorted.slice(offset, offset + query.pageSize);

  return {
    rows,
    matchCount: sorted.length,
    pageCount,
    page,
    start: rows.length ? offset + 1 : 0,
    end: offset + rows.length,
  };
}

export type RoleOption = { role: Role; count: number };

/** Roles present in the data, in permission order (admin first). */
export function roleOptions(users: User[]): RoleOption[] {
  const counts = new Map<Role, number>();

  for (const user of users) {
    const role = normalizeRole(user.role);
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  return ROLES.filter((role) => counts.has(role)).map((role) => ({
    role,
    count: counts.get(role) ?? 0,
  }));
}

export type UserSummary = {
  total: number;
  /** null when the API doesn't report status. */
  active: number | null;
  admins: number;
  roles: number;
};

export function summarizeUsers(users: User[]): UserSummary {
  return {
    total: users.length,
    active: hasStatus(users) ? users.filter(isActive).length : null,
    admins: users.filter((user) => normalizeRole(user.role) === "admin").length,
    roles: new Set(users.map((user) => normalizeRole(user.role))).size,
  };
}

/** Active admins who can sign in — mirrors the API's last-admin safeguard. */
export function activeAdminCount(users: User[]): number {
  return users.filter(
    (user) => normalizeRole(user.role) === "admin" && isActive(user) && !user.is_seed
  ).length;
}
