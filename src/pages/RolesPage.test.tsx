import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PermissionCell, Profile, RolePermissionMatrix } from "../api/client";
import App from "../App";
import { ROLE_PERMISSIONS } from "../auth/permissions";
import type { Role } from "../auth/roles";
import { json } from "../test/mockApi";

function profile(role: Role, permissions: readonly string[] = ROLE_PERMISSIONS[role]): Profile {
  return { id: 1, username: `${role}.user`, role, is_active: true, permissions: [...permissions] };
}

const ROLES = ["admin", "manager", "member", "viewer"];

const open = (granted: boolean): PermissionCell => ({ granted, editable: true, lock_reason: null });
const locked = (granted: boolean, lock_reason: PermissionCell["lock_reason"]): PermissionCell => ({
  granted,
  editable: false,
  lock_reason,
});
const admin = locked(true, "admin_full_access");

/** The API's default matrix, with optional overrides of editable cells. */
function defaultMatrix(version = "v1", overrides: Record<string, boolean> = {}): RolePermissionMatrix {
  const value = (role: string, permission: string, fallback: boolean) =>
    overrides[`${role}|${permission}`] ?? fallback;
  return {
    roles: ROLES,
    version,
    updated_at: null,
    updated_by: null,
    permissions: [
      {
        permission: "users:read",
        roles: {
          admin,
          manager: open(value("manager", "users:read", false)),
          member: open(value("member", "users:read", false)),
          viewer: open(value("viewer", "users:read", false)),
        },
      },
      {
        permission: "users:manage",
        roles: {
          admin,
          manager: locked(false, "admin_only"),
          member: locked(false, "admin_only"),
          viewer: locked(false, "admin_only"),
        },
      },
      {
        permission: "access_requests:submit",
        roles: {
          admin,
          manager: open(value("manager", "access_requests:submit", true)),
          member: locked(true, "member_submit_required"),
          viewer: locked(false, "viewer_read_only"),
        },
      },
      {
        permission: "access_requests:review",
        roles: {
          admin,
          manager: open(value("manager", "access_requests:review", true)),
          member: open(value("member", "access_requests:review", false)),
          viewer: locked(false, "viewer_read_only"),
        },
      },
      {
        permission: "activity:read",
        roles: {
          admin,
          manager: open(value("manager", "activity:read", true)),
          member: open(value("member", "activity:read", false)),
          viewer: open(value("viewer", "activity:read", true)),
        },
      },
      {
        permission: "audit:read",
        roles: {
          admin,
          manager: locked(false, "audit_admin_only"),
          member: locked(false, "audit_admin_only"),
          viewer: locked(false, "audit_admin_only"),
        },
      },
      {
        permission: "roles:manage",
        roles: {
          admin,
          manager: locked(false, "admin_only"),
          member: locked(false, "admin_only"),
          viewer: locked(false, "admin_only"),
        },
      },
      {
        permission: "settings:manage",
        roles: {
          admin,
          manager: locked(false, "admin_only"),
          member: locked(false, "admin_only"),
          viewer: locked(false, "admin_only"),
        },
      },
    ],
  };
}

type Handler = (url: URL, body?: unknown) => Response | Promise<Response>;

function backend(user: Profile | (() => Profile), handlers: Record<string, Handler> = {}) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method ?? "GET").toUpperCase();
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path: url.pathname, body });

      if (method === "GET" && url.pathname === "/profile") {
        return json({ user: typeof user === "function" ? user() : user });
      }
      const handler = handlers[`${method} ${url.pathname}`];
      if (handler) return handler(url, body);
      throw new Error(`Unhandled request: ${method} ${url.pathname}`);
    })
  );
  localStorage.setItem("token", "user.jwt");

  const count = (method: string, path: string) =>
    calls.filter((call) => call.method === method && call.path === path).length;
  return { calls, count };
}

function renderAt(path: string) {
  window.history.pushState(null, "", path);
  render(<App />);
}

/** The matrix checkbox for a permission label and role. */
function checkbox(permission: string, role: string) {
  return screen.getByRole("checkbox", { name: `Allow “${permission}” for ${role}` }) as HTMLInputElement;
}

