import { useId, useRef, useState, type FormEvent } from "react";

import type { User, UserInput } from "../../api/client";
import { ROLES, normalizeRole, type Role } from "../../auth/roles";
import { useI18n } from "../../i18n/context";
import Dialog from "../ui/Dialog";
import { USERNAME_PATTERN, type MutationResult } from "./mutations";

type UserFormDialogProps = {
  /** Omit to create a new user. */
  user?: User;
  /** Editing your own account: the role can't be changed. */
  isSelf?: boolean;
  onCancel: () => void;
  onSubmit: (input: UserInput) => MutationResult;
};

function UserFormDialog({ user, isSelf = false, onCancel, onSubmit }: UserFormDialogProps) {
  const { t, roleName } = useI18n();
  const editing = Boolean(user);
  const ids = useId();
  const usernameRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(user?.username ?? "");
  const [role, setRole] = useState<Role>(normalizeRole(user?.role));
  const [usernameError, setUsernameError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  function validateUsername(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return t("userForm.usernameRequired");
    if (!USERNAME_PATTERN.test(trimmed)) return t("userForm.usernameInvalid");
    return "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const error = validateUsername(username);
    setUsernameError(error);
    setFormError("");

    if (error) {
      usernameRef.current?.focus();
      return;
    }

    setBusy(true);
    const failure = await onSubmit({ username: username.trim(), role });

    // On success the dialog is unmounted by its parent.
    if (!failure) return;

    setBusy(false);

    if (failure.field === "username") {
      setUsernameError(failure.message);
      usernameRef.current?.focus();
    } else {
      setFormError(failure.message);
    }
  }

  const describedBy = [`${ids}-hint`, usernameError && `${ids}-error`]
    .filter(Boolean)
    .join(" ");

  return (
    <Dialog
      title={
        editing
          ? t("userForm.editTitle", { name: user?.username ?? "" })
          : t("userForm.createTitle")
      }
      icon={editing ? "edit" : "userPlus"}
      busy={busy}
      onClose={onCancel}
      onSubmit={submit}
      initialFocusRef={usernameRef}
      footer={
        <>
          <button
            type="button"
            className="ah-btn ah-btn--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {t("common.cancel")}
          </button>
          <button type="submit" className="ah-btn ah-btn--primary" disabled={busy}>
            {busy
              ? t("userForm.saving")
              : editing
                ? t("userForm.save")
                : t("userForm.create")}
          </button>
        </>
      }
    >
      {formError && (
        <p className="ah-form-error" role="alert">
          {formError}
        </p>
      )}

      <div className="ah-form-field">
        <label htmlFor={`${ids}-username`} className="ah-field__label">
          {t("userForm.username")}
        </label>
        <input
          ref={usernameRef}
          id={`${ids}-username`}
          className="ah-input ah-input--plain"
          autoComplete="off"
          spellCheck={false}
          maxLength={50}
          required
          aria-invalid={Boolean(usernameError)}
          aria-describedby={describedBy}
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            if (usernameError) setUsernameError("");
          }}
        />
        <span id={`${ids}-hint`} className="ah-field__hint">
          {t("userForm.usernameHint")}
        </span>
        {usernameError && (
          <span id={`${ids}-error`} className="ah-field__error">
            {usernameError}
          </span>
        )}
      </div>

      <fieldset
        className="ah-role-picker"
        disabled={busy || isSelf}
        aria-describedby={isSelf ? `${ids}-self` : undefined}
      >
        <legend className="ah-field__label">{t("userForm.role")}</legend>
        {isSelf && (
          <p id={`${ids}-self`} className="ah-field__hint">
            {t("userForm.selfRoleHint")}
          </p>
        )}

        {ROLES.map((option) => (
          <label key={option} className="ah-role-option">
            <input
              type="radio"
              name={`${ids}-role`}
              value={option}
              checked={role === option}
              onChange={() => setRole(option)}
            />
            <span className="ah-role-option__text">
              <span className="ah-role-option__name">{roleName(option)}</span>
              <span className="ah-role-option__description">
                {t(`role.${option}Description`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {!editing && <p className="ah-dialog__note">{t("userForm.passwordNote")}</p>}
    </Dialog>
  );
}

export default UserFormDialog;
