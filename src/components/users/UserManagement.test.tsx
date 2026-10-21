import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Profile, User } from "../../api/client";
import App from "../../App";
import { ROLE_PERMISSIONS } from "../../auth/permissions";
import { authorizationHeader, json, makeUsers } from "../../test/mockApi";

type Handler = (init?: RequestInit) => Response | Promise<Response>;

const TEMP_PASSWORD = "Tmp-Pass-1234567890abcd";

const adminProfile: Profile = {
  id: 999,
  username: "adminuser",
  role: "admin",
  is_active: true,
  permissions: [...ROLE_PERMISSIONS.admin],
};

/**
 * In-memory stand-in for the user-management API, following its contract.
 * `overrides` replace individual "METHOD /path" routes.
 */
function fakeBackend({
  profile = adminProfile,
  users = makeUsers(30),
  overrides = {},
}: {
  profile?: Profile | (() => Profile);
  users?: User[];
  overrides?: Record<string, Handler>;
} = {}) {
  const state = { users: users.map((user) => ({ ...user })), nextId: 1000 };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${url.pathname}`;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    if (overrides[key]) return overrides[key](init);

    if (key === "GET /profile") {
      return json({ user: typeof profile === "function" ? profile() : profile });
    }
    if (key === "GET /users") return json({ users: state.users });

    if (key === "POST /users") {
      const user = {
        id: state.nextId++,
        username: body.username,
        role: body.role,
        is_active: true,
        is_seed: false,
        must_change_password: true,
      };
      state.users.push(user);
      return json({ message: "User created", user, temporary_password: TEMP_PASSWORD });
    }

    const match = /^\/users\/(\d+)(?:\/(deactivate|reactivate))?$/.exec(url.pathname);
    const user = match && state.users.find((item) => item.id === Number(match[1]));

    if (match && !user) return json({ detail: "User not found" }, 404);

    if (user && method === "PUT") {
      Object.assign(user, body);
      return json({ message: "User updated", user });
    }
    if (user && match?.[2]) {
      user.is_active = match[2] === "reactivate";
      return json({ message: `User ${match[2]}d`, user });
    }
    if (user && method === "DELETE") {
      state.users = state.users.filter((item) => item !== user);
      return json({ message: "User deleted", deleted_user: user });
    }

    throw new Error(`Unhandled request: ${key}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("token", "admin.jwt");

  function requests(method: string, path: string) {
    return fetchMock.mock.calls.filter(
      ([input, init]) =>
        new URL(String(input)).pathname === path &&
        (init?.method ?? "GET").toUpperCase() === method
    );
  }

  return { state, requests };
}

function renderAt(path: string) {
  window.history.pushState(null, "", path);
  render(<App />);
}

async function openRowMenu(username: string) {
  fireEvent.click(await screen.findByRole("button", { name: `Actions for ${username}` }));
  return screen.getByRole("menu", { name: `Actions for ${username}` });
}

async function chooseRowAction(username: string, action: RegExp) {
  const menu = await openRowMenu(username);
  fireEvent.click(within(menu).getByRole("menuitem", { name: action }));
}

function bodyOf(call: unknown[]) {
  return JSON.parse(String((call[1] as RequestInit).body));
}

