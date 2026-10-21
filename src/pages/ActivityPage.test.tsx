import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ActivityEvent, Profile } from "../api/client";
import App from "../App";
import { ROLE_PERMISSIONS } from "../auth/permissions";
import type { Role } from "../auth/roles";
import { json } from "../test/mockApi";

function profile(role: Role, permissions: readonly string[] = ROLE_PERMISSIONS[role]): Profile {
  return { id: 1, username: `${role}.user`, role, is_active: true, permissions: [...permissions] };
}

const SAMPLE: ActivityEvent[] = [
  {
    id: 12,
    occurred_at: "2026-10-20T15:30:00",
    event_type: "user.role_changed",
    outcome: "success",
    actor: { username: "adminuser", role: "admin" },
    target: { type: "user", username: "jane.doe" },
    details: { from_role: "member", to_role: "viewer" },
  },
  {
    id: 11,
    occurred_at: "2026-10-20T09:00:00",
    event_type: "auth.sign_in",
    outcome: "failure",
    actor: null,
    target: null,
    details: { reason: "invalid_credentials" },
  },
  {
    id: 10,
    occurred_at: "2026-10-19T18:00:00",
    event_type: "access.denied",
    outcome: "denied",
    actor: { username: "sam.lee", role: "member" },
    target: null,
    details: { permission: "users:manage", reason: "missing_permission" },
  },
];

type Handler = (url: URL) => Response | Promise<Response>;

function backend(user: Profile | (() => Profile), activity?: Handler) {
  const activityUrls: URL[] = [];
  const paths: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      paths.push(url.pathname);
      if (url.pathname === "/profile") {
        return json({ user: typeof user === "function" ? user() : user });
      }
      if (url.pathname === "/activity") {
        activityUrls.push(url);
        return activity
          ? activity(url)
          : json({ events: SAMPLE, total: SAMPLE.length, page: 1, page_size: 30 });
      }
      throw new Error(`Unhandled request: ${url.pathname}`);
    })
  );
  localStorage.setItem("token", "user.jwt");
  return { activityUrls, paths };
}

function renderActivity() {
  window.history.pushState(null, "", "/activity");
  render(<App />);
}

/** The feed item containing `text`. */
function item(text: string) {
  return waitFor(() => {
    const found = screen
      .getAllByText(text)
      .map((element) => element.closest(".ah-feed__item"))
      .find(Boolean);
    if (!found) throw new Error(`No feed item contains "${text}" yet`);
    return found as HTMLElement;
  });
}

