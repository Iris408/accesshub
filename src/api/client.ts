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

export type AuditOutcome = "success" | "failure" | "denied";

/** One row of GET /audit-events. `details` holds display-safe values only. */
export type AuditEvent = {
  id: number;
  occurred_at: string;
  event_type: string;
  outcome: AuditOutcome;
  actor: { id: number | null; username: string | null; role: string | null } | null;
  target: { type: string; id: number | null; username: string | null } | null;
  details: Record<string, string | number | boolean | null>;
};

export type AuditQuery = {
  eventType?: string;
  outcome?: AuditOutcome;
  /** Actor or target username contains. */
  search?: string;
  /** ISO 8601, inclusive. */
  since?: string;
  /** ISO 8601, exclusive. */
  until?: string;
  page: number;
  pageSize: number;
};

export type AuditPage = {
  events: AuditEvent[];
  total: number;
  page: number;
  page_size: number;
};

/** GET /audit-events (admin only, read-only, newest first). */
export async function fetchAuditEvents(
  token: string,
  query: AuditQuery,
  signal?: AbortSignal
): Promise<AuditPage> {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
  });

  if (query.eventType) params.set("event_type", query.eventType);
  if (query.outcome) params.set("outcome", query.outcome);
  if (query.search?.trim()) params.set("q", query.search.trim());
  if (query.since) params.set("since", query.since);
  if (query.until) params.set("until", query.until);

  const body = (await authorizedRequest(`/audit-events?${params}`, token, { signal })) as
    | Partial<AuditPage>
    | null;

  return {
    events: Array.isArray(body?.events) ? body.events : [],
    total: typeof body?.total === "number" ? body.total : 0,
    page: typeof body?.page === "number" ? body.page : query.page,
    page_size: typeof body?.page_size === "number" ? body.page_size : query.pageSize,
  };
}

export type AccessRequestStatus = "pending" | "approved" | "declined";

/** Roles that can be requested; Admin never can. */
export type RequestableRole = "manager" | "member" | "viewer";

export type AccessRequestBlockReason =
  | "missing_permission"
  | "own_request"
  | "manager_requires_admin"
  | "not_pending";

export type AccessRequest = {
  id: number;
  status: AccessRequestStatus;
  requested_role: RequestableRole;
  reason: string;
  submitted_at: string;
  is_seed: boolean;
  requester: {
    id: number;
    /** Username when the request was submitted. */
    username: string;
    role_at_submission: string;
    /** Live values; null when the account has since been deleted. */
    current_username: string | null;
    current_role: string | null;
  };
  decision: {
    decided_at: string;
    note: string | null;
    reviewer: { id: number | null; username: string | null; role: string | null };
  } | null;
  /** Computed by the API for the signed-in user; the API still enforces it. */
  can_decide: boolean;
  decision_block_reason: AccessRequestBlockReason | null;
};

export type AccessRequestPage = {
  requests: AccessRequest[];
  total: number;
  page: number;
  page_size: number;
};

export type AccessRequestQuery = {
  status?: AccessRequestStatus;
  requestedRole?: RequestableRole;
  search?: string;
  since?: string;
  until?: string;
  page: number;
  pageSize: number;
};

function requestPage(body: unknown, page: number, pageSize: number): AccessRequestPage {
  const data = body as Partial<AccessRequestPage> | null;
  return {
    requests: Array.isArray(data?.requests) ? data.requests : [],
    total: typeof data?.total === "number" ? data.total : 0,
    page: typeof data?.page === "number" ? data.page : page,
    page_size: typeof data?.page_size === "number" ? data.page_size : pageSize,
  };
}

function requestFrom(body: unknown): AccessRequest {
  const request = (body as { request?: AccessRequest } | null)?.request;
  if (!request) throw new ApiError("server", 200, "Response did not include a request");
  return request;
}

/** POST /access-requests (Member, Manager) */
export async function submitAccessRequest(
  token: string,
  input: { requested_role: RequestableRole; reason: string }
): Promise<AccessRequest> {
  return requestFrom(
    await authorizedRequest("/access-requests", token, { method: "POST", body: input })
  );
}

