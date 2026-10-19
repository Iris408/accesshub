import { isDemoSession } from "../auth/session";
import { demoApiUrl, primaryApiUrl } from "./config";

/**
 * User record as returned by GET /profile (`user`) and GET /users. The status
 * flags are optional so older API deployments (id/username/role only) still
 * work.
 */
export type User = {
  id: number;
  username: string;
  role?: string;
  is_active?: boolean;
  is_seed?: boolean;
  must_change_password?: boolean;
};

/** GET /profile also returns the caller's permissions. */
export type Profile = User & {
  permissions?: string[];
};

export type ApiErrorKind =
  | "network"
  | "unauthorized" // 401
  | "forbidden" // 403
  | "notFound" // 404
  | "conflict" // 409 — a safeguard refused the change
  | "invalid" // 400 / 422 — validation or business rule
  | "server";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(kind: ApiErrorKind, status: number | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorKindForStatus(status: number): ApiErrorKind {
  switch (status) {
    case 400:
    case 422:
      return "invalid";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "notFound";
    case 409:
      return "conflict";
    default:
      return "server";
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** FastAPI sends `detail` as a string, or as a list for validation errors. */
function detailMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object" || !("detail" in body)) return fallback;

  const { detail } = body as { detail: unknown };

  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? String((item as { msg: unknown }).msg).replace(/^Value error, /, "")
          : ""
      )
      .filter(Boolean);

    if (messages.length) return messages.join(" ");
  }

  return fallback;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

async function authorizedRequest(
  path: string,
  token: string,
  { method = "GET", body, signal }: RequestOptions = {}
): Promise<unknown> {
  // A demo token only ever goes back to the demo API that issued it.
  const base = isDemoSession() ? demoApiUrl() : primaryApiUrl();

  if (base === null) {
    throw new ApiError("unauthorized", 401, "Demo environment is not configured");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;

  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError("network", null, "Unable to connect to backend API");
  }

  const responseBody = await readJson(response);

  if (!response.ok) {
    throw new ApiError(
      errorKindForStatus(response.status),
      response.status,
      detailMessage(responseBody, `Request failed with status ${response.status}`)
    );
  }

  return responseBody;
}

function userFrom(body: unknown, key = "user"): User {
  const user = (body as Record<string, unknown> | null)?.[key];

  if (!user || typeof user !== "object") {
    throw new ApiError("server", 200, "Response did not include a user");
  }

  return user as User;
}

/**
 * POST /login with `{ username, password }` → `{ access_token, token_type }`.
 * Returns the access token; never log it.
 */
export async function login(username: string, password: string): Promise<string> {
  let response: Response;

  try {
    response = await fetch(`${primaryApiUrl()}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new ApiError("network", null, "Unable to connect to backend API");
  }

  const body = await readJson(response);

  if (!response.ok) {
    throw new ApiError(
      errorKindForStatus(response.status),
      response.status,
      detailMessage(body, "Login failed")
    );
  }

  const token = (body as { access_token?: unknown } | null)?.access_token;

  if (typeof token !== "string" || !token) {
    throw new ApiError("server", response.status, "No access token returned from backend");
  }

  return token;
}

/**
 * POST /demo/session on the isolated demo API → access token. Only available
 * when VITE_DEMO_API_URL is configured; no credentials are involved.
 */
export async function startDemoSession(): Promise<string> {
  const base = demoApiUrl();

  if (base === null) {
    throw new ApiError("notFound", null, "Demo environment is not configured");
  }

  let response: Response;

  try {
    response = await fetch(`${base}/demo/session`, { method: "POST" });
  } catch {
    throw new ApiError("network", null, "Unable to connect to backend API");
  }

  const body = await readJson(response);

  if (!response.ok) {
    throw new ApiError(
      errorKindForStatus(response.status),
      response.status,
      detailMessage(body, "Demo session failed")
    );
  }

  const token = (body as { access_token?: unknown } | null)?.access_token;

  if (typeof token !== "string" || !token) {
    throw new ApiError("server", response.status, "No access token returned from backend");
  }

  return token;
}

/** GET /profile → `{ user: Profile }` */
export async function fetchProfile(
  token: string,
  signal?: AbortSignal
): Promise<Profile> {
  const body = await authorizedRequest("/profile", token, { signal });
  return userFrom(body) as Profile;
}

/** GET /users → `User[]` or `{ users: User[] }` (admin only). */
export async function fetchUsers(
  token: string,
  signal?: AbortSignal
): Promise<User[]> {
  const body = await authorizedRequest("/users", token, { signal });

  if (Array.isArray(body)) return body as User[];

  const users = (body as { users?: unknown } | null)?.users;
  return Array.isArray(users) ? (users as User[]) : [];
}

export type UserInput = {
  username: string;
  role: string;
};

export type CreatedUser = {
  user: User;
  /** Server-generated, returned once. Never log or persist it. */
  temporaryPassword?: string;
};

/** POST /users (admin). The server generates a one-time temporary password. */
export async function createUser(token: string, input: UserInput): Promise<CreatedUser> {
  const body = await authorizedRequest("/users", token, { method: "POST", body: input });
  const temporaryPassword = (body as { temporary_password?: unknown }).temporary_password;

  return {
    user: userFrom(body),
    temporaryPassword: typeof temporaryPassword === "string" ? temporaryPassword : undefined,
  };
}

/** PUT /users/{id} (admin) */
export async function updateUser(token: string, id: number, input: UserInput): Promise<User> {
  return userFrom(
    await authorizedRequest(`/users/${id}`, token, { method: "PUT", body: input })
  );
}

/** POST /users/{id}/deactivate (admin) */
export async function deactivateUser(token: string, id: number): Promise<User> {
  return userFrom(
    await authorizedRequest(`/users/${id}/deactivate`, token, { method: "POST" })
  );
}

/** POST /users/{id}/reactivate (admin) */
export async function reactivateUser(token: string, id: number): Promise<User> {
  return userFrom(
    await authorizedRequest(`/users/${id}/reactivate`, token, { method: "POST" })
  );
}

/** DELETE /users/{id} (admin; the user must already be deactivated) */
export async function deleteUser(token: string, id: number): Promise<void> {
  await authorizedRequest(`/users/${id}`, token, { method: "DELETE" });
}

/** POST /profile/password */
export async function changePassword(
  token: string,
  input: { current_password: string; new_password: string }
): Promise<void> {
  await authorizedRequest("/profile/password", token, { method: "POST", body: input });
}
