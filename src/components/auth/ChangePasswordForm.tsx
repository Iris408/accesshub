import { useId, useRef, useState, type FormEvent, type RefObject } from "react";

import { ApiError, changePassword } from "../../api/client";
import { useAuth } from "../../auth/context";
import { useI18n } from "../../i18n/context";
import PageHeader from "../ui/PageHeader";
import { describeMutationError } from "../users/mutations";

const MIN_LENGTH = 12;
// bcrypt, used by the API, reads at most 72 bytes.
const MAX_BYTES = 72;

type Field = "current" | "next" | "confirm";
type FieldErrors = Partial<Record<Field, string>>;

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  error?: string;
  hint?: string;
  autoComplete: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
};

function PasswordField({
  id,
  label,
  value,
  error,
  hint,
  autoComplete,
  inputRef,
  onChange,
}: PasswordFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");

  return (
    <div className="ah-form-field">
      <label htmlFor={id} className="ah-field__label">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="password"
        className="ah-input ah-input--plain"
        autoComplete={autoComplete}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && (
        <span id={`${id}-hint`} className="ah-field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="ah-field__error">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Shown instead of every page while the account has a temporary password.
 * The API enforces the same rule (403 "Password change required").
 */
function ChangePasswordForm() {
  const { token, refreshProfile, signOut } = useAuth();
  const { t } = useI18n();
  const ids = useId();
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<Record<Field, string>>({
    current: "",
    next: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  function validate(): FieldErrors {
    const found: FieldErrors = {};

    if (!values.current) found.current = t("password.required");

    if (values.next.length < MIN_LENGTH) found.next = t("password.tooShort");
    else if (new TextEncoder().encode(values.next).length > MAX_BYTES) {
      found.next = t("password.tooLong");
    } else if (values.next === values.current) found.next = t("password.sameAsCurrent");

    if (!found.next && values.confirm !== values.next) found.confirm = t("password.mismatch");

    return found;
  }

  function showErrors(found: FieldErrors) {
    setErrors(found);
    const first = (["current", "next", "confirm"] as const).find((field) => found[field]);
    const inputs = { current: currentRef, next: nextRef, confirm: confirmRef };
    if (first) inputs[first].current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setFormError("");
    const found = validate();

    if (Object.keys(found).length) {
      showErrors(found);
      return;
    }

    setErrors({});
    setBusy(true);

    try {
      await changePassword(token, {
        current_password: values.current,
        new_password: values.next,
      });
      // The profile now reports must_change_password: false and the page
      // the user asked for renders in place of this form.
      refreshProfile();
    } catch (error) {
      setBusy(false);

      if (error instanceof ApiError && error.kind === "unauthorized") {
        signOut();
        return;
      }

      if (error instanceof ApiError && error.message === "Current password is incorrect") {
        showErrors({ current: t("password.incorrect") });
        return;
      }

      if (error instanceof ApiError && error.message.startsWith("New password must be different")) {
        showErrors({ next: t("password.sameAsCurrent") });
        return;
      }

      setFormError(describeMutationError(error, t).message);
    }
  }

  function update(field: Field) {
    return (value: string) => {
      setValues((current) => ({ ...current, [field]: value }));
      if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  return (
    <>
      <PageHeader title={t("password.title")} description={t("password.intro")} />

      <section className="ah-panel ah-panel--narrow">
        <form className="ah-stack-form" noValidate onSubmit={submit}>
          {formError && (
            <p className="ah-form-error" role="alert">
              {formError}
            </p>
          )}

          <PasswordField
            id={`${ids}-current`}
            label={t("password.current")}
            autoComplete="current-password"
            inputRef={currentRef}
            value={values.current}
            error={errors.current}
            onChange={update("current")}
          />
          <PasswordField
            id={`${ids}-next`}
            label={t("password.new")}
            hint={t("password.hint")}
            autoComplete="new-password"
            inputRef={nextRef}
            value={values.next}
            error={errors.next}
            onChange={update("next")}
          />
          <PasswordField
            id={`${ids}-confirm`}
            label={t("password.confirm")}
            autoComplete="new-password"
            inputRef={confirmRef}
            value={values.confirm}
            error={errors.confirm}
            onChange={update("confirm")}
          />

          <div className="ah-stack-form__actions">
            <button type="button" className="ah-btn ah-btn--secondary" onClick={signOut}>
              {t("shell.signOut")}
            </button>
            <button type="submit" className="ah-btn ah-btn--primary" disabled={busy}>
              {busy ? t("password.updating") : t("password.submit")}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

export default ChangePasswordForm;
