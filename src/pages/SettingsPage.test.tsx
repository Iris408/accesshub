import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OrganisationSettings, OrganisationSummary, Profile } from "../api/client";
import App from "../App";
import { ROLE_PERMISSIONS } from "../auth/permissions";
import type { Role } from "../auth/roles";
import { json } from "../test/mockApi";

function profile(role: Role): Profile {
  return { id: 1, username: `${role}.user`, role, is_active: true, permissions: [...ROLE_PERMISSIONS[role]] };
}

function settings(overrides: Partial<OrganisationSettings> = {}): OrganisationSettings {
  return {
    organisation_name: null,
    timezone: null,
    access_requests_enabled: true,
    requestable_roles: ["manager", "member", "viewer"],
    session_minutes: 30,
    revision: 0,
    updated_at: null,
    updated_by: null,
    limits: {
      organisation_name_max: 80,
      session_minutes_min: 15,
      session_minutes_max: 720,
      requestable_roles: ["manager", "member", "viewer"],
    },
    ...overrides,
  };
}

function summaryOf(value: OrganisationSettings): OrganisationSummary {
  return {
    organisation_name: value.organisation_name,
    timezone: value.timezone,
    access_requests: {
      enabled: value.access_requests_enabled,
      requestable_roles: value.requestable_roles,
    },
  };
}

type Handler = (url: URL, body?: unknown) => Response | Promise<Response>;

function backend(user: Profile, handlers: Record<string, Handler> = {}) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method ?? "GET").toUpperCase();
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path: url.pathname, body });

      if (method === "GET" && url.pathname === "/profile") return json({ user });
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

/** A small in-memory settings API that behaves like the real one. */
function settingsApi(initial = settings()) {
  let current = initial;
  return {
    get current() {
      return current;
    },
    handlers: {
      "GET /settings": () => json(current),
      "GET /organisation": () => json(summaryOf(current)),
      "PUT /settings": (_url: URL, body?: unknown) => {
        const { revision, ...values } = body as OrganisationSettings;
        if (revision !== current.revision) return json({ detail: "Settings were changed by someone else." }, 409);
        current = {
          ...current,
          ...values,
          revision: current.revision + 1,
          updated_at: "2026-10-21T10:00:00+00:00",
          updated_by: { id: 1, username: "admin.user" },
        };
        return json(current);
      },
    } satisfies Record<string, Handler>,
  };
}

function renderAt(path: string) {
  window.history.pushState(null, "", path);
  render(<App />);
}

