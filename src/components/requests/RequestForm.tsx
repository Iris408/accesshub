import { useId, useRef, useState, type FormEvent } from "react";

import { ApiError, submitAccessRequest, type AccessRequest, type RequestableRole } from "../../api/client";
import { useAuth } from "../../auth/context";
import { normalizeRole } from "../../auth/roles";
import { useI18n } from "../../i18n/context";
import Icon from "../ui/Icon";
import { useOrganisation } from "../../organisation/context";
import {
  REQUESTABLE_ROLES,
  describeRequestError,
  isPolicyError,
  isStaleRequestError,
} from "./requestLabels";

const REASON_MIN_LENGTH = 3;
const REASON_MAX_LENGTH = 500;

type RequestFormProps = {
  /** The user's pending request, if any (the API allows one at a time). */
  pending?: AccessRequest;
  onSubmitted: (request?: AccessRequest) => void;
};

/** Ask for a different role. The API enforces every rule shown here. */
function RequestForm({ pending, onSubmitted }: RequestFormProps) {
  const { token, user, signOut } = useAuth();
  const { t, roleName } = useI18n();
  const { organisation, refreshOrganisation } = useOrganisation();
  const policy = organisation.access_requests;
  const ids = useId();
  const roleRef = useRef<HTMLSelectElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const currentRole = normalizeRole(user?.role);
  // Roles the organisation allows (Settings), other than the current one.
  const options = REQUESTABLE_ROLES.filter(
    (option) => option !== currentRole && policy.requestable_roles.includes(option)
  );

  const [chosenRole, setRole] = useState<RequestableRole | "">("");
  // A choice the policy no longer allows (after a refresh) is dropped.
  const role = chosenRole && options.includes(chosenRole) ? chosenRole : "";
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ role?: string; reason?: string }>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const found: { role?: string; reason?: string } = {};
    if (!role) found.role = t("requests.roleRequired");
    if (reason.trim().length < REASON_MIN_LENGTH) found.reason = t("requests.reasonRequired");
    else if (reason.trim().length > REASON_MAX_LENGTH) found.reason = t("requests.reasonTooLong");

    setErrors(found);
    setFormError("");

    if (found.role) return roleRef.current?.focus();
    if (found.reason) return reasonRef.current?.focus();

    setBusy(true);

    try {
      const created = await submitAccessRequest(token, {
        requested_role: role as RequestableRole,
        reason: reason.trim(),
      });
      setBusy(false);
      setRole("");
      setReason("");
      onSubmitted(created);
    } catch (caught) {
      if (caught instanceof ApiError && caught.kind === "unauthorized") {
        signOut();
        return;
      }
      setBusy(false);
      setFormError(describeRequestError(caught, t));
      if (isStaleRequestError(caught)) onSubmitted();
      // The request policy changed since this page loaded: pick it up.
      if (isPolicyError(caught)) refreshOrganisation();
    }
  }

  return (
    <section className="ah-panel" aria-labelledby={`${ids}-title`}>
      <div className="ah-panel__header">
        <div>
          <h2 id={`${ids}-title`} className="ah-panel__title">
            {t("requests.formTitle")}
          </h2>
          <p className="ah-panel__description">{t("requests.formDescription")}</p>
        </div>
      </div>

      {pending ? (
        <p className="ah-notice ah-notice--info" role="note">
          <Icon name="clock" size={18} className="ah-notice__icon" />
          <span className="ah-notice__text">
            {t("requests.pendingNotice", { role: roleName(pending.requested_role) })}
          </span>
        </p>
      ) : !policy.enabled || options.length === 0 ? (
        <p className="ah-notice ah-notice--info" role="note">
          <Icon name="lock" size={18} className="ah-notice__icon" />
          <span className="ah-notice__text">
            {policy.enabled ? t("requests.noRolesAvailable") : t("requests.turnedOff")}
          </span>
        </p>
      ) : (
        <form className="ah-stack-form" noValidate onSubmit={submit}>
          {formError && (
            <p className="ah-form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="ah-form-field">
            <label htmlFor={`${ids}-role`} className="ah-field__label">
              {t("requests.roleLabel")}
            </label>
            <div className="ah-select">
              <select
                ref={roleRef}
                id={`${ids}-role`}
                value={role}
                required
                aria-invalid={Boolean(errors.role)}
                aria-describedby={errors.role ? `${ids}-role-error` : `${ids}-role-hint`}
                onChange={(event) => {
                  setRole(event.target.value as RequestableRole | "");
                  setErrors((current) => ({ ...current, role: undefined }));
                }}
              >
                <option value="">{t("requests.rolePlaceholder")}</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {roleName(option)}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={16} className="ah-select__icon" />
            </div>
            {errors.role ? (
              <span id={`${ids}-role-error`} className="ah-field__error">
                {errors.role}
              </span>
            ) : (
              <span id={`${ids}-role-hint`} className="ah-field__hint">
                {role === "manager"
                  ? t("requests.managerNote")
                  : t("requests.currentRoleHint", { role: roleName(currentRole) })}
              </span>
            )}
          </div>

          <div className="ah-form-field">
            <label htmlFor={`${ids}-reason`} className="ah-field__label">
              {t("requests.reasonLabel")}
            </label>
            <textarea
              ref={reasonRef}
              id={`${ids}-reason`}
              className="ah-input ah-input--plain ah-textarea"
              rows={4}
              required
              value={reason}
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={`${ids}-reason-hint${errors.reason ? ` ${ids}-reason-error` : ""}`}
              onChange={(event) => {
                setReason(event.target.value);
                setErrors((current) => ({ ...current, reason: undefined }));
              }}
            />
            <span id={`${ids}-reason-hint`} className="ah-field__hint">
              {t("requests.reasonHint", { count: REASON_MAX_LENGTH - reason.trim().length })}
            </span>
            {errors.reason && (
              <span id={`${ids}-reason-error`} className="ah-field__error">
                {errors.reason}
              </span>
            )}
          </div>

          <div className="ah-stack-form__actions">
            <button type="submit" className="ah-btn ah-btn--primary" disabled={busy}>
              {busy ? t("requests.submitting") : t("requests.submit")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default RequestForm;
