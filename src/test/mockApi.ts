import { vi } from "vitest";

import type { User } from "../api/client";

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

/**
 * Stubs global fetch with handlers keyed by "METHOD /path". Unhandled
 * requests fail loudly so tests catch unexpected API calls.
 */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const key = `${(init?.method ?? "GET").toUpperCase()} ${url.pathname}`;
      const handler = routes[key];

      if (!handler) throw new Error(`Unhandled request: ${key}`);
      return handler(init);
    }
  );

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function networkError(): Promise<Response> {
  return Promise.reject(new TypeError("Failed to fetch"));
}

export function callsTo(fetchMock: ReturnType<typeof mockApi>, path: string) {
  return fetchMock.mock.calls.filter(
    ([input]) => new URL(String(input)).pathname === path
  );
}

export function authorizationHeader(init: RequestInit | undefined) {
  return new Headers(init?.headers).get("Authorization");
}

/**
 * Test fixture shaped like GET /users: `count` active users where every
 * `adminEvery`-th user is an admin and the rest are members.
 */
export function makeUsers(count: number, adminEvery = 10): User[] {
  return Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    return {
      id,
      username: `user${String(id).padStart(3, "0")}`,
      role: id % adminEvery === 0 ? "admin" : "member",
      is_active: true,
      is_seed: false,
      must_change_password: false,
    };
  });
}
