import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import App from "./App";
import {
  authorizationHeader,
  callsTo,
  json,
  makeUsers,
  mockApi,
  networkError,
} from "./test/mockApi";

const admin = { id: 4, username: "adminuser", role: "admin" };
const member = { id: 7, username: "member", role: "user" };

function signIn(token = "valid.jwt") {
  localStorage.setItem("token", token);
}

function renderAt(path: string) {
  window.history.pushState(null, "", path);
  return render(<App />);
}

async function expectLoginPage() {
  expect(
    await screen.findByRole("button", { name: "Sign in" })
  ).toBeTruthy();
}

function statValue(label: string) {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling
    ?.textContent;
}

describe("profile and session handling", () => {
  it("redirects to login when there is no token", async () => {
    const fetchMock = mockApi({});

    renderAt("/dashboard");

    await expectLoginPage();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the session and returns to login on a 401 from /profile", async () => {
    signIn("expired.jwt");
    const fetchMock = mockApi({
      "GET /profile": () => json({ detail: "Invalid or expired token" }, 401),
    });

    renderAt("/dashboard");

    await expectLoginPage();
    expect(localStorage.getItem("token")).toBeNull();
    expect(authorizationHeader(callsTo(fetchMock, "/profile")[0][1])).toBe(
      "Bearer expired.jwt"
    );
  });

  it.each([
    ["a 5xx response", () => json({ detail: "Internal Server Error" }, 503)],
    ["a network failure", networkError],
  ])("keeps the session and offers a retry after %s", async (_, failure) => {
    signIn();
    let calls = 0;
    mockApi({
      "GET /profile": () => (++calls === 1 ? failure() : json({ user: member })),
    });

    renderAt("/dashboard");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("We couldn't load your profile")).toBeTruthy();
    expect(localStorage.getItem("token")).toBe("valid.jwt");

    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Access overview" })
    ).toBeTruthy();
  });

  it("shows access denied for a 403 without treating the token as expired", async () => {
    signIn();
    const fetchMock = mockApi({
      "GET /profile": () => json({ detail: "Account disabled" }, 403),
    });

    renderAt("/dashboard");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Access denied")).toBeTruthy();
    expect(alert.textContent).toContain("Account disabled");
    expect(localStorage.getItem("token")).toBe("valid.jwt");
    expect(callsTo(fetchMock, "/users")).toHaveLength(0);
  });

  it("signs out from the sidebar", async () => {
    signIn();
    mockApi({ "GET /profile": () => json({ user: member }) });

    renderAt("/dashboard");
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    await expectLoginPage();
    expect(localStorage.getItem("token")).toBeNull();
  });
});

describe("non-admin users", () => {
  it.each(["/dashboard", "/admin"])(
    "never requests /users on %s and explains why",
    async (path) => {
      signIn();
      const fetchMock = mockApi({ "GET /profile": () => json({ user: member }) });

      renderAt(path);

      expect(await screen.findByText("The user directory isn't available for your role")).toBeTruthy();
      expect(callsTo(fetchMock, "/users")).toHaveLength(0);
    }
  );
});