/** GET /access-requests/mine — the signed-in user's own requests. */
export async function fetchMyAccessRequests(
  token: string,
  page: number,
  pageSize: number,
  signal?: AbortSignal
): Promise<AccessRequestPage> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const body = await authorizedRequest(`/access-requests/mine?${params}`, token, { signal });
  return requestPage(body, page, pageSize);
}

/** GET /access-requests — reviewer queue and history (Manager, Admin). */
export async function fetchAccessRequests(
  token: string,
  query: AccessRequestQuery,
  signal?: AbortSignal
): Promise<AccessRequestPage> {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
  });

  if (query.status) params.set("status", query.status);
  if (query.requestedRole) params.set("requested_role", query.requestedRole);
  if (query.search?.trim()) params.set("q", query.search.trim());
  if (query.since) params.set("since", query.since);
  if (query.until) params.set("until", query.until);

  const body = await authorizedRequest(`/access-requests?${params}`, token, { signal });
  return requestPage(body, query.page, query.pageSize);
}

export type AccessRequestSummary = {
  pending_total: number;
  recent: AccessRequest[];
};

/** GET /access-requests/summary — pending count and newest pending items. */
export async function fetchAccessRequestSummary(
  token: string,
  signal?: AbortSignal
): Promise<AccessRequestSummary> {
  const body = (await authorizedRequest("/access-requests/summary", token, { signal })) as
    | Partial<AccessRequestSummary>
    | null;
  return {
    pending_total: typeof body?.pending_total === "number" ? body.pending_total : 0,
    recent: Array.isArray(body?.recent) ? body.recent : [],
  };
}

/** POST /access-requests/{id}/approve or /decline (Manager, Admin). */
export async function decideAccessRequest(
  token: string,
  id: number,
  decision: "approve" | "decline",
  note?: string
): Promise<AccessRequest> {
  return requestFrom(
    await authorizedRequest(`/access-requests/${id}/${decision}`, token, {
      method: "POST",
      body: { note: note?.trim() || null },
    })
  );
}

/** POST /profile/password */
export async function changePassword(
  token: string,
  input: { current_password: string; new_password: string }
): Promise<void> {
  await authorizedRequest("/profile/password", token, { method: "POST", body: input });
}

/** Why a cell of the role permission matrix can't be changed. */
export type PermissionLockReason =
  | "admin_full_access"
  | "admin_only"
  | "audit_admin_only"
  | "viewer_read_only"
  | "member_submit_required"
  | "fixed";

export type PermissionCell = {
  granted: boolean;
  editable: boolean;
  lock_reason: PermissionLockReason | null;
};

export type RolePermissionMatrix = {
  roles: string[];
  permissions: Array<{ permission: string; roles: Record<string, PermissionCell> }>;
  /** Sent back with an update; a stale version is refused with 409. */
  version: string;
  updated_at: string | null;
  updated_by: { id: number | null; username: string | null } | null;
};

function matrixFrom(body: unknown): RolePermissionMatrix {
  const data = body as Partial<RolePermissionMatrix> | null;
  if (!data || !Array.isArray(data.permissions) || !Array.isArray(data.roles) || !data.version) {
    throw new ApiError("server", 200, "Response did not include the permission matrix");
  }
  return {
    roles: data.roles,
    permissions: data.permissions,
    version: data.version,
    updated_at: data.updated_at ?? null,
    updated_by: data.updated_by ?? null,
  };
}

/** GET /role-permissions (Admin) */
export async function fetchRolePermissions(
  token: string,
  signal?: AbortSignal
): Promise<RolePermissionMatrix> {
  return matrixFrom(await authorizedRequest("/role-permissions", token, { signal }));
}

/**
 * PUT /role-permissions (Admin). `grants` lists every matrix permission for
 * each editable role (manager, member, viewer), fixed ones included.
 */
