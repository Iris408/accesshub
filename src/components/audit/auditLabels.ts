import type { AuditOutcome } from "../../api/client";
import type { MessageKey } from "../../i18n/messages/en";

// Mirrors app/audit.py in the API. Unknown values (from a newer API) are
// shown as their raw code rather than hidden.

export const AUDIT_EVENT_TYPES: ReadonlyArray<{ type: string; label: MessageKey }> = [
  { type: "auth.sign_in", label: "audit.type.signIn" },
  { type: "auth.password_changed", label: "audit.type.passwordChanged" },
  { type: "auth.demo_session", label: "audit.type.demoSession" },
  { type: "user.created", label: "audit.type.userCreated" },
  { type: "user.updated", label: "audit.type.userUpdated" },
  { type: "user.role_changed", label: "audit.type.roleChanged" },
  { type: "user.deactivated", label: "audit.type.userDeactivated" },
  { type: "user.reactivated", label: "audit.type.userReactivated" },
  { type: "user.deleted", label: "audit.type.userDeleted" },
  { type: "access.denied", label: "audit.type.accessDenied" },
  { type: "access_request.submitted", label: "audit.type.accessRequestSubmitted" },
  { type: "access_request.approved", label: "audit.type.accessRequestApproved" },
  { type: "access_request.declined", label: "audit.type.accessRequestDeclined" },
  { type: "role.permissions_changed", label: "audit.type.rolePermissionsChanged" },
  { type: "settings.changed", label: "audit.type.settingsChanged" },
];

export const EVENT_LABELS: Readonly<Record<string, MessageKey>> = Object.fromEntries(
  AUDIT_EVENT_TYPES.map(({ type, label }) => [type, label])
);

export const OUTCOMES: readonly AuditOutcome[] = ["success", "failure", "denied"];

export const OUTCOME_LABELS: Readonly<Record<AuditOutcome, MessageKey>> = {
  success: "audit.outcome.success",
  failure: "audit.outcome.failure",
  denied: "audit.outcome.denied",
};

export const DETAIL_LABELS: Readonly<Record<string, MessageKey>> = {
  reason: "audit.field.reason",
  method: "audit.field.method",
  role: "audit.field.role",
  from_role: "audit.field.fromRole",
  to_role: "audit.field.toRole",
  from_username: "audit.field.fromUsername",
  to_username: "audit.field.toUsername",
  password_generated: "audit.field.passwordGenerated",
  permission: "audit.field.permission",
  action: "audit.field.action",
  request_id: "audit.field.requestId",
  requested_role: "audit.field.requestedRole",
  from_permissions: "audit.field.fromPermissions",
  to_permissions: "audit.field.toPermissions",
  setting: "audit.field.setting",
  from_value: "audit.field.fromValue",
  to_value: "audit.field.toValue",
};

/** Names of organisation settings (`setting` in settings.changed events). */
export const SETTING_LABELS: Readonly<Record<string, MessageKey>> = {
  organisation_name: "settings.name.label",
  timezone: "settings.timezone.label",
  access_requests_enabled: "settings.requests.enabledLabel",
  requestable_roles: "settings.requests.rolesLegend",
  session_minutes: "settings.session.label",
};

export const REASON_LABELS: Readonly<Record<string, MessageKey>> = {
  invalid_credentials: "audit.reason.invalidCredentials",
  account_deactivated: "audit.reason.accountDeactivated",
  incorrect_current_password: "audit.reason.incorrectCurrentPassword",
  password_unchanged: "audit.reason.passwordUnchanged",
  own_role: "audit.reason.ownRole",
  own_account: "audit.reason.ownAccount",
  last_active_admin: "audit.reason.lastActiveAdmin",
  still_active: "audit.reason.stillActive",
  real_accounts_present: "audit.reason.realAccountsPresent",
  missing_permission: "audit.reason.missingPermission",
  admin_only: "audit.reason.adminOnly",
  access_request: "audit.reason.accessRequest",
  own_request: "audit.reason.ownRequest",
  manager_requires_admin: "audit.reason.managerRequiresAdmin",
};

export const METHOD_LABELS: Readonly<Record<string, MessageKey>> = {
  password: "audit.method.password",
  oauth2_form: "audit.method.oauth2Form",
  demo_session: "audit.method.demoSession",
};

/** Detail keys whose values are role names. */
export const ROLE_DETAIL_KEYS = new Set(["role", "from_role", "to_role", "requested_role"]);

/** Detail keys whose values are comma-separated permission codes. */
export const PERMISSION_LIST_DETAIL_KEYS = new Set(["from_permissions", "to_permissions"]);

/** Detail keys whose values are technical codes, shown in monospace. */
export const CODE_DETAIL_KEYS = new Set(["permission", "action"]);
