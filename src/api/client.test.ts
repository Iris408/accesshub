import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  changePassword,
  createUser,
  deactivateUser,
  deleteUser,
  fetchProfile,
  fetchUsers,
  reactivateUser,
  startDemoSession,
  updateUser,
} from "./client";
import { setToken } from "../auth/session";
import {
  authorizationHeader,
  callsTo,
  json,
  mockApi,
  networkError,
} from "../test/mockApi";

const user = { id: 5, username: "testuser", role: "Admin" };

async function expectApiError(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe("fetchProfile", () => {
  it("sends the bearer token to GET /profile and returns the nested user", async () => {
    const fetchMock = mockApi({
      "GET /profile": () => json({ message: "ok", user }),
    });

    await expect(fetchProfile("abc.def")).resolves.toEqual(user);

    const [[, init]] = callsTo(fetchMock, "/profile");
    expect(init?.method).toBe("GET");
    expect(authorizationHeader(init)).toBe("Bearer abc.def");
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [500, "server"],
    [503, "server"],
  ] as const)("maps HTTP %i to a %s error", async (status, kind) => {
    mockApi({
      "GET /profile": () => json({ detail: "Nope" }, status),
    });

    const error = await expectApiError(fetchProfile("t"));
    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
    expect(error.message).toBe("Nope");
  });

  it("reports network failures separately from HTTP errors", async () => {
    mockApi({ "GET /profile": networkError });

    const error = await expectApiError(fetchProfile("t"));
    expect(error.kind).toBe("network");
    expect(error.status).toBeNull();
  });

  it("tolerates non-JSON error bodies", async () => {
    mockApi({
      "GET /profile": () => new Response("Bad Gateway", { status: 502 }),
    });

    const error = await expectApiError(fetchProfile("t"));
    expect(error.kind).toBe("server");
    expect(error.message).toBe("Request failed with status 502");
  });
});

describe("fetchUsers", () => {
  it("sends the bearer token to GET /users and unwraps { users }", async () => {
    const fetchMock = mockApi({
      "GET /users": () => json({ users: [user] }),
    });

    await expect(fetchUsers("abc.def")).resolves.toEqual([user]);
    const [[, init]] = callsTo(fetchMock, "/users");
    expect(authorizationHeader(init)).toBe("Bearer abc.def");
  });

  it("accepts a bare array response", async () => {
    mockApi({ "GET /users": () => json([user]) });
    await expect(fetchUsers("t")).resolves.toEqual([user]);
  });

  it.each([
    [400, "invalid"],
    [404, "notFound"],
    [409, "conflict"],
    [422, "invalid"],
  ] as const)("maps HTTP %i to a %s error", async (status, kind) => {
    mockApi({ "GET /users": () => json({ detail: "Nope" }, status) });

    const error = await expectApiError(fetchUsers("t"));
    expect(error.kind).toBe(kind);
  });

  it("reads FastAPI validation errors", async () => {
    mockApi({
      "GET /users": () =>
        json({ detail: [{ msg: "Value error, Role must be one of: admin" }] }, 422),
    });

    const error = await expectApiError(fetchUsers("t"));
    expect(error.message).toBe("Role must be one of: admin");
  });

  it("surfaces 403 as a forbidden error", async () => {
    mockApi({
      "GET /users": () => json({ detail: "Admin access required" }, 403),
    });

    const error = await expectApiError(fetchUsers("t"));
    expect(error.kind).toBe("forbidden");
    expect(error.message).toBe("Admin access required");
  });
});

describe("user management requests", () => {
  it("creates users with the bearer token and returns the one-time password", async () => {
    const fetchMock = mockApi({
      "POST /users": () =>
        json({ message: "User created", user: { id: 9, username: "jane", role: "member" }, temporary_password: "secret-once" }),
    });

    const result = await createUser("abc.def", { username: "jane", role: "member" });

    expect(result).toEqual({
      user: { id: 9, username: "jane", role: "member" },
      temporaryPassword: "secret-once",
    });
    const [[, init]] = callsTo(fetchMock, "/users");
    expect(init?.method).toBe("POST");
    expect(authorizationHeader(init)).toBe("Bearer abc.def");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ username: "jane", role: "member" });
  });

  it("uses the documented methods and paths for each lifecycle action", async () => {
    const user = { id: 3, username: "sam", role: "viewer" };
    const fetchMock = mockApi({
      "PUT /users/3": () => json({ message: "User updated", user }),
      "POST /users/3/deactivate": () => json({ message: "User deactivated", user }),
      "POST /users/3/reactivate": () => json({ message: "User reactivated", user }),
      "DELETE /users/3": () => json({ message: "User deleted", deleted_user: user }),
      "POST /profile/password": () => json({ message: "Password updated" }),
    });

    await expect(updateUser("t", 3, { username: "sam", role: "viewer" })).resolves.toEqual(user);
    await expect(deactivateUser("t", 3)).resolves.toEqual(user);
    await expect(reactivateUser("t", 3)).resolves.toEqual(user);
    await expect(deleteUser("t", 3)).resolves.toBeUndefined();
    await changePassword("t", { current_password: "a".repeat(12), new_password: "b".repeat(12) });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    for (const [, init] of fetchMock.mock.calls) {
      expect(authorizationHeader(init)).toBe("Bearer t");
    }
  });
});

describe("demo session isolation", () => {
  it("sends demo tokens only to the demo API", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    vi.stubEnv("VITE_DEMO_API_URL", "https://demo-api.example.test");
    const fetchMock = mockApi({ "GET /profile": () => json({ user }) });

    setToken("demo.jwt", "demo");
    await fetchProfile("demo.jwt");
    setToken("real.jwt");
    await fetchProfile("real.jwt");

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://demo-api.example.test/profile",
      "https://api.example.test/profile",
    ]);
  });

  it("refuses a demo session when no demo API is configured", async () => {
    const fetchMock = mockApi({});
    setToken("demo.jwt", "demo");

    const error = await expectApiError(fetchProfile("demo.jwt"));

    expect(error.kind).toBe("unauthorized");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("can't start a demo session without a configured demo API", async () => {
    const fetchMock = mockApi({});

    const error = await expectApiError(startDemoSession());

    expect(error.kind).toBe("notFound");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
