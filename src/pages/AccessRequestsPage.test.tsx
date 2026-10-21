import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AccessRequest, Profile } from "../api/client";
import App from "../App";
import { ROLE_PERMISSIONS } from "../auth/permissions";
import type { Role } from "../auth/roles";
import { json } from "../test/mockApi";

function profile(id: number, username: string, role: Role): Profile {
  return { id, username, role, is_active: true, permissions: [...ROLE_PERMISSIONS[role]] };
}

const admin = profile(1, "adminuser", "admin");
const manager = profile(2, "maria.manager", "manager");
const member = profile(3, "jane.doe", "member");
const viewer = profile(4, "victor.viewer", "viewer");

function accessRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    id: 7,
    status: "pending",
    requested_role: "viewer",
    reason: "Need to read the audit log for the quarterly review.",
    submitted_at: "2026-10-20T09:30:00+00:00",
    is_seed: false,
    requester: {
      id: 3,
      username: "jane.doe",
      role_at_submission: "member",
      current_username: "jane.doe",
      current_role: "member",
    },
    decision: null,
    can_decide: true,
    decision_block_reason: null,
    ...overrides,
  };
}

const page = (requests: AccessRequest[], total = requests.length) =>
  json({ requests, total, page: 1, page_size: 25 });

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

/** Stubs fetch; handlers are keyed by "METHOD /path". */
function backend(user: Profile, handlers: Record<string, Handler> = {}) {
  const calls: Array<{ method: string; url: URL; body?: unknown }> = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });

    if (method === "GET" && url.pathname === "/profile") return json({ user });
    const handler = handlers[`${method} ${url.pathname}`];
    if (handler) return handler(url, init);
    throw new Error(`Unhandled request: ${method} ${url.pathname}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("token", "user.jwt");

  const requestCalls = () => calls.filter(({ url }) => url.pathname.startsWith("/access-requests"));
  return { calls, requestCalls };
}

function renderRequests() {
  window.history.pushState(null, "", "/access-requests");
  render(<App />);
}

/** The table row containing `text` (labels also appear in filter options). */
function row(text: string) {
  return waitFor(() => {
    const found = screen
      .getAllByText(text)
      .map((element) => element.closest("tr"))
      .find(Boolean);
    if (!found) throw new Error(`No table row contains "${text}" yet`);
    return found;
  });
}

function reviewerApi(requests: AccessRequest[], extra: Record<string, Handler> = {}) {
  const pending = requests.filter((request) => request.status === "pending");
  return {
    "GET /access-requests/summary": () => json({ pending_total: pending.length, recent: pending }),
    "GET /access-requests": () => page(requests),
    ...extra,
  };
}

describe("Access requests — members", () => {
  it("submits a request and shows it in the member's history", async () => {
    let mine: AccessRequest[] = [];
    const { calls } = backend(member, {
      "GET /access-requests/mine": () => page(mine),
      "POST /access-requests": () => {
        mine = [accessRequest({ can_decide: false, decision_block_reason: "own_request" })];
        return json({ request: mine[0] }, 201);
      },
    });

    renderRequests();

    expect(await screen.findByText("No requests yet")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "New requests" })).toBeNull();

    const roleSelect = screen.getByLabelText("Role you need") as HTMLSelectElement;
    const optionValues = Array.from(roleSelect.options).map((option) => option.value);
    // Never Admin, and not the member's current role.
    expect(optionValues).toEqual(["", "manager", "viewer"]);

    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    expect(await screen.findByText("Choose the role you need.")).toBeTruthy();
    expect(calls.some(({ method }) => method === "POST")).toBe(false);

    fireEvent.change(roleSelect, { target: { value: "viewer" } });
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "  Need to read the audit log for the quarterly review.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(
      await screen.findByText("Your request was submitted. You'll see the decision here.")
    ).toBeTruthy();
    const post = calls.find(({ method }) => method === "POST");
    expect(post?.body).toEqual({
      requested_role: "viewer",
      reason: "Need to read the audit log for the quarterly review.",
    });

    const history = screen.getByRole("region", { name: "My requests" });
    expect(await within(history).findByText("Pending")).toBeTruthy();
    expect(
      screen.getByText(/You have a pending request for Viewer \/ Auditor/)
    ).toBeTruthy();
  });

  it("shows decided requests with the reviewer and note", async () => {
    backend(member, {
      "GET /access-requests/mine": () =>
        page([
          accessRequest({
            status: "declined",
            can_decide: false,
            decision_block_reason: "not_pending",
            decision: {
              decided_at: "2026-10-20T10:00:00+00:00",
              note: "Please ask your team lead first.",
              reviewer: { id: 2, username: "maria.manager", role: "manager" },
            },
          }),
        ]),
    });

    renderRequests();

    const history = await screen.findByRole("region", { name: "My requests" });
    expect(await within(history).findByText("Declined")).toBeTruthy();
    expect(within(history).getByText(/by maria\.manager/)).toBeTruthy();
    expect(within(history).getByText("Please ask your team lead first.")).toBeTruthy();
  });

  it("translates a duplicate pending request error", async () => {
    backend(member, {
      "GET /access-requests/mine": () => page([]),
      "POST /access-requests": () =>
        json({ detail: "You already have a pending access request" }, 409),
    });

    renderRequests();
    await screen.findByText("No requests yet");

    fireEvent.change(screen.getByLabelText("Role you need"), { target: { value: "manager" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Leading a team now." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(
      (await screen.findByRole("alert")).textContent
    ).toBe("You already have a pending request. You can submit another once it's decided.");
  });

  it("shows a retry state when history can't load", async () => {
    let fail = true;
    backend(member, {
      "GET /access-requests/mine": () =>
        fail ? json({ detail: "boom" }, 500) : page([]),
    });

    renderRequests();

    expect(await screen.findByText("Access requests couldn't be loaded")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No requests yet")).toBeTruthy();
  });

  it("ends the session when the API says the token expired", async () => {
    backend(member, {
      "GET /access-requests/mine": () => json({ detail: "Could not validate credentials" }, 401),
    });

    renderRequests();

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(localStorage.getItem("token")).toBeNull();
  });
});

describe("Access requests — reviewers", () => {
  it("shows the new requests box, the queue and Demo labels", async () => {
    const seeded = accessRequest({
      id: 8,
      is_seed: true,
      requester: {
        id: 9,
        username: "demo.member.07",
        role_at_submission: "member",
        current_username: "demo.member.07",
        current_role: "member",
      },
    });
    backend(admin, reviewerApi([accessRequest(), seeded]));

    renderRequests();

    const box = await screen.findByRole("region", { name: "New requests" });
    expect(await within(box).findByText("requests waiting for review")).toBeTruthy();
    expect(within(box).getByText("2")).toBeTruthy();
    expect(within(box).getByText("Demo")).toBeTruthy();
    expect(within(box).getByRole("button", { name: "Review request from jane.doe" })).toBeTruthy();

    const seededRow = await row("demo.member.07");
    expect(within(seededRow).getByText("Demo")).toBeTruthy();
    const realRow = await row("jane.doe");
    expect(within(realRow).queryByText("Demo")).toBeNull();
    expect(within(realRow).getByText("Member")).toBeTruthy();
    expect(within(realRow).getByText("Viewer / Auditor")).toBeTruthy();

    // Admins don't get the request form.
    expect(screen.queryByLabelText("Role you need")).toBeNull();
  });

  it("sends filters to the API and distinguishes no matches from empty", async () => {
    const { requestCalls } = backend(
      admin,
      reviewerApi([], {
        "GET /access-requests": (url) => page(url.search.includes("status") ? [] : [accessRequest()]),
      })
    );

    renderRequests();
    await row("jane.doe");

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "approved" } });
    fireEvent.change(screen.getByLabelText("Requested role"), { target: { value: "manager" } });
    fireEvent.change(screen.getByLabelText("Submitted from"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Submitted to"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("Search by requester"), { target: { value: " jane " } });

    expect(await screen.findByText("No requests match these filters")).toBeTruthy();

    await waitFor(() => {
      const last = requestCalls().filter(({ url }) => url.pathname === "/access-requests").at(-1)!;
      expect(last.url.searchParams.get("q")).toBe("jane");
    });
    const last = requestCalls().filter(({ url }) => url.pathname === "/access-requests").at(-1)!;
    expect(last.url.searchParams.get("status")).toBe("approved");
    expect(last.url.searchParams.get("requested_role")).toBe("manager");
    expect(new Date(last.url.searchParams.get("since")!).getDate()).toBe(1);
    expect(new Date(last.url.searchParams.get("until")!).getDate()).toBe(21);
  });

  it("shows the empty state when there are no requests at all", async () => {
    backend(manager, { ...reviewerApi([]), "GET /access-requests/mine": () => page([]) });

    renderRequests();

    expect(await screen.findByText("No access requests yet")).toBeTruthy();
    expect(screen.getByText("No requests waiting")).toBeTruthy();
  });

  it("approves a request with a note and reports the role change", async () => {
    let requests = [accessRequest()];
    const { calls } = backend(
      admin,
      reviewerApi([], {
        "GET /access-requests/summary": () =>
          json({ pending_total: requests.filter((r) => r.status === "pending").length, recent: requests.filter((r) => r.status === "pending") }),
        "GET /access-requests": () => page(requests),
        "POST /access-requests/7/approve": () => {
          requests = [
            accessRequest({
              status: "approved",
              can_decide: false,
              decision_block_reason: "not_pending",
              requester: { ...accessRequest().requester, current_role: "viewer" },
              decision: {
                decided_at: "2026-10-20T10:00:00+00:00",
                note: "Approved for Q4.",
                reviewer: { id: 1, username: "adminuser", role: "admin" },
              },
            }),
          ];
          return json({ request: requests[0] });
        },
      })
    );

    renderRequests();

    const box = await screen.findByRole("region", { name: "New requests" });
    fireEvent.click(await within(box).findByRole("button", { name: "Review request from jane.doe" }));

    const dialog = await screen.findByRole("dialog", { name: "Review request from jane.doe" });
    expect(
      within(dialog).getByText(/changes jane\.doe's role from Member to Viewer \/ Auditor immediately/)
    ).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Decision note (optional)"), {
      target: { value: "Approved for Q4." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve and change role" }));

    expect(
      await screen.findByText("Request from jane.doe approved. Their role is now Viewer / Auditor.")
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls.find(({ method }) => method === "POST")?.body).toEqual({ note: "Approved for Q4." });
    expect(await within(box).findByText("No requests waiting")).toBeTruthy();
    expect(within(await row("jane.doe")).getByText("Approved")).toBeTruthy();
  });

  it("declines without a note", async () => {
    const { calls } = backend(
      admin,
      reviewerApi([accessRequest()], {
        "POST /access-requests/7/decline": () =>
          json({
            request: accessRequest({
              status: "declined",
              can_decide: false,
              decision_block_reason: "not_pending",
            }),
          }),
      })
    );

    renderRequests();

    fireEvent.click(await within(await row("jane.doe")).findByRole("button", { name: /Review/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Decline" }));

    expect(
      await screen.findByText("Request from jane.doe declined. Their role is unchanged.")
    ).toBeTruthy();
    expect(calls.find(({ method }) => method === "POST")?.body).toEqual({ note: null });
  });

  it("explains why a manager can't decide a Manager request", async () => {
    const managerRequest = accessRequest({
      requested_role: "manager",
      can_decide: false,
      decision_block_reason: "manager_requires_admin",
    });
    const { calls } = backend(manager, {
      ...reviewerApi([managerRequest]),
      "GET /access-requests/mine": () => page([]),
    });

    renderRequests();

    fireEvent.click(await within(await row("jane.doe")).findByRole("button", { name: "Request #7" }));
    const dialog = await screen.findByRole("dialog", { name: "Request #7" });
    expect(
      within(dialog).getByText("Only administrators can decide requests for Manager access.")
    ).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Decline" })).toBeNull();
    expect(calls.some(({ method }) => method === "POST")).toBe(false);

    // Managers can still request access themselves, but not Manager again.
    const roleSelect = screen.getByLabelText("Role you need") as HTMLSelectElement;
    expect(Array.from(roleSelect.options).map((option) => option.value)).toEqual(["", "member", "viewer"]);
  });

  it("refreshes the list when a request was already decided elsewhere", async () => {
    let decided = false;
    const { requestCalls } = backend(
      admin,
      reviewerApi([], {
        "GET /access-requests/summary": () => json({ pending_total: decided ? 0 : 1, recent: decided ? [] : [accessRequest()] }),
        "GET /access-requests": () => page([accessRequest()]),
        "POST /access-requests/7/approve": () => {
          decided = true;
          return json({ detail: "This access request has already been declined" }, 409);
        },
      })
    );

    renderRequests();

    fireEvent.click(await within(await row("jane.doe")).findByRole("button", { name: /Review/ }));
    const dialog = await screen.findByRole("dialog");
    const before = requestCalls().length;
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve and change role" }));

    expect(
      (await within(dialog).findByRole("alert")).textContent
    ).toBe("This request has already been decided. The list has been refreshed.");
    await waitFor(() => expect(requestCalls().length).toBeGreaterThan(before + 1));
  });

  it("shows the API's refusal when the queue is forbidden", async () => {
    backend(admin, {
      "GET /access-requests/summary": () => json({ pending_total: 0, recent: [] }),
      "GET /access-requests": () =>
        json({ detail: "Missing permission: access_requests:review" }, 403),
    });

    renderRequests();

    expect(
      await screen.findByText("The AccessHub API refused access: Missing permission: access_requests:review")
    ).toBeTruthy();
  });
});

describe("Access requests — access and language", () => {
  it("doesn't load the queue for Viewer / Auditor accounts", async () => {
    const { requestCalls } = backend(viewer, { "GET /access-requests/mine": () => page([]) });

    renderRequests();

    expect(await screen.findByText("Access requests aren't available for your role")).toBeTruthy();
    // Only their own (empty) history is checked; nothing else is requested or shown.
    await waitFor(() => expect(requestCalls()).toHaveLength(1));
    expect(requestCalls()[0].url.pathname).toBe("/access-requests/mine");
    expect(screen.queryByRole("region", { name: "My requests" })).toBeNull();
    expect(screen.queryByLabelText("Role you need")).toBeNull();
    const main = screen.getByRole("navigation", { name: "Main" });
    // Shown with a lock and an accurate reason, not "admins only".
    expect(within(main).getByRole("link", { name: /Access Request/ }).textContent).toBe(
      "Access Request (not available for your role)"
    );
  });

  it("keeps a former member's history after their Viewer request was approved", async () => {
    backend(viewer, {
      "GET /access-requests/mine": () =>
        page([
          accessRequest({
            status: "approved",
            can_decide: false,
            decision_block_reason: "not_pending",
            requester: { ...accessRequest().requester, current_role: "viewer" },
            decision: {
              decided_at: "2026-10-20T10:00:00+00:00",
              note: null,
              reviewer: { id: 2, username: "maria.manager", role: "manager" },
            },
          }),
        ]),
    });

    renderRequests();

    const history = await screen.findByRole("region", { name: "My requests" });
    expect(within(history).getByText("Approved")).toBeTruthy();
    expect(screen.getByText("Access requests aren't available for your role")).toBeTruthy();
  });

  it("shows the role a decided request changed from, not the current role", async () => {
    backend(admin, reviewerApi([
      accessRequest({
        status: "approved",
        can_decide: false,
        decision_block_reason: "not_pending",
        requester: { ...accessRequest().requester, current_role: "viewer" },
        decision: {
          decided_at: "2026-10-20T10:00:00+00:00",
          note: null,
          reviewer: { id: 1, username: "adminuser", role: "admin" },
        },
      }),
    ]));

    renderRequests();

    const approved = await row("jane.doe");
    expect(within(approved).getByText("Member")).toBeTruthy();
    expect(within(approved).getByText("Viewer / Auditor")).toBeTruthy();
  });

  it("translates the page", async () => {
    localStorage.setItem("accesshub.language", "fr");
    backend(admin, reviewerApi([accessRequest()]));

    renderRequests();

    expect(await screen.findByRole("heading", { level: 1, name: "Demandes d’accès" })).toBeTruthy();
    expect(await screen.findByRole("region", { name: "Nouvelles demandes" })).toBeTruthy();
    expect(within(await row("jane.doe")).getByText("En attente")).toBeTruthy();
  });
});
