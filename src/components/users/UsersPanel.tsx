import { useEffect, useRef, useState } from "react";

import {
  ApiError,
  createUser,
  deactivateUser,
  deleteUser,
  reactivateUser,
  updateUser,
  type User,
  type UserInput,
} from "../../api/client";
import { useAuth } from "../../auth/context";
import type { UsersResource } from "../../hooks/useUsers";
import { useI18n } from "../../i18n/context";
import Icon from "../ui/Icon";
import StateMessage from "../ui/StateMessage";
import ConfirmUserDialog, { type ConfirmAction } from "./ConfirmUserDialog";
import { describeMutationError, type MutationResult } from "./mutations";
import TemporaryPasswordDialog from "./TemporaryPasswordDialog";
import UserFormDialog from "./UserFormDialog";
import UsersTable, { type UserAction } from "./UsersTable";

function LoadingRows({ label }: { label: string }) {
  return (
    <div className="ah-loading" aria-busy="true">
      <p className="ah-sr-only" role="status">
        {label}
      </p>
      <div className="ah-skeleton ah-skeleton--toolbar" />
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="ah-skeleton-row">
          <span className="ah-skeleton ah-skeleton--avatar" />
          <span className="ah-skeleton ah-skeleton--text" />
          <span className="ah-skeleton ah-skeleton--short" />
        </div>
      ))}
    </div>
  );
}

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; user: User }
  | { kind: ConfirmAction; user: User }
  | { kind: "password"; username: string; password: string };

type Notice = {
  message: string;
  /** Move focus to the notice (when the row that had focus is gone). */
  focus: boolean;
};

type UsersPanelProps = {
  users: UsersResource;
  initialSearch?: string;
  defaultPageSize?: number;
};

