import type { IconName } from "../ui/Icon";

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
};

export const MAIN_NAV: NavItem[] = [
  { id: "dashboard", to: "/dashboard", icon: "dashboard", status: "available" },
  { id: "users", to: "/admin", icon: "users", status: "admin" },
  { id: "accessRequests", to: "/access-requests", icon: "userPlus", status: "planned" },
  { id: "roles", to: "/roles", icon: "shield", status: "planned" },
  { id: "activity", to: "/activity", icon: "clock", status: "planned" },
  { id: "auditLog", to: "/audit-log", icon: "fileText", status: "planned" },
  { id: "settings", to: "/settings", icon: "settings", status: "planned" },
];

export const PLANNED_NAV = MAIN_NAV.filter((item) => item.status === "planned");
