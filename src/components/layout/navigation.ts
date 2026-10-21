import type { Permission } from "../../auth/permissions";
import type { MessageKey } from "../../i18n/messages/en";
import type { IconName } from "../ui/Icon";

export type NavAccess = {
  can: (permission: Permission) => boolean;
  isAdmin: boolean;
};

export type NavId =
  | "dashboard"
  | "users"
  | "accessRequests"
  | "roles"
  | "activity"
  | "auditLog"
  | "settings";

export type NavItem = {
  /** Translation keys are `nav.<id>.label` and `nav.<id>.description`. */
  id: NavId;
  to: string;
  icon: IconName;
  /**
   * available — works for every signed-in user
   * admin     — works, but the API only returns data to admins
   * planned   — no API support yet; the route explains that instead of 404ing
   */
  status: "available" | "admin" | "planned";
  /** For admin pages: whether the signed-in user may use it (else a lock icon). */
  allowed?: (access: NavAccess) => boolean;
  /** Screen-reader text for the lock icon; defaults to "(admins only)". */
  lockedLabel?: MessageKey;
};

export const MAIN_NAV: NavItem[] = [
  { id: "dashboard", to: "/dashboard", icon: "dashboard", status: "available" },
  {
    id: "users",
    to: "/admin",
    icon: "users",
    status: "admin",
    allowed: ({ can }) => can("users:read"),
  },
  {
    id: "accessRequests",
    to: "/access-requests",
    icon: "userPlus",
    status: "available",
    allowed: ({ can }) => can("access_requests:submit") || can("access_requests:review"),
    lockedLabel: "shell.notForYourRole",
  },
  {
    id: "roles",
    to: "/roles",
    icon: "shield",
    status: "admin",
    // roles:manage is fixed to Admin; the API also checks the role itself.
    allowed: ({ can, isAdmin }) => isAdmin && can("roles:manage"),
  },
  {
    id: "activity",
    to: "/activity",
    icon: "clock",
    status: "available",
    allowed: ({ can }) => can("activity:read"),
    lockedLabel: "shell.notForYourRole",
  },
  {
    id: "auditLog",
    to: "/audit-log",
    icon: "fileText",
    status: "admin",
    // The API serves the audit log to admins only (role checked server-side).
    allowed: ({ can, isAdmin }) => isAdmin && can("audit:read"),
  },
  {
    id: "settings",
    to: "/settings",
    icon: "settings",
    status: "admin",
    // settings:manage is fixed to Admin; the API also checks the role itself.
    allowed: ({ can, isAdmin }) => isAdmin && can("settings:manage"),
  },
];

export const PLANNED_NAV = MAIN_NAV.filter((item) => item.status === "planned");