function UsersPanel({ users, initialSearch, defaultPageSize }: UsersPanelProps) {
  const { state, reload, refresh } = users;
  const { token, user: currentUser, can, signOut, refreshProfile } = useAuth();
  const { t, tx, roleName, formatNumber, formatTime } = useI18n();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const canManage = can("users:manage");

  useEffect(() => {
    if (notice?.focus) noticeRef.current?.focus();
  }, [notice]);

  /** Runs a change, then refreshes the list in the background. */
  async function perform<T>(
    request: () => Promise<T>,
    onSuccess: (result: T) => void
  ): MutationResult {
    try {
      const result = await request();
      onSuccess(result);
      void refresh();
      return null;
    } catch (error) {
      if (error instanceof ApiError && error.kind === "unauthorized") {
        // Expired or revoked session: end it and return to sign-in.
        signOut();
        return null;
      }

      if (error instanceof ApiError && error.kind === "notFound") void refresh();

      return describeMutationError(error, t);
    }
  }

  function succeed(message: string, focus = false) {
    setNotice({ message, focus });
    setDialog(null);
  }

  function create(input: UserInput) {
    return perform(
      () => createUser(token, input),
      ({ user, temporaryPassword }) => {
        setNotice({ message: t("notice.created", { name: user.username }), focus: false });
        setDialog(
          temporaryPassword
            ? { kind: "password", username: user.username, password: temporaryPassword }
            : null
        );
      }
    );
  }

  function edit(target: User, input: UserInput) {
    return perform(
      () => updateUser(token, target.id, input),
      (updated) => {
        succeed(t("notice.updated", { name: updated.username }));
        if (updated.id === currentUser?.id) refreshProfile();
      }
    );
  }

  function confirmAction(action: ConfirmAction, target: User) {
    const name = target.username;

    switch (action) {
      case "deactivate":
        return perform(
          () => deactivateUser(token, target.id),
          () => succeed(t("notice.deactivated", { name }))
        );
      case "reactivate":
        return perform(
          () => reactivateUser(token, target.id),
          () => succeed(t("notice.reactivated", { name }))
        );
      case "delete":
        return perform(
          () => deleteUser(token, target.id),
          () => succeed(t("notice.deleted", { name }), true)
        );
    }
  }

  function openAction(action: UserAction, target: User) {
    setNotice(null);
    setDialog(action === "edit" ? { kind: "edit", user: target } : { kind: action, user: target });
  }

  return (
    <section className="ah-panel" aria-labelledby="users-panel-title">
      <div className="ah-panel__header">
        <div>
          <h2 id="users-panel-title" className="ah-panel__title">
            {t("users.title")}
            {state.status === "ready" && (
              <span className="ah-panel__count">
                ({formatNumber(state.users.length)})
              </span>
            )}
          </h2>
          <p className="ah-panel__description">{t("users.description")}</p>
        </div>

        {(state.status === "ready" || state.status === "loading") && (
          <div className="ah-panel__actions">
            {state.status === "ready" && (
              <span className="ah-meta">
                {tx("common.updated", {
                  time: (
                    <time dateTime={state.loadedAt.toISOString()}>
                      {formatTime(state.loadedAt)}
                    </time>
                  ),
                })}
              </span>
            )}
            <button
              type="button"
              className="ah-btn ah-btn--secondary"
              onClick={reload}
              disabled={state.status === "loading"}
            >
              <Icon name="refresh" size={16} />
              {t("common.refresh")}
            </button>
            {canManage && state.status === "ready" && (
              <button
                type="button"
                className="ah-btn ah-btn--primary"
                onClick={(event) => {
                  // Safari/Firefox don't focus buttons on click; the dialog
                  // returns focus to whatever had it when it opened.
                  event.currentTarget.focus();
                  setNotice(null);
                  setDialog({ kind: "create" });
                }}
              >
                <Icon name="plus" size={16} />
                {t("users.add")}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="ah-notice-region" role="status">
        {notice && (
          <div ref={noticeRef} className="ah-notice" tabIndex={-1}>
            <Icon name="check" size={18} className="ah-notice__icon" />
            <span className="ah-notice__text">{notice.message}</span>
            <button
              type="button"
              className="ah-icon-btn ah-notice__close"
              onClick={() => setNotice(null)}
              aria-label={t("common.dismiss")}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>

      {state.status === "idle" && (
        <StateMessage icon="lock" tone="warning" title={t("users.adminRequiredTitle")}>
          {tx("users.adminRequiredBody", {
            role: <strong>{roleName(currentUser?.role)}</strong>,
          })}
        </StateMessage>
      )}

      {state.status === "loading" && <LoadingRows label={t("users.loading")} />}

      {state.status === "forbidden" && (
        <StateMessage
          icon="lock"
          tone="warning"
          title={t("users.deniedTitle")}
          role="alert"
        >
          {t("users.deniedBody", { detail: state.detail })}
        </StateMessage>
      )}

      {state.status === "error" && (
        <StateMessage
          icon="alert"
          tone="danger"
          title={t("users.errorTitle")}
          role="alert"
          action={
            <button type="button" className="ah-btn ah-btn--primary" onClick={reload}>
              <Icon name="refresh" size={16} />
              {t("common.tryAgain")}
            </button>
          }
        >
          {state.reason === "network"
            ? t("users.errorNetwork")
            : t("users.errorServer")}
        </StateMessage>
      )}

      {state.status === "ready" && (
        <UsersTable
          users={state.users}
          currentUserId={currentUser?.id}
          initialSearch={initialSearch}
          defaultPageSize={defaultPageSize}
          onAction={canManage ? openAction : undefined}
        />
      )}

      {dialog?.kind === "create" && (
        <UserFormDialog onCancel={() => setDialog(null)} onSubmit={create} />
      )}

      {dialog?.kind === "edit" && (
        <UserFormDialog
          user={dialog.user}
          isSelf={dialog.user.id === currentUser?.id}
          onCancel={() => setDialog(null)}
          onSubmit={(input) => edit(dialog.user, input)}
        />
      )}

      {(dialog?.kind === "deactivate" ||
        dialog?.kind === "reactivate" ||
        dialog?.kind === "delete") && (
        <ConfirmUserDialog
          action={dialog.kind}
          user={dialog.user}
          onCancel={() => setDialog(null)}
          onConfirm={() => confirmAction(dialog.kind, dialog.user)}
        />
      )}

      {dialog?.kind === "password" && (
        <TemporaryPasswordDialog
          username={dialog.username}
          password={dialog.password}
          onDone={() => setDialog(null)}
        />
      )}
    </section>
  );
}

export default UsersPanel;
