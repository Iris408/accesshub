import type { PermissionLockReason } from "../../api/client";
import type { MessageKey } from "../../i18n/messages/en";

// Mirrors MATRIX_PERMISSIONS and lock reasons in app/permissions.py. A code
// from a newer API without a label here is shown as the raw code.

export const PERMISSION_LABELS: Readonly<Record<string, { label: MessageKey; hint: MessageKey }>> = {
  "users:read": { label: "roles.perm.usersRead", hint: "roles.perm.usersReadHint" },
  "users:manage": { label: "roles.perm.usersManage", hint: "roles.perm.usersManageHint" },
  "access_requests:submit": { label: "roles.perm.requestsSubmit", hint: "roles.perm.requestsSubmitHint" },
  "access_requests:review": { label: "roles.perm.requestsReview", hint: "roles.perm.requestsReviewHint" },
  "activity:read": { label: "roles.perm.activityRead", hint: "roles.perm.activityReadHint" },
  "audit:read": { label: "roles.perm.auditRead", hint: "roles.perm.auditReadHint" },
  "roles:manage": { label: "roles.perm.rolesManage", hint: "roles.perm.rolesManageHint" },
  "settings:manage": { label: "roles.perm.settingsManage", hint: "roles.perm.settingsManageHint" },
};

/** Lock reasons in the order the protected rules are listed. */
export const LOCK_REASONS: readonly PermissionLockReason[] = [
  "admin_full_access",
  "admin_only",
  "audit_admin_only",
  "viewer_read_only",
  "member_submit_required",
  "fixed",
];

export const LOCK_LABELS: Readonly<Record<PermissionLockReason, MessageKey>> = {
  admin_full_access: "roles.lock.adminFullAccess",
  admin_only: "roles.lock.adminOnly",
  audit_admin_only: "roles.lock.auditAdminOnly",
  viewer_read_only: "roles.lock.viewerReadOnly",
  member_submit_required: "roles.lock.memberSubmitRequired",
  fixed: "roles.lock.fixed",
};

/** Roles whose permissions an update must list (the Admin column is fixed). */
export const EDITABLE_ROLES = ["manager", "member", "viewer"] as const;
