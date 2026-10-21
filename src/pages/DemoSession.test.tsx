import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import App from "../App";
import { ROLE_PERMISSIONS } from "../auth/permissions";
import { setToken } from "../auth/session";
import { json } from "../test/mockApi";

const PRODUCTION_API = "https://api.example.test";
const DEMO_API = "https://demo-api.example.test";

const demoAdmin = {
  id: 125,
  username: "adminDemoUser",
  role: "admin",
  is_active: true,
  is_seed: true,
  permissions: [...ROLE_PERMISSIONS.admin],
};

const cell = (granted: boolean, editable: boolean, lock_reason: string | null) => ({ granted, editable, lock_reason });
const fixedAdmin = cell(true, false, "admin_full_access");

function matrix(viewerUsersRead: boolean, version: string) {
  return {
    roles: ["admin", "manager", "member", "viewer"],
    version,
    updated_at: null,
    updated_by: null,
    permissions: [
      {
        permission: "users:read",
        roles: {
          admin: fixedAdmin,
          manager: cell(false, true, null),
          member: cell(false, true, null),
          viewer: cell(viewerUsersRead, true, null),
        },
      },
      {
        permission: "audit:read",
        roles: {
          admin: fixedAdmin,
          manager: cell(false, false, "audit_admin_only"),
          member: cell(false, false, "audit_admin_only"),
          viewer: cell(false, false, "audit_admin_only"),
        },
      },
    ],
  };
}

const EVENT = {
  id: 3,
  occurred_at: "2026-10-21T09:00:00+00:00",
  event_type: "auth.demo_session",
  outcome: "success",
  actor: { username: "adminDemoUser", role: "admin" },
  target: null,
  details: {},
};

/** A demo API that remembers what was saved; anything else fails the test. */
function demoBackend() {
  const urls: URL[] = [];
  const bodies: Array<{ path: string; body: unknown }> = [];
  let viewerUsersRead = false;
  let settings = {
    organisation_name: null as string | null,
    timezone: null,
    access_requests_enabled: true,
    requestable_roles: ["manager", "member", "viewer"],
    session_minutes: 30,
    revision: 0,
    updated_at: null as string | null,
    updated_by: null as { id: number; username: string } | null,
    limits: {
      organisation_name_max: 80,
      session_minutes_min: 15,
      session_minutes_max: 720,
      requestable_roles: ["manager", "member", "viewer"],
    },
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      urls.push(url);
      const method = (init?.method ?? "GET").toUpperCase();
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (body) bodies.push({ path: url.pathname, body });
      if (url.origin !== DEMO_API) throw new Error(`Demo session reached ${url.origin}`);
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer demo.jwt");

      const route = `${method} ${url.pathname}`;
      switch (route) {
        case "GET /profile":
          return json({ user: demoAdmin });
        case "GET /organisation":
          return json({
            organisation_name: settings.organisation_name,
            timezone: settings.timezone,
            access_requests: { enabled: true, requestable_roles: settings.requestable_roles },
          });
        case "GET /role-permissions":
          return json(matrix(viewerUsersRead, `v${Number(viewerUsersRead)}`));
        case "PUT /role-permissions":
          viewerUsersRead = (body as { grants: { viewer: string[] } }).grants.viewer.includes("users:read");
          return json(matrix(viewerUsersRead, `v${Number(viewerUsersRead)}`));
        case "GET /settings":
          return json(settings);
        case "PUT /settings": {
          const { revision: _revision, ...values } = body as typeof settings;
          void _revision;
          settings = {
            ...settings,
            ...values,
            revision: settings.revision + 1,
            updated_at: "2026-10-21T10:00:00+00:00",
            updated_by: { id: 125, username: "adminDemoUser" },
          };
          return json(settings);
        }
        case "GET /activity":
          return json({ events: [EVENT], total: 1, page: 1, page_size: 30 });
        case "GET /audit-events":
          return json({ events: [{ ...EVENT, actor: { id: 125, ...EVENT.actor } }], total: 1, page: 1, page_size: 25 });
      }
      throw new Error(`Unhandled demo request: ${route}`);
    })
  );

  return { urls, bodies };
}