describe("Roles — matrix", () => {
  it("shows capabilities as rows, roles as columns, and explains locked cells", async () => {
    backend(profile("admin"), { "GET /role-permissions": () => json(defaultMatrix()) });

    renderAt("/roles");

    const table = await screen.findByRole("table", { name: "Role permissions" });
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Capability", "Admin", "Manager", "Member", "Viewer / Auditor"]);

    const rows = within(table).getAllByRole("rowheader").map((cell) => cell.querySelector(".ah-perm-matrix__label")?.textContent);
    expect(rows).toEqual([
      "View users",
      "Manage users",
      "Request access",
      "Review access requests",
      "View activity",
      "Read the Audit Log",
      "Manage role permissions",
      "Manage settings",
    ]);

    // Settings stay Admin-only: a protected row, never a checkbox.
    const settingsRow = within(table).getByRole("rowheader", { name: /Manage settings/ }).closest("tr")!;
    expect(within(settingsRow).queryByRole("checkbox")).toBeNull();
    expect(settingsRow.textContent).toContain("Only Admins can manage accounts, role permissions and settings");

    // Only editable cells are checkboxes (9 of them), with today's values.
    expect(within(table).getAllByRole("checkbox")).toHaveLength(9);
    expect(checkbox("View activity", "Member").checked).toBe(false);
    expect(checkbox("View activity", "Viewer / Auditor").checked).toBe(true);
    expect(checkbox("Review access requests", "Manager").checked).toBe(true);
    expect(checkbox("View users", "Viewer / Auditor").checked).toBe(false);

    // Locked cells say why, for screen readers and in the visible rules.
    const auditRow = within(table).getByRole("rowheader", { name: /Read the Audit Log/ }).closest("tr")!;
    expect(auditRow.textContent).toContain(
      "Not allowed. Locked: The Audit Log is Admin-only and can't be granted to other roles."
    );
    const rules = screen.getByRole("region", { name: "Protected rules" });
    expect(within(rules).getByText(/Admin always has every permission/)).toBeTruthy();
    expect(within(rules).getByText(/Viewer \/ Auditor is read-only/)).toBeTruthy();
    expect(within(rules).getByText(/only Admins can decide requests for Manager access/)).toBeTruthy();

    expect(screen.getByText("Using the default permissions.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("edits and cancels without saving", async () => {
    const { count } = backend(profile("admin"), { "GET /role-permissions": () => json(defaultMatrix()) });

    renderAt("/roles");
    await screen.findByRole("table", { name: "Role permissions" });

    fireEvent.click(checkbox("View users", "Viewer / Auditor"));
    fireEvent.click(checkbox("Review access requests", "Manager"));

    expect(screen.getByText("2 unsaved changes")).toBeTruthy();
    expect(checkbox("View users", "Viewer / Auditor").checked).toBe(true);
    expect(screen.getAllByText("Unsaved")).toHaveLength(2);

    // Toggling back removes that change.
    fireEvent.click(checkbox("Review access requests", "Manager"));
    expect(screen.getByText("1 unsaved change")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(checkbox("View users", "Viewer / Auditor").checked).toBe(false);
    expect(screen.getByText("Using the default permissions.")).toBeTruthy();
    expect(count("PUT", "/role-permissions")).toBe(0);
  });

  it("saves the complete matrix, then shows what the API returns", async () => {
    let current = defaultMatrix("v1");
    const { calls, count } = backend(profile("admin"), {
      "GET /role-permissions": () => json(current),
      "PUT /role-permissions": () => {
        current = {
          ...defaultMatrix("v2", { "viewer|users:read": true }),
          updated_at: "2026-10-20T10:00:00+00:00",
          updated_by: { id: 1, username: "admin.user" },
        };
        return json(current);
      },
    });

    renderAt("/roles");
    await screen.findByRole("table", { name: "Role permissions" });
    const profileLoads = count("GET", "/profile");

    fireEvent.click(checkbox("View users", "Viewer / Auditor"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Permissions saved. They apply to everyone straight away.")).toBeTruthy();
    expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
      version: "v1",
      grants: {
        manager: ["access_requests:submit", "access_requests:review", "activity:read"],
        member: ["access_requests:submit"],
        viewer: ["users:read", "activity:read"],
      },
    });

    // The matrix is reloaded from the API and this session's profile refreshed.
    await waitFor(() => expect(count("GET", "/role-permissions")).toBe(2));
    await waitFor(() => expect(count("GET", "/profile")).toBeGreaterThan(profileLoads));
    expect(await screen.findByText(/Last changed .* by admin\.user/)).toBeTruthy();
    expect(checkbox("View users", "Viewer / Auditor").checked).toBe(true);
    expect(screen.queryByText("Unsaved")).toBeNull();
  });

  it("shows the API's rejection and keeps the unsaved changes", async () => {
    backend(profile("admin"), {
      "GET /role-permissions": () => json(defaultMatrix()),
      "PUT /role-permissions": () =>
        json({ detail: "audit:read can't be granted to viewer: the audit log is limited to Admin" }, 422),
    });

    renderAt("/roles");
    await screen.findByRole("table", { name: "Role permissions" });

    fireEvent.click(checkbox("View users", "Member"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The permissions weren't saved: audit:read can't be granted to viewer: the audit log is limited to Admin"
    );
    expect(screen.queryByText(/Permissions saved/)).toBeNull();
    expect(checkbox("View users", "Member").checked).toBe(true);
    expect(screen.getByText("1 unsaved change")).toBeTruthy();
  });

  it("explains a conflicting change and reloads the latest matrix", async () => {
    let current = defaultMatrix("v1");
    const { count } = backend(profile("admin"), {
      "GET /role-permissions": () => json(current),
      "PUT /role-permissions": () => {
        current = defaultMatrix("v2", { "manager|users:read": true });
        return json({ detail: "Role permissions were changed by someone else." }, 409);
      },
    });

    renderAt("/roles");
    await screen.findByRole("table", { name: "Role permissions" });

    fireEvent.click(checkbox("View users", "Member"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Someone else changed the permissions");
    fireEvent.click(within(alert).getByRole("button", { name: "Reload latest" }));

    await waitFor(() => expect(count("GET", "/role-permissions")).toBe(2));
    await waitFor(() => expect(checkbox("View users", "Manager").checked).toBe(true));
    expect(checkbox("View users", "Member").checked).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers a retry when the matrix can't load", async () => {
    let fail = true;
    backend(profile("admin"), {
      "GET /role-permissions": () => (fail ? json({ detail: "boom" }, 500) : json(defaultMatrix())),
    });

    renderAt("/roles");

    expect(await screen.findByText("Permissions couldn't be loaded")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table", { name: "Role permissions" })).toBeTruthy();
  });

  it("is translated", async () => {
    localStorage.setItem("accesshub.language", "ja");
    backend(profile("admin"), { "GET /role-permissions": () => json(defaultMatrix()) });

    renderAt("/roles");

    expect(await screen.findByRole("table", { name: "ロールの権限" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "ロール" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "閲覧者／監査担当 に「ユーザーの閲覧」を許可" })).toBeTruthy();
  });
});

describe("Roles — access and navigation", () => {
  it.each(["manager", "member", "viewer"] as const)(
    "is closed to %s accounts without calling the API",
    async (role) => {
      const { count } = backend(profile(role));

      renderAt("/roles");

      expect(await screen.findByText("Only administrators can manage roles")).toBeTruthy();
      expect(count("GET", "/role-permissions")).toBe(0);
      const nav = screen.getByRole("navigation", { name: "Main" });
      expect(within(nav).getByRole("link", { name: /Roles/ }).textContent).toBe("Roles (admins only)");
    }
  );

  it("links admins to the Roles page", async () => {
    backend(profile("admin"), { "GET /role-permissions": () => json(defaultMatrix()) });

    renderAt("/dashboard");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    await waitFor(() =>
      expect(within(nav).getByRole("link", { name: /Roles/ }).textContent).toBe("Roles")
    );
  });

  it("updates navigation when the policy changes, without signing out", async () => {
    let permissions: string[] = ["access_requests:submit"];
    const { count } = backend(() => profile("member", permissions), {
      "GET /access-requests/mine": () => json({ requests: [], total: 0, page: 1, page_size: 50 }),
    });

    renderAt("/access-requests");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    await waitFor(() =>
      expect(within(nav).getByRole("link", { name: /Users/ }).textContent).toBe("Users (admins only)")
    );

    // An Admin grants Members users:read; the next refresh picks it up.
    permissions = ["access_requests:submit", "users:read"];
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 60_000);
    const before = count("GET", "/profile");
    fireEvent.focus(window);

    await waitFor(() => expect(count("GET", "/profile")).toBe(before + 1));
    await waitFor(() =>
      expect(within(nav).getByRole("link", { name: /Users/ }).textContent).toBe("Users")
    );
    expect(localStorage.getItem("token")).toBe("user.jwt");
  });

  it("refreshes permissions when the API refuses a page", async () => {
    let permissions: string[] = [...ROLE_PERMISSIONS.manager];
    const { count } = backend(() => profile("manager", permissions), {
      "GET /access-requests/mine": () => json({ requests: [], total: 0, page: 1, page_size: 50 }),
      "GET /access-requests/summary": () => {
        // Review was revoked after this session loaded its profile.
        permissions = ["access_requests:submit", "activity:read"];
        return json({ detail: "You don't have permission to perform this action" }, 403);
      },
      "GET /access-requests": () =>
        json({ detail: "You don't have permission to perform this action" }, 403),
    });

    renderAt("/access-requests");

    // The session starts as a reviewer…
    expect(await screen.findByRole("region", { name: "New requests" })).toBeTruthy();
    // …the 403 re-reads the profile, and the reviewer sections disappear while
    // the request form stays.
    await waitFor(() => expect(count("GET", "/profile")).toBeGreaterThan(1));
    await waitFor(() => expect(screen.queryByRole("region", { name: "New requests" })).toBeNull());
    expect(screen.getByLabelText("Role you need")).toBeTruthy();
  });
});
