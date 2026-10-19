import {
  useId,
  useLayoutEffect,
  useRef,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";

import Icon, { type IconName } from "./Icon";

type DialogProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  /** While true, Escape is ignored so an in-flight request can't be abandoned. */
  busy?: boolean;
  tone?: "default" | "danger";
  icon?: IconName;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Element to focus on open; defaults to the browser's choice. */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * Modal dialog built on the native <dialog> element: showModal() provides the
 * focus trap, inert background, Escape handling and focus restoration. Mount
 * it to open and unmount it to close.
 */
function Dialog({
  title,
  onClose,
  children,
  footer,
  busy = false,
  tone = "default",
  icon,
  onSubmit,
  initialFocusRef,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Layout effect: its cleanup runs before React removes the element, so the
  // dialog is closed while still in the document and focus can go back to
  // whatever opened it (passive-effect cleanup would run too late).
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!dialog.open) dialog.showModal();
    initialFocusRef?.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [initialFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      className={`ah-dialog ah-dialog--${tone}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        className="ah-dialog__form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}
      >
        <header className="ah-dialog__header">
          {icon && (
            <span className="ah-dialog__icon">
              <Icon name={icon} size={20} />
            </span>
          )}
          <h2 id={titleId} className="ah-dialog__title">
            {title}
          </h2>
        </header>

        <div className="ah-dialog__content">{children}</div>

        <div className="ah-dialog__footer">{footer}</div>
      </form>
    </dialog>
  );
}

export default Dialog;