describe("access to user management", () => {
  it("shows add and row actions to admins", async () => {
    fakeBackend();
    renderAt("/admin");

    expect(await screen.findByRole("button", { name: "Add user" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Actions for user001" })).toBeTruthy();
  });

  it.each(["manager", "member", "viewer"] as const)(
    "gives %s no user directory or management controls",
    async (role) => {
      const { requests } = fakeBackend({
        profile: { id: 7, username: "someone", role, permissions: [...ROLE_PERMISSIONS[role]] },
      });
      renderAt("/admin");

      expect(await screen.findByText("The user directory isn't available for your role")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Add user" })).toBeNull();
      expect(requests("GET", "/users")).toHaveLength(0);
    }
  );

  it("follows the permissions the API sends over the role name", async () => {
    const { requests } = fakeBackend({
      profile: { ...adminProfile, permissions: ["audit:read"] },
    });
    renderAt("/admin");

    expect(await screen.findByText("The user directory isn't available for your role")).toBeTruthy();
    expect(requests("GET", "/users")).toHaveLength(0);
  });
});

describe("creating users", () => {
  it("validates, creates and shows the temporary password once", async () => {
    const consoleSpies = (["log", "info", "debug", "warn", "error"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {})
    );
    const { requests } = fakeBackend();
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Add user" }));
    const dialog = screen.getByRole("dialog", { name: "Add user" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Create user" }));
    expect(within(dialog).getByText("Enter a username.")).toBeTruthy();
    expect(requests("POST", "/users")).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText("Username"), {
      target: { value: "bad name!" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create user" }));
    expect(
      within(dialog).getByText("Use 3–50 letters, numbers, dots, underscores or hyphens.")
    ).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText("Username"), {
      target: { value: "new.hire" },
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: /^Manager/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create user" }));

    const passwordDialog = await screen.findByRole("dialog", {
      name: "Temporary password for new.hire",
    });
    expect(
      (within(passwordDialog).getByLabelText("Temporary password") as HTMLInputElement).value
    ).toBe(TEMP_PASSWORD);

    const [createCall] = requests("POST", "/users");
    expect(bodyOf(createCall)).toEqual({ username: "new.hire", role: "manager" });
    expect(authorizationHeader(createCall[1] as RequestInit)).toBe("Bearer admin.jwt");

    fireEvent.click(within(passwordDialog).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("new.hire was created.")).toBeTruthy();

    // The list was refreshed and now includes the new account.
    await waitFor(() => expect(requests("GET", "/users")).toHaveLength(2));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "new.hire" } });
    const row = (await screen.findByRole("cell", { name: /new\.hire/ })).closest("tr")!;
    expect(within(row).getByText("Manager")).toBeTruthy();
    expect(within(row).getByText("Password change pending")).toBeTruthy();

    const logged = JSON.stringify(consoleSpies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(TEMP_PASSWORD);
  });

  it("shows a duplicate username as a field error", async () => {
    fakeBackend({
      overrides: { "POST /users": () => json({ detail: "Username already exists" }, 400) },
    });
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Add user" }));
    const dialog = screen.getByRole("dialog", { name: "Add user" });
    const username = within(dialog).getByLabelText("Username");
    fireEvent.change(username, { target: { value: "user001" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create user" }));

    expect(await within(dialog).findByText("That username is already taken.")).toBeTruthy();
    expect(username.getAttribute("aria-invalid")).toBe("true");
  });
});

describe("editing users", () => {
  it("changes a role and keeps the table's search and filters", async () => {
    const { requests } = fakeBackend();
    renderAt("/admin");

    fireEvent.change(await screen.findByLabelText("Search"), { target: { value: "user00" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "member" } });
    expect(screen.getByText("Showing 1–9 of 9 matching users (30 total)")).toBeTruthy();

    await chooseRowAction("user005", /^Edit/);
    const dialog = screen.getByRole("dialog", { name: "Edit user005" });
    fireEvent.click(within(dialog).getByRole("radio", { name: /^Viewer \/ Auditor/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("user005 was updated.")).toBeTruthy();
    expect(bodyOf(requests("PUT", "/users/5")[0])).toEqual({
      username: "user005",
      role: "viewer",
    });

    // Refreshed in place: user005 is now a viewer, filters untouched.
    expect(await screen.findByText("Showing 1–8 of 8 matching users (30 total)")).toBeTruthy();
    expect((screen.getByLabelText("Search") as HTMLInputElement).value).toBe("user00");
    expect((screen.getByLabelText("Role") as HTMLSelectElement).value).toBe("member");
  });

  it("protects the signed-in admin's own account", async () => {
    fakeBackend({ profile: { ...adminProfile, id: 4, username: "user004" } });
    renderAt("/admin");

    const menu = await openRowMenu("user004");
    const deactivate = within(menu).getByRole("menuitem", { name: /^Deactivate/ });
    expect(deactivate.getAttribute("aria-disabled")).toBe("true");
    expect(deactivate.textContent).toContain("This is your account");

    // A disabled item does nothing and leaves the menu open.
    fireEvent.click(deactivate);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("menu", { name: "Actions for user004" })).toBeTruthy();

    fireEvent.keyDown(deactivate, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Actions for user004" })
    );

    await chooseRowAction("user004", /^Edit/);
    const dialog = screen.getByRole("dialog", { name: "Edit user004" });
    expect(within(dialog).getByText("You can't change your own role.")).toBeTruthy();
    // Disabled through the role fieldset, so every option is unusable.
    for (const radio of within(dialog).getAllByRole("radio")) {
      expect(radio.matches(":disabled")).toBe(true);
    }
  });

  it("explains why the last active admin can't be deactivated", async () => {
    fakeBackend({ users: makeUsers(12) });
    renderAt("/admin");

    const menu = await openRowMenu("user010");
    const deactivate = within(menu).getByRole("menuitem", { name: /^Deactivate/ });

    expect(deactivate.getAttribute("aria-disabled")).toBe("true");
    expect(deactivate.textContent).toContain("Last active admin");
  });
});

describe("deactivating and deleting users", () => {
  it("deactivates, then permanently deletes only after typing the username", async () => {
    const { requests } = fakeBackend();
    renderAt("/admin");

    const menu = await openRowMenu("user003");
    const deleteItem = within(menu).getByRole("menuitem", { name: /^Delete permanently/ });
    expect(deleteItem.getAttribute("aria-disabled")).toBe("true");
    expect(deleteItem.textContent).toContain("Deactivate first");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /^Deactivate/ }));

    const confirmDialog = screen.getByRole("dialog", { name: "Deactivate user003?" });
    expect(document.activeElement).toBe(
      within(confirmDialog).getByRole("button", { name: "Cancel" })
    );
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "Deactivate" }));

    expect(await screen.findByText("user003 was deactivated.")).toBeTruthy();
    expect(requests("POST", "/users/3/deactivate")).toHaveLength(1);
    const row = (await screen.findByRole("cell", { name: /user003/ })).closest("tr")!;
    expect(await within(row).findByText("Deactivated")).toBeTruthy();

    await chooseRowAction("user003", /^Delete permanently/);
    const deleteDialog = screen.getByRole("dialog", { name: "Permanently delete user003?" });
    const confirmButton = within(deleteDialog).getByRole("button", { name: "Delete permanently" });
    const typed = within(deleteDialog).getByLabelText("Type user003 to confirm");

    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(typed, { target: { value: "user00" } });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(typed, { target: { value: "user003" } });
    fireEvent.click(confirmButton);

    const notice = await screen.findByText("user003 was permanently deleted.");
    expect(requests("DELETE", "/users/3")).toHaveLength(1);
    expect(document.activeElement).toBe(notice.closest(".ah-notice"));
    await waitFor(() => expect(screen.queryByRole("cell", { name: /user003/ })).toBeNull());
  });

  it("reactivates a deactivated user", async () => {
    const users = makeUsers(30).map((user) =>
      user.id === 8 ? { ...user, is_active: false } : user
    );
    const { requests } = fakeBackend({ users });
    renderAt("/admin");

    await chooseRowAction("user008", /^Reactivate/);
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Reactivate user008?" })).getByRole("button", {
        name: "Reactivate",
      })
    );

    expect(await screen.findByText("user008 was reactivated.")).toBeTruthy();
    expect(requests("POST", "/users/8/reactivate")).toHaveLength(1);
  });

  it("closes a dialog with Escape without sending anything", async () => {
    const { requests } = fakeBackend();
    renderAt("/admin");

    await chooseRowAction("user002", /^Deactivate/);
    const dialog = screen.getByRole("dialog", { name: "Deactivate user002?" });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(requests("POST", "/users/2/deactivate")).toHaveLength(0);
  });
});

describe("failures during changes", () => {
  it("ends the session on 401", async () => {
    fakeBackend({
      overrides: {
        "POST /users/2/deactivate": () => json({ detail: "Invalid or expired token" }, 401),
      },
    });
    renderAt("/admin");

    await chooseRowAction("user002", /^Deactivate/);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" })
    );

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("shows access denied on 403 and keeps the session", async () => {
    fakeBackend({
      overrides: {
        "POST /users/2/deactivate": () =>
          json({ detail: "You don't have permission to perform this action" }, 403),
      },
    });
    renderAt("/admin");

    await chooseRowAction("user002", /^Deactivate/);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));

    expect(
      await within(dialog).findByText(
        "You don't have permission to do this. The AccessHub API refused the request."
      )
    ).toBeTruthy();
    expect(localStorage.getItem("token")).toBe("admin.jwt");
  });

  it("shows the API's reason when a safeguard refuses a change", async () => {
    fakeBackend({
      overrides: {
        "POST /users/2/deactivate": () =>
          json({ detail: "Cannot deactivate the last active admin" }, 409),
      },
    });
    renderAt("/admin");

    await chooseRowAction("user002", /^Deactivate/);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));

    expect(
      await within(dialog).findByText(
        "The AccessHub API didn't allow this change: Cannot deactivate the last active admin"
      )
    ).toBeTruthy();
  });
});