export async function updateRolePermissions(
  token: string,
  version: string,
  grants: Record<string, string[]>
): Promise<RolePermissionMatrix> {
  return matrixFrom(
    await authorizedRequest("/role-permissions", token, {
      method: "PUT",
      body: { version, grants },
    })
  );
}

/**
 * One item of GET /activity: a display-safe projection of a recorded event —
 * no account or request IDs, route templates or sign-in method (those stay in
 * the Admin-only audit log).
 */
export type ActivityEvent = {
  id: number;
  occurred_at: string;
  event_type: string;
  outcome: AuditOutcome;
  actor: { username: string; role: string | null } | null;
  target: { type: string; username: string } | null;
  details: Record<string, string | number | boolean | null>;
};

export type ActivityPage = {
  events: ActivityEvent[];
  total: number;
  page: number;
  page_size: number;
};

/** GET /activity (activity:read) — same filters as the audit log. */
export async function fetchActivity(
  token: string,
  query: AuditQuery,
  signal?: AbortSignal
): Promise<ActivityPage> {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
  });

  if (query.eventType) params.set("event_type", query.eventType);
  if (query.outcome) params.set("outcome", query.outcome);
  if (query.search?.trim()) params.set("q", query.search.trim());
  if (query.since) params.set("since", query.since);
  if (query.until) params.set("until", query.until);

  const body = (await authorizedRequest(`/activity?${params}`, token, { signal })) as
    | Partial<ActivityPage>
    | null;

  return {
    events: Array.isArray(body?.events) ? body.events : [],
    total: typeof body?.total === "number" ? body.total : 0,
    page: typeof body?.page === "number" ? body.page : query.page,
    page_size: typeof body?.page_size === "number" ? body.page_size : query.pageSize,
  };
}

/** GET /organisation — what every signed-in user's interface needs. */
export type OrganisationSummary = {
  organisation_name: string | null;
  /** IANA timezone; null = each viewer's own. */
  timezone: string | null;
  access_requests: { enabled: boolean; requestable_roles: RequestableRole[] };
};

export async function fetchOrganisation(
  token: string,
  signal?: AbortSignal
): Promise<OrganisationSummary> {
  const body = (await authorizedRequest("/organisation", token, { signal })) as
    | Partial<OrganisationSummary>
    | null;
  return {
    organisation_name: body?.organisation_name ?? null,
    timezone: body?.timezone ?? null,
    access_requests: {
      enabled: body?.access_requests?.enabled ?? true,
      requestable_roles: Array.isArray(body?.access_requests?.requestable_roles)
        ? body.access_requests.requestable_roles
        : ["manager", "member", "viewer"],
    },
  };
}

export type OrganisationSettingsValues = {
  organisation_name: string | null;
  timezone: string | null;
  access_requests_enabled: boolean;
  requestable_roles: RequestableRole[];
  session_minutes: number;
};

/** GET /settings (Admin) */
export type OrganisationSettings = OrganisationSettingsValues & {
  /** Sent back with an update; a stale revision is refused with 409. */
  revision: number;
  updated_at: string | null;
  updated_by: { id: number | null; username: string | null } | null;
  limits: {
    organisation_name_max: number;
    session_minutes_min: number;
    session_minutes_max: number;
    requestable_roles: RequestableRole[];
  };
};

function settingsFrom(body: unknown): OrganisationSettings {
  const data = body as Partial<OrganisationSettings> | null;
  if (!data || typeof data.revision !== "number" || !data.limits) {
    throw new ApiError("server", 200, "Response did not include the settings");
  }
  return data as OrganisationSettings;
}

export async function fetchSettings(token: string, signal?: AbortSignal): Promise<OrganisationSettings> {
  return settingsFrom(await authorizedRequest("/settings", token, { signal }));
}

/** PUT /settings (Admin) — every setting, plus the revision it was based on. */
export async function updateSettings(
  token: string,
  revision: number,
  values: OrganisationSettingsValues
): Promise<OrganisationSettings> {
  return settingsFrom(
    await authorizedRequest("/settings", token, { method: "PUT", body: { revision, ...values } })
  );
}