describe("Activity — feed", () => {
  it("lists recorded events by day with event, actor, target and outcome", async () => {
    backend(profile("manager"));
    renderActivity();

    expect(await screen.findByRole("heading", { level: 1, name: "Activity" })).toBeTruthy();

    const days = await screen.findAllByRole("heading", { level: 3 });
    expect(days.map((day) => day.textContent)).toEqual(["Tuesday, October 20, 2026", "Monday, October 19, 2026"]);

    const roleChange = await item("Role change");
    expect(within(roleChange).getByText("by adminuser")).toBeTruthy();
    expect(within(roleChange).getByText("on jane.doe")).toBeTruthy();
    expect(within(roleChange).getByText("Succeeded")).toBeTruthy();

    const failedSignIn = await item("Sign-in");
    expect(within(failedSignIn).getByText("Not signed in")).toBeTruthy();
    expect(within(failedSignIn).getByText("Invalid username or password")).toBeTruthy();

    expect(screen.getByText("Showing 1–3 of 3 events")).toBeTruthy();
  });

  it("opens an accessible details dialog with only the safe fields", async () => {
    backend(profile("viewer"));
    renderActivity();

    fireEvent.click(await screen.findByRole("button", { name: "View details for event 10" }));
    const dialog = screen.getByRole("dialog", { name: "Event #10" });
    const field = (label: string) =>
      within(dialog).getByText(label, { selector: "dt" }).nextElementSibling?.textContent;

    expect(field("Event")).toBe("Access denied");
    expect(field("Actor")).toBe("sam.lee · Member");
    expect(field("Target")).toBe("—");

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("View details for event 10");
  });

  it("sends filters to the API", async () => {
    const { activityUrls } = backend(profile("admin"));
    renderActivity();
    await item("Role change");

    fireEvent.change(screen.getByLabelText("Event"), { target: { value: "auth.sign_in" } });
    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "failure" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("Search by username"), { target: { value: " jane " } });

    await waitFor(() => expect(activityUrls.at(-1)?.searchParams.get("q")).toBe("jane"));
    const last = activityUrls.at(-1)!;
    expect(last.searchParams.get("event_type")).toBe("auth.sign_in");
    expect(last.searchParams.get("outcome")).toBe("failure");
    expect(new Date(last.searchParams.get("since")!).getDate()).toBe(1);
    expect(new Date(last.searchParams.get("until")!).getDate()).toBe(21);
    expect(last.searchParams.get("page_size")).toBe("30");
  });

  it("distinguishes no matches from an empty feed", async () => {
    backend(profile("admin"), (url) =>
      url.searchParams.has("outcome")
        ? json({ events: [], total: 0, page: 1, page_size: 30 })
        : json({ events: [], total: 0, page: 1, page_size: 30 })
    );
    renderActivity();

    expect(await screen.findByText("No activity yet")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "denied" } });
    expect(await screen.findByText("No events match these filters")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" }).at(-1)!);
    expect(await screen.findByText("No activity yet")).toBeTruthy();
  });

  it("pages through results on the server", async () => {
    const { activityUrls } = backend(profile("admin"), (url) =>
      json({
        events: SAMPLE.map((event) => ({ ...event, id: event.id + Number(url.searchParams.get("page")) * 100 })),
        total: 75,
        page: Number(url.searchParams.get("page")),
        page_size: 30,
      })
    );
    renderActivity();

    expect(await screen.findByText("Showing 1–30 of 75 events")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Showing 31–60 of 75 events")).toBeTruthy();
    expect(activityUrls.at(-1)?.searchParams.get("page")).toBe("2");
  });

  it("retries after an error", async () => {
    let fail = true;
    backend(profile("admin"), () =>
      fail ? json({ detail: "boom" }, 500) : json({ events: SAMPLE, total: 3, page: 1, page_size: 30 })
    );
    renderActivity();

    expect(await screen.findByText("Activity couldn't be loaded")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await item("Role change")).toBeTruthy();
  });

  it("shows the API's refusal and refreshes permissions on 403", async () => {
    let permissions: string[] = [...ROLE_PERMISSIONS.viewer];
    const { paths } = backend(
      () => profile("viewer", permissions),
      () => {
        permissions = [];
        return json({ detail: "You don't have permission to perform this action" }, 403);
      }
    );
    renderActivity();

    // Once the profile is re-read, the page explains the role can't see activity.
    expect(await screen.findByText("Activity isn't available for your role")).toBeTruthy();
    await waitFor(() => expect(paths.filter((path) => path === "/profile").length).toBeGreaterThan(1));
    const nav = screen.getByRole("navigation", { name: "Main" });
    await waitFor(() =>
      expect(within(nav).getByRole("link", { name: /Activity/ }).textContent).toBe(
        "Activity (not available for your role)"
      )
    );
  });

  it("ends the session on 401", async () => {
    backend(profile("admin"), () => json({ detail: "Invalid or expired token" }, 401));
    renderActivity();

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("is translated", async () => {
    localStorage.setItem("accesshub.language", "ko");
    backend(profile("admin"));
    renderActivity();

    expect(await screen.findByRole("heading", { level: 1, name: "활동" })).toBeTruthy();
    expect(within(await item("역할 변경")).getByText("수행자: adminuser")).toBeTruthy();
  });
});

describe("Activity — access", () => {
  it("is closed to members by default, without calling the API", async () => {
    const { activityUrls } = backend(profile("member"));
    renderActivity();

    expect(await screen.findByText("Activity isn't available for your role")).toBeTruthy();
    expect(activityUrls).toHaveLength(0);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: /Activity/ }).textContent).toBe(
      "Activity (not available for your role)"
    );
  });

  it("is open to Viewer / Auditor accounts while the Audit Log stays locked", async () => {
    backend(profile("viewer"));
    renderActivity();

    await item("Role change");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: /Activity/ }).textContent).toBe("Activity");
    expect(within(nav).getByRole("link", { name: /Audit Log/ }).textContent).toBe("Audit Log (admins only)");
  });

  it("follows a policy change granting members access", async () => {
    let permissions: string[] = ["access_requests:submit"];
    backend(() => profile("member", permissions));
    renderActivity();

    expect(await screen.findByText("Activity isn't available for your role")).toBeTruthy();

    permissions = ["access_requests:submit", "activity:read"];
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    fireEvent.focus(window);

    expect(await item("Role change")).toBeTruthy();
  });
});