function startDemoSession() {
  vi.stubEnv("VITE_API_URL", PRODUCTION_API);
  vi.stubEnv("VITE_DEMO_API_URL", DEMO_API);
  setToken("demo.jwt", "demo");
}

function visit(path: string) {
  window.history.pushState(null, "", path);
  render(<App />);
}

describe("adminDemoUser session", () => {
  it("offers every admin page, with no placeholders", async () => {
    startDemoSession();
    demoBackend();
    visit("/dashboard");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    await waitFor(() => expect(within(nav).getByRole("link", { name: /Roles/ }).textContent).toBe("Roles"));
    for (const label of ["Roles", "Activity", "Audit Log", "Settings"]) {
      expect(within(nav).getByRole("link", { name: new RegExp(label) }).textContent).toBe(label);
    }
    expect(within(nav).queryByText("Soon")).toBeNull();
  });

  it("changes and reloads the permission policy through the demo API", async () => {
    startDemoSession();
    const { urls, bodies } = demoBackend();
    visit("/roles");

    expect(await screen.findByText(/Shared demo: permission changes you save here apply to everyone/)).toBeTruthy();
    const box = (await screen.findByRole("checkbox", { name: "Allow “View users” for Viewer / Auditor" })) as HTMLInputElement;
    fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/Permissions saved/)).toBeTruthy();
    expect(bodies.find((entry) => entry.path === "/role-permissions")?.body).toMatchObject({
      version: "v0",
      grants: { viewer: ["users:read"] },
    });
    // Reloaded from the demo API, the saved value is there.
    await waitFor(() =>
      expect(
        (screen.getByRole("checkbox", { name: "Allow “View users” for Viewer / Auditor" }) as HTMLInputElement).checked
      ).toBe(true)
    );
    expect(urls.filter((url) => url.pathname === "/role-permissions")).toHaveLength(3);
    expect(urls.every((url) => url.origin === DEMO_API)).toBe(true);
  });

  it("saves and reloads a setting through the demo API", async () => {
    startDemoSession();
    const { urls } = demoBackend();
    visit("/settings");

    expect(await screen.findByText(/Shared demo: settings you save here apply to everyone/)).toBeTruthy();
    fireEvent.change(await screen.findByLabelText("Organisation name"), { target: { value: "AccessHub Demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText(/Settings saved\./)).toBeTruthy();
    expect(await screen.findByText(/Last changed .* by adminDemoUser/)).toBeTruthy();
    expect((screen.getByLabelText("Organisation name") as HTMLInputElement).value).toBe("AccessHub Demo");
    const sidebar = screen.getByRole("complementary", { name: "Sidebar" });
    expect(await within(sidebar).findByText("AccessHub Demo")).toBeTruthy();
    expect(urls.every((url) => url.origin === DEMO_API)).toBe(true);
  });

  it("loads and filters Activity, and opens the Audit Log, through the demo API", async () => {
    startDemoSession();
    const { urls } = demoBackend();
    visit("/activity");

    expect(await screen.findByText("by adminDemoUser")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "success" } });
    await waitFor(() =>
      expect(urls.some((url) => url.pathname === "/activity" && url.searchParams.get("outcome") === "success")).toBe(true)
    );

    fireEvent.click(screen.getByRole("link", { name: /Audit Log/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Audit Log" })).toBeTruthy();
    await waitFor(() => expect(urls.some((url) => url.pathname === "/audit-events")).toBe(true));
    expect(await screen.findByRole("table")).toBeTruthy();
    expect(urls.every((url) => url.origin === DEMO_API)).toBe(true);
  });

  it("doesn't show the shared-demo notice outside a demo session", async () => {
    vi.stubEnv("VITE_API_URL", DEMO_API);
    vi.stubEnv("VITE_DEMO_API_URL", "");
    setToken("demo.jwt");
    demoBackend();
    visit("/roles");

    expect(await screen.findByRole("checkbox", { name: "Allow “View users” for Viewer / Auditor" })).toBeTruthy();
    expect(screen.queryByText(/Shared demo/)).toBeNull();
  });
});
