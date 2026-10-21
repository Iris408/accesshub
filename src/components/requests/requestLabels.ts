import { ApiError } from "../../api/client";
import type {
  AccessRequest,
  AccessRequestBlockReason,
  AccessRequestStatus,
  RequestableRole,
} from "../../api/client";
import type { Translator } from "../../i18n/translate";
import type { MessageKey } from "../../i18n/messages/en";
import { describeMutationError } from "../users/mutations";

/** Roles a request may ask for (mirrors the API; never Admin). */
export const REQUESTABLE_ROLES: readonly RequestableRole[] = ["manager", "member", "viewer"];

export const REQUEST_STATUSES: readonly AccessRequestStatus[] = ["pending", "approved", "declined"];

export const STATUS_LABELS: Readonly<Record<AccessRequestStatus, MessageKey>> = {
  pending: "requests.status.pending",
  approved: "requests.status.approved",
  declined: "requests.status.declined",
};

export const BLOCK_REASON_LABELS: Readonly<Partial<Record<AccessRequestBlockReason, MessageKey>>> = {
  own_request: "requests.block.ownRequest",
  manager_requires_admin: "requests.block.managerRequiresAdmin",
  missing_permission: "requests.block.missingPermission",
};

// Known API messages, translated. Anything else falls back to the shared
// mutation messages (which include the API's detail where useful).
const KNOWN_ERRORS: Readonly<Record<string, MessageKey>> = {
  "You already have a pending access request": "requests.error.duplicatePending",
  "You already have this role": "requests.error.sameRole",
  "This access request has already been approved": "requests.error.alreadyDecided",
  "This access request has already been declined": "requests.error.alreadyDecided",
  "You can't review your own access request": "requests.block.ownRequest",
  "Only administrators can decide requests for Manager access": "requests.block.managerRequiresAdmin",
  "The requester's account is deactivated": "requests.error.requesterInactive",
  "The requester's account no longer exists": "requests.error.requesterMissing",
  "The requester is now an administrator": "requests.error.requesterAdmin",
  "Access requests are turned off": "requests.turnedOff",
  "This role can't be requested": "requests.error.roleNotRequestable",
};

/**
 * The role a request changes from: the requester's current role while it's
 * pending, and the role they had when submitting once it's decided (an
 * approval has already changed their current role).
 */
export function roleBeforeRequest(request: AccessRequest): string {
  return request.status === "pending"
    ? (request.requester.current_role ?? request.requester.role_at_submission)
    : request.requester.role_at_submission;
}

export function describeRequestError(error: unknown, t: Translator["t"]): string {
  if (error instanceof ApiError && KNOWN_ERRORS[error.message]) {
    return t(KNOWN_ERRORS[error.message]);
  }
  return describeMutationError(error, t).message;
}

/** Whether the organisation's request policy refused it (Settings changed). */
export function isPolicyError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.message === "Access requests are turned off" ||
      error.message === "This role can't be requested")
  );
}

/** Whether the error means the list is out of date (refresh it). */
export function isStaleRequestError(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === "conflict" || error.kind === "notFound");
}
