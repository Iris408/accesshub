import { useId, useRef, useState } from "react";

import type { User } from "../../api/client";
import { useI18n } from "../../i18n/context";
import Dialog from "../ui/Dialog";
import type { MutationResult } from "./mutations";

export type ConfirmAction = "deactivate" | "reactivate" | "delete";

type ConfirmUserDialogProps = {
  action: ConfirmAction;
  user: User;
  onCancel: () => void;
  onConfirm: () => MutationResult;
};

/**
 * Confirms a lifecycle change. Permanent deletion additionally requires
 * typing the username, so it can't be confirmed by reflex.
 */
function ConfirmUserDialog({ action, user, onCancel, onConfirm }: ConfirmUserDialogProps) {
  const { t } = useI18n();
  const inputId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const typedRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const name = user.username;
  const isDelete = action === "delete";
  const confirmed = !isDelete || typed === name;

  const copy = {
    deactivate: {
      title: t("confirm.deactivateTitle", { name }),
      body: t("confirm.deactivateBody"),
      button: t("users.deactivate"),
    },
    reactivate: {
      title: t("confirm.reactivateTitle", { name }),
      body: t("confirm.reactivateBody"),
      button: t("users.reactivate"),
    },
    delete: {
      title: t("confirm.deleteTitle", { name }),
      body: t("confirm.deleteBody"),
      button: t("users.delete"),
    },
  }[action];

  async function confirm() {
    if (busy || !confirmed) return;

    setBusy(true);
    setError("");

    const failure = await onConfirm();
    if (!failure) return;

    setBusy(false);
    setError(failure.message);
  }

  return (
    <Dialog
      title={copy.title}
      icon={isDelete ? "trash" : action === "deactivate" ? "userX" : "refresh"}
      tone={action === "reactivate" ? "default" : "danger"}
      busy={busy}
      onClose={onCancel}
      onSubmit={confirm}
      initialFocusRef={isDelete ? typedRef : cancelRef}
      footer={
        <>
          <button
            ref={cancelRef}
            type="button"
            className="ah-btn ah-btn--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className={`ah-btn ${action === "reactivate" ? "ah-btn--primary" : "ah-btn--danger"}`}
            disabled={busy || !confirmed}
          >
            {busy ? t("confirm.working") : copy.button}
          </button>
        </>
      }
    >
      {error && (
        <p className="ah-form-error" role="alert">
          {error}
        </p>
      )}

      <p>{copy.body}</p>

      {isDelete && (
        <div className="ah-form-field">
          <label htmlFor={inputId} className="ah-field__label">
            {t("confirm.deleteTypeLabel", { name })}
          </label>
          <input
            ref={typedRef}
            id={inputId}
            className="ah-input ah-input--plain"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
      )}
    </Dialog>
  );
}

export default ConfirmUserDialog;
