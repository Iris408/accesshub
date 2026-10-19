import { useId, useRef, useState } from "react";

import { useI18n } from "../../i18n/context";
import Dialog from "../ui/Dialog";
import Icon from "../ui/Icon";

type TemporaryPasswordDialogProps = {
  username: string;
  /** Held only in memory; it disappears when the dialog closes. */
  password: string;
  onDone: () => void;
};

function TemporaryPasswordDialog({ username, password, onDone }: TemporaryPasswordDialogProps) {
  const { t } = useI18n();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
      inputRef.current?.select();
    }
  }

  return (
    <Dialog
      title={t("tempPassword.title", { name: username })}
      icon="key"
      onClose={onDone}
      initialFocusRef={inputRef}
      footer={
        <button type="button" className="ah-btn ah-btn--primary" onClick={onDone}>
          {t("common.done")}
        </button>
      }
    >
      <p>{t("tempPassword.body")}</p>

      <div className="ah-form-field">
        <label htmlFor={inputId} className="ah-field__label">
          {t("tempPassword.label")}
        </label>
        <div className="ah-secret">
          <input
            ref={inputRef}
            id={inputId}
            className="ah-input ah-input--plain ah-secret__value"
            readOnly
            value={password}
            autoComplete="off"
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" className="ah-btn ah-btn--secondary" onClick={copy}>
            <Icon name="copy" size={16} />
            {t("tempPassword.copy")}
          </button>
        </div>
        <p className="ah-field__hint" role="status">
          {copyStatus === "copied" && t("tempPassword.copied")}
          {copyStatus === "failed" && t("tempPassword.copyFailed")}
        </p>
      </div>
    </Dialog>
  );
}

export default TemporaryPasswordDialog;