describe("admin user directory", () => {
  function mockAdmin(usersResponse: () => Response | Promise<Response>) {
    signIn("admin.jwt");
    return mockApi({
      "GET /profile": () => json({ user: { ...admin, role: "Admin" } }),
      "GET /users": usersResponse,
    });
  }

  it("loads users with the bearer token and derives totals from the response", async () => {
    const fetchMock = mockAdmin(() => json({ users: makeUsers(124) }));

    renderAt("/dashboard");

    expect(await screen.findByText("Showing 1–10 of 124 users")).toBeTruthy();
    expect(authorizationHeader(callsTo(fetchMock, "/users")[0][1])).toBe(
      "Bearer admin.jwt"
    );
    expect(statValue("Total users")).toBe("124");
    expect(statValue("Active users")).toBe("124");
    expect(statValue("Administrators")).toBe("12");
    expect(statValue("Roles in use")).toBe("2");
  });

  it("paginates, filters by role and searches", async () => {
    mockAdmin(() => json(makeUsers(124)));

    renderAt("/dashboard");
    await screen.findByText("Showing 1–10 of 124 users");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 11–20 of 124 users")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")
    ).toBe("page");

    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "admin" } });
    expect(
      screen.getByText("Showing 1–10 of 12 matching users (124 total)")
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "user120" },
    });
    expect(
      screen.getByText("Showing 1–1 of 1 matching user (124 total)")
    ).toBeTruthy();
    expect(screen.getByRole("cell", { name: /user120/ })).toBeTruthy();
  });

  it("shows an empty state with a reset when nothing matches", async () => {
    mockAdmin(() => json(makeUsers(124)));

    renderAt("/dashboard");
    await screen.findByText("Showing 1–10 of 124 users");

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "nobody-here" },
    });
    expect(screen.getByText("No users match these filters")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Showing 1–10 of 124 users")).toBeTruthy();
  });

  it("shows an empty state when the API returns no users", async () => {
    mockAdmin(() => json({ users: [] }));

    renderAt("/admin");

    expect(await screen.findByText("No users returned")).toBeTruthy();
  });

  it("treats a 401 from /users as an expired session", async () => {
    mockAdmin(() => json({ detail: "Invalid or expired token" }, 401));

    renderAt("/admin");

    await expectLoginPage();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("shows access denied for a 403 from /users and keeps the session", async () => {
    mockAdmin(() => json({ detail: "Admin access required" }, 403));

    renderAt("/admin");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Access denied")).toBeTruthy();
    expect(alert.textContent).toContain("Admin access required");
    expect(localStorage.getItem("token")).toBe("admin.jwt");
  });

  it("retries after a server error", async () => {
    let calls = 0;
    mockAdmin(() =>
      ++calls === 1 ? json({ detail: "Boom" }, 500) : json(makeUsers(3))
    );

    renderAt("/admin");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Users couldn't be loaded")).toBeTruthy();

    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Showing 1–3 of 3 users")).toBeTruthy();
  });

  it("opens the users page from the top-bar search", async () => {
    mockAdmin(() => json(makeUsers(124)));

    renderAt("/dashboard");
    await screen.findByText("Showing 1–10 of 124 users");

    const search = screen.getByRole("searchbox", { name: "Search users" });
    fireEvent.change(search, { target: { value: "user007" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Users" })
    ).toBeTruthy();
    expect(
      await screen.findByText("Showing 1–1 of 1 matching user (124 total)")
    ).toBeTruthy();
  });
});

describe("shell navigation", () => {
  it("lists the main sections in order with help and sign out at the bottom", async () => {
    signIn();
    mockApi({ "GET /profile": () => json({ user: member }) });

    renderAt("/dashboard");

    const main = await screen.findByRole("navigation", { name: "Main" });
    const labels = within(main)
      .getAllByRole("link")
      .map((link) => link.querySelector(".ah-nav__label")?.textContent);

    expect(labels).toEqual([
      "Dashboard",
      "Users",
      "Access Request",
      "Roles",
      "Activity",
      "Audit Log",
      "Settings",
    ]);
    expect(
      within(main).getByRole("link", { name: /Dashboard/ }).getAttribute("aria-current")
    ).toBe("page");

    const footer = screen.getByRole("link", { name: "Help & support" }).closest("ul");
    const footerItems = within(footer as HTMLElement).getAllByRole("listitem");
    expect(footerItems.map((item) => item.textContent)).toEqual([
      "Help & support",
      "Sign out",
    ]);
  });

  it("has no placeholder sections left; Settings explains it's for admins", async () => {
    signIn();
    mockApi({ "GET /profile": () => json({ user: member }) });

    renderAt("/settings");

    expect(await screen.findByText("Only administrators can change settings")).toBeTruthy();
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).queryByText("Soon")).toBeNull();
    expect(within(main).getByRole("link", { name: /Settings/ }).textContent).toBe(
      "Settings (admins only)"
    );
  });

  it("shows the latest recorded activity from the API", async () => {
    signIn();
    const fetchMock = mockApi({
      "GET /profile": () => json({ user: admin }),
      "GET /users": () => json(makeUsers(5)),
      "GET /activity": () =>
        json({
          events: [
            {
              id: 3,
              occurred_at: "2026-10-20T09:30:00+00:00",
              event_type: "auth.sign_in",
              outcome: "failure",
              actor: null,
              target: { type: "user", username: "jane.doe" },
              details: { reason: "invalid_credentials" },
            },
          ],
          total: 1,
          page: 1,
          page_size: 5,
        }),
    });

    renderAt("/dashboard");

    const panel = await screen.findByRole("region", { name: "Recent activity" });
    expect(await within(panel).findByText("Sign-in")).toBeTruthy();
    expect(within(panel).getByText("on jane.doe")).toBeTruthy();
    expect(within(panel).getByRole("link", { name: "View all activity" }).getAttribute("href")).toBe(
      "/activity"
    );
    const activityCall = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .find((url) => url.pathname === "/activity");
    expect(activityCall?.searchParams.get("page_size")).toBe("5");
  });

  it("explains when a role can't see activity, without asking the API", async () => {
    signIn();
    const fetchMock = mockApi({
      "GET /profile": () => json({ user: member }),
    });

    renderAt("/dashboard");

    expect(await screen.findByText("Organisation activity isn't available for your role")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) => new URL(String(input)).pathname === "/activity")
    ).toBe(false);
  });
});

describe("demo sessions", () => {
  it("marks the app as a demo environment", async () => {
    vi.stubEnv("VITE_DEMO_API_URL", "https://demo-api.example.test");
    localStorage.setItem("token", "demo.jwt");
    localStorage.setItem("accesshub.session", "demo");
    mockApi({
      "GET /profile": () => json({ user: admin }),
      "GET /users": () => json(makeUsers(5)),
    });

    renderAt("/dashboard");

    expect(
      await screen.findByText(
        "Demo environment: you're exploring synthetic data. Changes only affect the demo."
      )
    ).toBeTruthy();
  });

  it("does not show the demo banner for normal sessions", async () => {
    signIn();
    mockApi({ "GET /profile": () => json({ user: member }) });

    renderAt("/dashboard");

    await screen.findByRole("heading", { level: 1, name: "Access overview" });
    expect(screen.queryByText(/^Demo environment:/)).toBeNull();
  });
});