describe("status and demo data", () => {
  it("filters by status and labels demo accounts", async () => {
    const users = [
      ...makeUsers(5),
      { id: 50, username: "demo.ava.carter", role: "viewer", is_active: false, is_seed: true },
    ];
    fakeBackend({ users });
    renderAt("/admin");

    const row = (await screen.findByRole("cell", { name: /demo\.ava\.carter/ })).closest("tr")!;
    expect(within(row).getByText("Demo")).toBeTruthy();
    expect(row.textContent).toContain("synthetic demo account");

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "inactive" } });

    expect(screen.getByText("Showing 1–1 of 1 matching user (6 total)")).toBeTruthy();
    expect(screen.getByRole("cell", { name: /demo\.ava\.carter/ })).toBeTruthy();
  });
});

describe("temporary passwords", () => {
  it("requires a new password before showing any page", async () => {
    let mustChange = true;
    const { requests } = fakeBackend({
      profile: () => ({
        id: 7,
        username: "new.hire",
        role: "member",
        must_change_password: mustChange,
        permissions: ["access_requests:submit"],
      }),
      overrides: {
        "POST /profile/password": (init) => {
          const body = JSON.parse(String(init?.body));
          if (body.current_password !== TEMP_PASSWORD) {
            return json({ detail: "Current password is incorrect" }, 400);
          }
          mustChange = false;
          return json({ message: "Password updated" });
        },
      },
    });
    renderAt("/dashboard");

    expect(await screen.findByRole("heading", { level: 1, name: "Choose a new password" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Access overview" })).toBeNull();

    const current = screen.getByLabelText("Current password");
    const next = screen.getByLabelText("New password");
    const confirm = screen.getByLabelText("Confirm new password");
    const submit = screen.getByRole("button", { name: "Update password" });

    fireEvent.change(current, { target: { value: "wrong-password" } });
    fireEvent.change(next, { target: { value: "short" } });
    fireEvent.click(submit);
    expect(screen.getByText("Use at least 12 characters.")).toBeTruthy();

    fireEvent.change(next, { target: { value: "a-brand-new-password" } });
    fireEvent.change(confirm, { target: { value: "a-different-password" } });
    fireEvent.click(submit);
    expect(screen.getByText("The passwords don't match.")).toBeTruthy();

    fireEvent.change(confirm, { target: { value: "a-brand-new-password" } });
    fireEvent.click(submit);
    expect(await screen.findByText("Your current password is incorrect.")).toBeTruthy();

    fireEvent.change(current, { target: { value: TEMP_PASSWORD } });
    fireEvent.click(submit);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Access overview" })
    ).toBeTruthy();
    expect(bodyOf(requests("POST", "/profile/password").at(-1)!)).toEqual({
      current_password: TEMP_PASSWORD,
      new_password: "a-brand-new-password",
    });
  });
});
