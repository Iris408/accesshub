import { useId, useRef, useState, type ReactNode } from "react";

import { ApiError, decideAccessRequest, type AccessRequest } from "../../api/client";
import { useAuth } from "../../auth/context";
import { useI18n } from "../../i18n/context";
import Dialog from "../ui/Dialog";
import RoleBadge from "../ui/RoleBadge";
import {
  BLOCK_REASON_LABELS,
  describeRequestError,
  isStaleRequestError,
  roleBeforeRequest,
} from "./requestLabels";
import RequestStatusBadge from "./RequestStatusBadge";

const NOTE_MAX_LENGTH = 500;

type ReviewDialogProps = {
  request: AccessRequest;
  onClose: () => void;
  /** Called after a decision; `stale` means the list should be refreshed. */
  onDecided: (result: { request?: AccessRequest; stale?: boolean }) => void;
};

/**
 * Shows a request in full and, when the API says the signed-in user may
 * decide it, lets them approve or decline with an optional note.
 */
function ReviewDialog({ request, onClose, onDecided }: ReviewDialogProps) {
  const { token, signOut } = useAuth();
  const { t, roleName, formatFullDateTime } = useI18n();
  const ids = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requesterName = request.requester.username;
  const pending = request.status === "pending";
  const currentRole = roleBeforeRequest(request);
  const blockReason =
    pending && !request.can_decide && request.decision_block_reason
      ? BLOCK_REASON_LABELS[request.decision_block_reason]
      : undefined;
  const tooLong = note.length > NOTE_MAX_LENGTH;

  async function decide(decision: "approve" | "decline") {
    if (busy || tooLong) return;

    setBusy(true);
    setError("");

    try {
      const updated = await decideAccessRequest(token, request.id, decision, note);
      onDecided({ request: updated });
    } catch (caught) {
      if (caught instanceof ApiError && caught.kind === "unauthorized") {
        signOut();
        return;
      }
      setBusy(false);
      setError(describeRequestError(caught, t));
      if (isStaleRequestError(caught)) onDecided({ stale: true });
    }
  }

  const rows: Array<[string, ReactNode]> = [
    [
      t("requests.field.requester"),
      request.requester.current_username && request.requester.current_username !== requesterName
        ? `${requesterName} (${t("requests.renamedTo", { name: request.requester.current_username })})`
        : request.requester.current_username === null
          ? `${requesterName} (${t("requests.deletedAccount")})`
          : requesterName,
    ],
    [
      pending ? t("requests.field.currentRole") : t("requests.field.roleAtSubmission"),
      <RoleBadge role={currentRole} />,
    ],
    [t("requests.field.requestedRole"), <RoleBadge role={request.requested_role} />],
    [t("requests.field.status"), <RequestStatusBadge status={request.status} />],
    [
      t("requests.field.submitted"),
      <time dateTime={request.submitted_at}>{formatFullDateTime(new Date(request.submitted_at))}</time>,
    ],
    [t("requests.field.reason"), <p className="ah-request-reason">{request.reason}</p>],
  ];

  if (request.decision) {
    rows.push(
      [t("requests.field.reviewer"), request.decision.reviewer.username ?? "—"],
      [
        t("requests.field.decidedAt"),
        <time dateTime={request.decision.decided_at}>
          {formatFullDateTime(new Date(request.decision.decided_at))}
        </time>,
      ],
      [t("requests.field.note"), request.decision.note ?? "—"]
    );
  }

  const canDecide = pending && request.can_decide;

  return (
    <Dialog
      title={
        canDecide
          ? t("requests.reviewFor", { name: requesterName })
          : t("requests.viewRequest", { id: request.id })
      }
      icon="userPlus"
      busy={busy}
      onClose={onClose}
      initialFocusRef={cancelRef}
      footer={
        canDecide ? (
          <>
            <button
              ref={cancelRef}
              type="button"
              className="ah-btn ah-btn--secondary"
              onClick={onClose}
              disabled={busy}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="ah-btn ah-btn--danger"
              onClick={() => decide("decline")}
              disabled={busy || tooLong}
            >
              {busy ? t("requests.deciding") : t("requests.decline")}
            </button>
            <button
              type="button"
              className="ah-btn ah-btn--primary"
              onClick={() => decide("approve")}
              disabled={busy || tooLong}
            >
              {busy ? t("requests.deciding") : t("requests.approve")}
            </button>
          </>
        ) : (
          <button ref={cancelRef} type="button" className="ah-btn ah-btn--secondary" onClick={onClose}>
            {t("common.close")}
          </button>
        )
      }
    >
      {error && (
        <p className="ah-form-error" role="alert">
          {error}
        </p>
      )}

      {blockReason && <p className="ah-dialog__note">{t(blockReason)}</p>}

      <dl className="ah-detail-list">
        {rows.map(([label, value]) => (
          <div key={label} className="ah-detail-list__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {canDecide && (
        <>
          <p className="ah-dialog__note">
            {t("requests.approveEffect", {
              name: requesterName,
              from: roleName(currentRole),
              to: roleName(request.requested_role),
            })}
          </p>

          <div className="ah-form-field">
            <label htmlFor={`${ids}-note`} className="ah-field__label">
              {t("requests.noteLabel")}
            </label>
            <textarea
              id={`${ids}-note`}
              className="ah-input ah-input--plain ah-textarea"
              rows={3}
              value={note}
              disabled={busy}
              aria-invalid={tooLong}
              aria-describedby={`${ids}-note-hint`}
              onChange={(event) => setNote(event.target.value)}
            />
            <span id={`${ids}-note-hint`} className={tooLong ? "ah-field__error" : "ah-field__hint"}>
              {t("requests.noteHint", { count: NOTE_MAX_LENGTH - note.length })}
            </span>
          </div>
        </>
      )}
    </Dialog>
  );
}

export default ReviewDialog;
