import { describe, expect, it } from "vitest";

import { makeUsers } from "../../test/mockApi";
import {
  ALL_ROLES,
  activeAdminCount,
  queryUsers,
  roleOptions,
  summarizeUsers,
  type UserQuery,
} from "./userQuery";

const baseQuery: UserQuery = {
  search: "",
  role: ALL_ROLES,
  status: "all",
  sort: { key: "id", direction: "asc" },
  page: 1,
  pageSize: 10,
};

describe("queryUsers", () => {
  const users = makeUsers(124);

  it("paginates and reports the visible range", () => {
    const result = queryUsers(users, { ...baseQuery, page: 13 });

    expect(result.pageCount).toBe(13);
    expect(result.rows.map((user) => user.id)).toEqual([121, 122, 123, 124]);
    expect([result.start, result.end, result.matchCount]).toEqual([121, 124, 124]);
  });

  it("clamps an out-of-range page after the result set shrinks", () => {
    const result = queryUsers(users, { ...baseQuery, page: 9, role: "admin" });

    expect(result.page).toBe(2);
    expect(result.rows.map((user) => user.id)).toEqual([110, 120]);
  });

  it("matches usernames case-insensitively and IDs exactly, with or without #", () => {
    expect(queryUsers(users, { ...baseQuery, search: "USER01" }).matchCount).toBe(10);
    expect(
      queryUsers(users, { ...baseQuery, search: "#42" }).rows.map((user) => user.id)
    ).toEqual([42]);
  });

  it("filters by status", () => {
    const withInactive = users.map((user) =>
      user.id % 31 === 0 ? { ...user, is_active: false } : user
    );

    expect(queryUsers(withInactive, { ...baseQuery, status: "inactive" }).matchCount).toBe(4);
    expect(queryUsers(withInactive, { ...baseQuery, status: "active" }).matchCount).toBe(120);
  });

  it("maps legacy and mixed-case roles onto the four roles", () => {
    const mixed = [
      { id: 1, username: "a", role: "admin" },
      { id: 2, username: "b", role: "Admin" },
      { id: 3, username: "c", role: "user" },
      { id: 4, username: "d" },
      { id: 5, username: "e", role: "viewer" },
    ];

    expect(queryUsers(mixed, { ...baseQuery, role: "admin" }).matchCount).toBe(2);
    expect(queryUsers(mixed, { ...baseQuery, role: "member" }).matchCount).toBe(2);
    expect(roleOptions(mixed)).toEqual([
      { role: "admin", count: 2 },
      { role: "member", count: 2 },
      { role: "viewer", count: 1 },
    ]);
    // No is_active field (older API): active count is unknown, not invented.
    expect(summarizeUsers(mixed)).toEqual({ total: 5, active: null, admins: 2, roles: 3 });
  });

  it("sorts by role in permission order", () => {
    const result = queryUsers(
      [
        { id: 1, username: "v", role: "viewer" },
        { id: 2, username: "m", role: "member" },
        { id: 3, username: "a", role: "admin" },
        { id: 4, username: "g", role: "manager" },
      ],
      { ...baseQuery, sort: { key: "role", direction: "asc" } }
    );

    expect(result.rows.map((user) => user.role)).toEqual(["admin", "manager", "member", "viewer"]);
  });

  it("sorts descending", () => {
    const result = queryUsers(users, {
      ...baseQuery,
      sort: { key: "username", direction: "desc" },
    });

    expect(result.rows[0].username).toBe("user124");
  });

  it("returns an empty page for no matches", () => {
    const result = queryUsers(users, { ...baseQuery, search: "zzz" });

    expect(result).toMatchObject({ rows: [], matchCount: 0, pageCount: 1, start: 0, end: 0 });
  });
});

describe("activeAdminCount", () => {
  it("counts only active admins who can sign in, like the API safeguard", () => {
    expect(
      activeAdminCount([
        { id: 1, username: "a", role: "admin", is_active: true },
        { id: 2, username: "b", role: "admin", is_active: false },
        { id: 3, username: "demo.c", role: "admin", is_active: true, is_seed: true },
        { id: 4, username: "d", role: "manager", is_active: true },
      ])
    ).toBe(1);
  });
});
