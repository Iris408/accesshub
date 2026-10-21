import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AuditEvent, Profile } from "../api/client";
import App from "../App";
import { ROLE_PERMISSIONS } from "../auth/permissions";
import { json } from "../test/mockApi";

const admin: Profile = {
  id: 1,
  username: "adminuser",
  role: "admin",
  is_active: true,
  permissions: [...ROLE_PERMISSIONS.admin],
};

const SAMPLE: AuditEvent[] = [
  {
    id: 12,
    occurred_at: "2026-10-20T09:30:00+00:00",
    event_type: "user.role_changed",
    outcome: "success",
    actor: { id: 1, username: "adminuser", role: "admin" },
    target: { type: "user", id: 7, username: "jane.doe" },
    details: { from_role: "member", to_role: "viewer" },
  },
  {
    id: 11,
    occurred_at: "2026-10-20T09:00:00+00:00",
    event_type: "auth.sign_in",
    outcome: "failure",
    actor: null,
    target: null,
    details: { reason: "invalid_credentials", method: "password" },
  },
];

type Handler = (url: URL) => Response | Promise<Response>;

/** Stubs fetch; `audit` answers GET /audit-events and sees the full URL. */
function backend({ profile = admin, audit }: { profile?: Profile; audit?: Handler } = {}) {
  const auditUrls: URL[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "GET" && url.pathname === "/profile") return json({ user: profile });
    if (method === "GET" && url.pathname === "/audit-events") {
      auditUrls.push(url);
      return audit
        ? audit(url)
        : json({ events: SAMPLE, total: SAMPLE.length, page: 1, page_size: 25 });
    }
    throw new Error(`Unhandled request: ${method} ${url.pathname}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("token", "admin.jwt");
  return { fetchMock, auditUrls };
}

/** The table row containing `text` (labels also appear in filter options). */
function row(text: string) {
  // The option exists before the data loads, so wait for an actual row.
  return waitFor(() => {
    const found = screen
      .getAllByText(text)
      .map((element) => element.closest("tr"))
      .find(Boolean);
    if (!found) throw new Error(`No table row contains "${text}" yet`);
    return found;
  });
}

function renderAuditLog() {
  window.history.pushState(null, "", "/audit-log");
  render(<App />);
}

describe("Audit Log access", () => {
  it.each(["member", "manager", "viewer"] as const)(
    "shows %s an access-denied state without calling the API",
    async (role) => {
      const { auditUrls } = backend({
        profile: { id: 9, username: "someone", role, permissions: [...ROLE_PERMISSIONS[role]] },
      });
      renderAuditLog();

      expect(await screen.findByText("The audit log is only available to administrators.")).toBeTruthy();
      expect(auditUrls).toHaveLength(0);
      const link = screen.getByRole("link", { name: /Audit Log/ });
      expect(link.textContent).toContain("(admins only)");
    }
  );

  it("is no longer a placeholder for admins", async () => {
    backend();
    renderAuditLog();

    expect(await screen.findByRole("heading", { level: 1, name: "Audit Log" })).toBeTruthy();
    expect(screen.queryByText(/isn't connected yet/)).toBeNull();
    expect(screen.getByRole("link", { name: /Audit Log/ }).textContent).not.toContain("Soon");
  });
});

describe("Audit Log contents", () => {
  it("lists events with translated labels and sends the bearer token", async () => {
    const { fetchMock, auditUrls } = backend();
    renderAuditLog();

    const roleChange = await row("Role change");
    expect(within(roleChange).getByText("adminuser")).toBeTruthy();
    expect(within(roleChange).getByText("jane.doe")).toBeTruthy();
    expect(within(roleChange).getByText("Succeeded")).toBeTruthy();
    expect(within(roleChange).getByRole("time").getAttribute("dateTime")).toBe(
      "2026-10-20T09:30:00+00:00"
    );

    const signIn = await row("Sign-in");
    expect(within(signIn).getByText("Not signed in")).toBeTruthy();
    expect(within(signIn).getByText("Invalid username or password")).toBeTruthy();
    expect(within(signIn).getByText("Failed")).toBeTruthy();

    expect(screen.getByText("Showing 1–2 of 2 events")).toBeTruthy();
    expect(auditUrls[0].searchParams.toString()).toBe("page=1&page_size=25");
    const init = fetchMock.mock.calls.find(([url]) => String(url).includes("/audit-events"))?.[1];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer admin.jwt");
  });

  it("offers no way to change audit events", async () => {
    backend();
    renderAuditLog();
    const table = (await row("Role change")).closest("table")!;

    // The only control in each row is the read-only details button.
    const actions = within(table).getAllByRole("button").map((button) => button.textContent);
    expect(actions).toEqual(["Details", "Details"]);
    expect(screen.queryByRole("button", { name: /delete|edit|remove/i })).toBeNull();
  });

  it("shows every recorded field in an accessible details dialog", async () => {
    backend();
    renderAuditLog();

    fireEvent.click(await screen.findByRole("button", { name: "View details for event 12" }));
    const dialog = screen.getByRole("dialog", { name: "Event #12" });

    const field = (label: string) =>
      within(dialog).getByText(label, { selector: "dt" }).nextElementSibling?.textContent;
    expect(field("Event")).toBe("Role change");
    expect(field("Outcome")).toBe("Succeeded");
    expect(field("Actor")).toBe("adminuser · Admin · #1");
    expect(field("Target")).toBe("jane.doe · #7");
    expect(field("Previous role")).toBe("Member");
    expect(field("New role")).toBe("Viewer / Auditor");

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("describes role permission changes in plain language", async () => {
    backend({
      audit: () =>
        json({
          events: [
            {
              id: 40,
              occurred_at: "2026-10-20T11:00:00+00:00",
              event_type: "role.permissions_changed",
              outcome: "success",
              actor: { id: 1, username: "adminuser", role: "admin" },
              target: { type: "role", id: null, username: "viewer" },
              details: { role: "viewer", from_permissions: "", to_permissions: "users:read,access_requests:review" },
            },
          ],
          total: 1,
          page: 1,
          page_size: 25,
        }),
    });
    renderAuditLog();

    const tableRow = await row("Role permissions changed");
    expect(within(tableRow).getByText("Viewer / Auditor role")).toBeTruthy();

    fireEvent.click(within(tableRow).getByRole("button", { name: "View details for event 40" }));
    const dialog = screen.getByRole("dialog", { name: "Event #40" });
    const field = (label: string) =>
      within(dialog).getByText(label, { selector: "dt" }).nextElementSibling?.textContent;
    expect(field("Target")).toBe("Viewer / Auditor role");
    expect(field("Permissions before")).toBe("None");
    expect(field("Permissions after")).toBe("View users and Review access requests");
  });

  it("shows unknown event types from a newer API as their code", async () => {
    backend({
      audit: () =>
        json({
          events: [{ ...SAMPLE[0], id: 30, event_type: "billing.changed", details: {} }],
          total: 1,
          page: 1,
          page_size: 25,
        }),
    });
    renderAuditLog();

    expect(await screen.findByText("billing.changed")).toBeTruthy();
  });

  it("is translated", async () => {
    localStorage.setItem("accesshub.language", "ja");
    backend();
    renderAuditLog();

    expect(await screen.findByRole("heading", { level: 1, name: "監査ログ" })).toBeTruthy();
    const translated = await row("ロール変更");
    expect(within(translated).getByText("成功")).toBeTruthy();
  });
});

describe("Audit Log filters and pagination", () => {
  it("sends event, outcome and search filters to the API", async () => {
    const { auditUrls } = backend();
    renderAuditLog();
    await row("Role change");

    fireEvent.change(screen.getByLabelText("Event"), { target: { value: "user.role_changed" } });
    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "success" } });
    fireEvent.change(screen.getByLabelText("Search by username"), { target: { value: "  jane " } });

    await waitFor(() => expect(auditUrls.at(-1)?.searchParams.get("q")).toBe("jane"));
    const params = auditUrls.at(-1)!.searchParams;
    expect(params.get("event_type")).toBe("user.role_changed");
    expect(params.get("outcome")).toBe("success");
    expect(params.get("page")).toBe("1");
  });

  it("turns the date range into whole local days", async () => {
    const { auditUrls } = backend();
    renderAuditLog();
    await row("Role change");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-02" } });

    await waitFor(() => expect(auditUrls.at(-1)?.searchParams.get("until")).toBeTruthy());
    const params = auditUrls.at(-1)!.searchParams;
    expect(params.get("since")).toBe(new Date(2026, 9, 1).toISOString());
    expect(params.get("until")).toBe(new Date(2026, 9, 3).toISOString());
  });

  it("explains an inverted date range instead of sending it", async () => {
    const { auditUrls } = backend();
    renderAuditLog();
    await row("Role change");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-05" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-01" } });

    expect(screen.getByRole("alert").textContent).toBe(
      "The start date must be on or before the end date."
    );
    expect(screen.getByLabelText("From").getAttribute("aria-invalid")).toBe("true");
    // "From" alone was a valid filter; once the range is inverted, neither
    // date is sent.
    await waitFor(() => expect(auditUrls.at(-1)?.searchParams.has("since")).toBe(false));
    expect(auditUrls.at(-1)?.searchParams.has("until")).toBe(false);
  });

  it("pages through results on the server", async () => {
    const { auditUrls } = backend({
      audit: (url) =>
        json({
          events: SAMPLE,
          total: 60,
          page: Number(url.searchParams.get("page")),
          page_size: 25,
        }),
    });
    renderAuditLog();
    expect(await screen.findByText("Showing 1–25 of 60 events")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Showing 26–50 of 60 events")).toBeTruthy();
    expect(auditUrls.at(-1)?.searchParams.get("page")).toBe("2");
  });
});

describe("Audit Log states", () => {
  it("shows an empty state when nothing has been recorded", async () => {
    backend({ audit: () => json({ events: [], total: 0, page: 1, page_size: 25 }) });
    renderAuditLog();

    expect(await screen.findByText("No audit events yet")).toBeTruthy();
  });

  it("shows a no-matches state with a way to clear filters", async () => {
    const { auditUrls } = backend({
      audit: (url) =>
        url.searchParams.has("outcome")
          ? json({ events: [], total: 0, page: 1, page_size: 25 })
          : json({ events: SAMPLE, total: 2, page: 1, page_size: 25 }),
    });
    renderAuditLog();
    await row("Role change");

    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "denied" } });
    expect(await screen.findByText("No events match these filters")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(await row("Role change")).toBeTruthy();
    expect(auditUrls.at(-1)?.searchParams.has("outcome")).toBe(false);
  });

  it("retries after an error", async () => {
    let calls = 0;
    backend({
      audit: () =>
        ++calls === 1
          ? json({ detail: "Boom" }, 500)
          : json({ events: SAMPLE, total: 2, page: 1, page_size: 25 }),
    });
    renderAuditLog();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Audit events couldn't be loaded")).toBeTruthy();
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(await row("Role change")).toBeTruthy();
  });

  it("shows the API's refusal on 403", async () => {
    backend({ audit: () => json({ detail: "You don't have permission to perform this action" }, 403) });
    renderAuditLog();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "The AccessHub API refused access to the audit log: You don't have permission to perform this action"
    );
  });

  it("ends the session on 401", async () => {
    backend({ audit: () => json({ detail: "Invalid or expired token" }, 401) });
    renderAuditLog();

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(localStorage.getItem("token")).toBeNull();
  });
});