describe("Settings — page", () => {
  it("shows the saved settings in groups with what each one does", async () => {
    const api = settingsApi();
    backend(profile("admin"), api.handlers);
    renderAt("/settings");

    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeTruthy();
    for (const group of ["Organisation", "Access requests", "Sessions"]) {
      expect(await screen.findByRole("region", { name: group })).toBeTruthy();
    }

    expect((screen.getByLabelText("Organisation name") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Timezone") as HTMLSelectElement).value).toBe("");
    expect(screen.getByText("Dates and times are shown in each viewer's own timezone.")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: /Allow access requests/ }) as HTMLInputElement).checked).toBe(true);
    const roles = screen.getByRole("group", { name: "Roles that can be requested" });
    expect(within(roles).getAllByRole("checkbox").map((box) => box.parentElement?.textContent)).toEqual([
      "Manager",
      "Member",
      "Viewer / Auditor",
    ]);
    expect(within(roles).queryByText("Admin")).toBeNull();
    expect((screen.getByLabelText("Session length") as HTMLSelectElement).value).toBe("30");
    expect(screen.getByText(/People already signed in keep their current session/)).toBeTruthy();
    expect(screen.getByText("Using the default settings.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save settings" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves every setting, then shows what the API returned and applies it", async () => {
    const api = settingsApi();
    const { calls, count } = backend(profile("admin"), api.handlers);
    renderAt("/settings");
    await screen.findByLabelText("Organisation name");

    fireEvent.change(screen.getByLabelText("Organisation name"), { target: { value: "  Acme Ltd  " } });
    fireEvent.change(screen.getByLabelText("Timezone"), { target: { value: "Asia/Tokyo" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Manager" }));
    fireEvent.change(screen.getByLabelText("Session length"), { target: { value: "120" } });
    expect(screen.getByText("You have unsaved changes.")).toBeTruthy();
    const organisationLoads = count("GET", "/organisation");

    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText(/Settings saved\./)).toBeTruthy();
    expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
      revision: 0,
      organisation_name: "Acme Ltd",
      timezone: "Asia/Tokyo",
      access_requests_enabled: true,
      requestable_roles: ["member", "viewer"],
      session_minutes: 120,
    });
    // Values are re-read from the API, and the rest of the app picks them up.
    await waitFor(() => expect(count("GET", "/settings")).toBe(2));
    await waitFor(() => expect(count("GET", "/organisation")).toBeGreaterThan(organisationLoads));
    expect(await screen.findByText(/Last changed .* by admin\.user/)).toBeTruthy();
    const sidebar = screen.getByRole("complementary", { name: "Sidebar" });
    expect(await within(sidebar).findByText("Acme Ltd")).toBeTruthy();
  });

  it("checks settings before sending them", async () => {
    const api = settingsApi();
    const { count } = backend(profile("admin"), api.handlers);
    renderAt("/settings");
    await screen.findByLabelText("Organisation name");

    for (const role of ["Manager", "Member", "Viewer / Auditor"]) {
      fireEvent.click(screen.getByRole("checkbox", { name: role }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("Choose at least one role, or turn access requests off.")).toBeTruthy();
    expect(count("PUT", "/settings")).toBe(0);

    // Turning requests off makes an empty list valid (and disables the roles).
    fireEvent.click(screen.getByRole("checkbox", { name: /Allow access requests/ }));
    expect((screen.getByRole("group", { name: "Roles that can be requested" }) as HTMLFieldSetElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Organisation name"), { target: { value: "x".repeat(81) } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("Use 80 characters or fewer.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Organisation name"));
    expect(count("PUT", "/settings")).toBe(0);
  });

  it("shows the API's rejection without claiming success", async () => {
    const api = settingsApi();
    backend(profile("admin"), {
      ...api.handlers,
      "PUT /settings": () => json({ detail: "Unknown timezone: Mars/Olympus_Mons" }, 422),
    });
    renderAt("/settings");
    await screen.findByLabelText("Organisation name");

    fireEvent.change(screen.getByLabelText("Organisation name"), { target: { value: "Acme Ltd" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The settings weren't saved: Unknown timezone: Mars/Olympus_Mons"
    );
    expect(screen.queryByText(/Settings saved/)).toBeNull();
    expect((screen.getByLabelText("Organisation name") as HTMLInputElement).value).toBe("Acme Ltd");
  });

  it("explains a conflicting save and reloads the latest settings", async () => {
    const api = settingsApi();
    const { count } = backend(profile("admin"), {
      ...api.handlers,
      "PUT /settings": () => json({ detail: "Settings were changed by someone else." }, 409),
    });
    renderAt("/settings");
    await screen.findByLabelText("Organisation name");

    fireEvent.change(screen.getByLabelText("Organisation name"), { target: { value: "Acme Ltd" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Someone else changed the settings");
    fireEvent.click(within(alert).getByRole("button", { name: "Reload latest" }));

    await waitFor(() => expect(count("GET", "/settings")).toBe(2));
    expect((screen.getByLabelText("Organisation name") as HTMLInputElement).value).toBe("");
  });

  it("cancels unsaved changes", async () => {
    backend(profile("admin"), settingsApi().handlers);
    renderAt("/settings");
    await screen.findByLabelText("Session length");

    fireEvent.change(screen.getByLabelText("Session length"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect((screen.getByLabelText("Session length") as HTMLSelectElement).value).toBe("30");
    expect(screen.getByText("Using the default settings.")).toBeTruthy();
  });

  it("offers a retry when settings can't load", async () => {
    let fail = true;
    const api = settingsApi();
    backend(profile("admin"), {
      ...api.handlers,
      "GET /settings": () => (fail ? json({ detail: "boom" }, 500) : json(api.current)),
    });
    renderAt("/settings");

    expect(await screen.findByText("Settings couldn't be loaded")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Organisation name")).toBeTruthy();
  });

  it.each(["manager", "member", "viewer"] as const)("is closed to %s accounts without calling the API", async (role) => {
    const { count } = backend(profile(role), { "GET /organisation": () => json(summaryOf(settings())) });
    renderAt("/settings");

    expect(await screen.findByText("Only administrators can change settings")).toBeTruthy();
    expect(count("GET", "/settings")).toBe(0);
  });

  it("is translated", async () => {
    localStorage.setItem("accesshub.language", "es");
    backend(profile("admin"), settingsApi().handlers);
    renderAt("/settings");

    expect(await screen.findByRole("heading", { level: 1, name: "Configuración" })).toBeTruthy();
    expect(await screen.findByLabelText("Duración de la sesión")).toBeTruthy();
    expect(screen.getByRole("option", { name: "2 horas" })).toBeTruthy();
  });
});

describe("Settings — effects elsewhere", () => {
  it("shows activity in the organisation's timezone", async () => {
    backend(profile("viewer"), {
      "GET /organisation": () => json(summaryOf(settings({ timezone: "Asia/Tokyo" }))),
      "GET /activity": () =>
        json({
          events: [
            {
              id: 1,
              occurred_at: "2026-10-20T15:30:00+00:00",
              event_type: "auth.sign_in",
              outcome: "success",
              actor: { username: "jane.doe", role: "member" },
              target: { type: "user", username: "jane.doe" },
              details: {},
            },
          ],
          total: 1,
          page: 1,
          page_size: 30,
        }),
    });
    renderAt("/activity");

    // 15:30 UTC on 20 October is 00:30 on 21 October in Tokyo.
    expect(await screen.findByRole("heading", { level: 3, name: "Wednesday, October 21, 2026" })).toBeTruthy();
    expect(screen.getByText("12:30 AM")).toBeTruthy();
  });

  it("follows the access request policy in the request form", async () => {
    backend(profile("member"), {
      "GET /organisation": () =>
        json(summaryOf(settings({ requestable_roles: ["manager", "member"] }))),
      "GET /access-requests/mine": () => json({ requests: [], total: 0, page: 1, page_size: 50 }),
    });
    renderAt("/access-requests");

    const select = (await screen.findByLabelText("Role you need")) as HTMLSelectElement;
    await waitFor(() => expect(Array.from(select.options).map((option) => option.value)).toEqual(["", "manager"]));
  });

  it("explains when access requests are turned off", async () => {
    backend(profile("member"), {
      "GET /organisation": () => json(summaryOf(settings({ access_requests_enabled: false, requestable_roles: [] }))),
      "GET /access-requests/mine": () => json({ requests: [], total: 0, page: 1, page_size: 50 }),
    });
    renderAt("/access-requests");

    expect(await screen.findByText(/Access requests are turned off for your organisation/)).toBeTruthy();
    expect(screen.queryByLabelText("Role you need")).toBeNull();
    expect(screen.getByRole("region", { name: "My requests" })).toBeTruthy();
  });

  it("refreshes the policy when the API refuses a request because it changed", async () => {
    let enabled = true;
    const { count } = backend(profile("member"), {
      "GET /organisation": () => json(summaryOf(settings({ access_requests_enabled: enabled }))),
      "GET /access-requests/mine": () => json({ requests: [], total: 0, page: 1, page_size: 50 }),
      "POST /access-requests": () => {
        enabled = false;
        return json({ detail: "Access requests are turned off" }, 403);
      },
    });
    renderAt("/access-requests");

    fireEvent.change(await screen.findByLabelText("Role you need"), { target: { value: "viewer" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Quarterly audit." } });
    const before = count("GET", "/organisation");
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => expect(count("GET", "/organisation")).toBeGreaterThan(before));
    expect(await screen.findByText(/Access requests are turned off for your organisation/)).toBeTruthy();
  });
});
