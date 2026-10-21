import { useId, useState } from "react";

import {
  ApiError,
  fetchRolePermissions,
  updateRolePermissions,
  type PermissionLockReason,
  type RolePermissionMatrix,
} from "../api/client";
import { useAuth } from "../auth/context";
import { isAdminRole } from "../auth/roles";
import { isDemoSession } from "../auth/session";
import PermissionMatrix from "../components/roles/PermissionMatrix";
import { EDITABLE_ROLES, LOCK_LABELS, LOCK_REASONS } from "../components/roles/permissionLabels";
import Icon from "../components/ui/Icon";
import PageHeader from "../components/ui/PageHeader";
import StateMessage from "../components/ui/StateMessage";
import { useApiResource } from "../hooks/useApiResource";
import { useI18n } from "../i18n/context";

const cellKey = (permission: string, role: string) => `${role}|${permission}`;

type SaveError = { message: string; stale: boolean };

function usedLockReasons(matrix: RolePermissionMatrix): PermissionLockReason[] {
  const used = new Set<PermissionLockReason>();
  for (const row of matrix.permissions) {
    for (const cell of Object.values(row.roles)) {
      if (!cell.editable) used.add(cell.lock_reason ?? "fixed");
    }
  }
  return LOCK_REASONS.filter((reason) => used.has(reason));
}

function RolesEditor() {
  const { token, signOut, refreshProfile } = useAuth();
  const { t, tp, formatFullDateTime } = useI18n();
  const ids = useId();

  const [version, setVersion] = useState(0);
  const { state, reload } = useApiResource(`roles:${version}`, (authToken, signal) =>
    fetchRolePermissions(authToken, signal)
  );

  // Unsaved changes, tied to the matrix version they were made against: once
  // a newer matrix loads (after saving or reloading) they no longer apply.
  const [draft, setDraft] = useState<{ base: string; changes: Record<string, boolean> }>({
    base: "",
    changes: {},
  });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [notice, setNotice] = useState("");

  const matrix = state.status === "ready" ? state.data : null;
  const changes = matrix && draft.base === matrix.version ? draft.changes : {};
  const changeCount = Object.keys(changes).length;

  function storedValue(permission: string, role: string): boolean {
    const row = matrix?.permissions.find((item) => item.permission === permission);
    return Boolean(row?.roles[role]?.granted);
  }

  function valueOf(permission: string, role: string): boolean {
    const key = cellKey(permission, role);
    return key in changes ? changes[key] : storedValue(permission, role);
  }

  function toggle(permission: string, role: string, granted: boolean) {
    if (!matrix) return;
    const key = cellKey(permission, role);
    const next = { ...changes };
    if (granted === storedValue(permission, role)) delete next[key];
    else next[key] = granted;
    setDraft({ base: matrix.version, changes: next });
    setNotice("");
    setSaveError(null);
  }

  function cancel() {
    setDraft({ base: "", changes: {} });
    setSaveError(null);
  }

  function reloadLatest() {
    setDraft({ base: "", changes: {} });
    setSaveError(null);
    setVersion((current) => current + 1);
  }

  async function save() {
    if (!matrix || busy || changeCount === 0) return;

    setBusy(true);
    setSaveError(null);
    setNotice("");

    // The API expects the complete matrix for every editable role.
    const grants = Object.fromEntries(
      EDITABLE_ROLES.map((role) => [
        role,
        matrix.permissions
          .filter((row) => valueOf(row.permission, role))
          .map((row) => row.permission),
      ])
    );

    try {
      await updateRolePermissions(token, matrix.version, grants);
      setBusy(false);
      setNotice(t("roles.saved"));
      // Show what the API now enforces, and update this session's own access.
      setVersion((current) => current + 1);
      refreshProfile();
    } catch (caught) {
      setBusy(false);
      if (caught instanceof ApiError && caught.kind === "unauthorized") {
        signOut();
        return;
      }
      if (caught instanceof ApiError && caught.kind === "conflict") {
        setSaveError({ message: t("roles.stale"), stale: true });
        return;
      }
      if (caught instanceof ApiError && caught.kind === "forbidden") refreshProfile();
      setSaveError({
        message:
          caught instanceof ApiError && caught.kind === "invalid"
            ? t("roles.saveRejected", { detail: caught.message })
            : caught instanceof ApiError && caught.kind === "forbidden"
              ? t("roles.saveDenied")
              : caught instanceof ApiError && caught.kind === "network"
                ? t("roles.saveNetwork")
                : t("roles.saveServer"),
        stale: false,
      });
    }
  }

  const reasons = matrix ? usedLockReasons(matrix) : [];
  const ruleNumber = (reason: PermissionLockReason) => reasons.indexOf(reason) + 1;

  return (
    <>
      {isDemoSession() && (
        <p className="ah-notice ah-notice--info ah-demo-shared" role="note">
          <Icon name="alert" size={18} className="ah-notice__icon" />
          <span className="ah-notice__text">{t("roles.demoShared")}</span>
        </p>
      )}
      <div className="ah-notice-region" role="status">
        {notice && (
          <div className="ah-notice ah-requests__notice">
            <Icon name="check" size={18} className="ah-notice__icon" />
            <span className="ah-notice__text">{notice}</span>
            <button
              type="button"
              className="ah-icon-btn ah-notice__close"
              onClick={() => setNotice("")}
              aria-label={t("common.dismiss")}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>

      <section className="ah-panel" aria-labelledby={`${ids}-title`} aria-busy={busy || undefined}>
        <div className="ah-panel__header">
          <div>
            <h2 id={`${ids}-title`} className="ah-panel__title">
              {t("roles.matrixTitle")}
            </h2>
            <p className="ah-panel__description">{t("roles.matrixDescription")}</p>
          </div>
        </div>

        {state.status === "loading" && (
          <div className="ah-loading" aria-busy="true">
            <p className="ah-sr-only" role="status">
              {t("roles.loading")}
            </p>
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="ah-skeleton-row">
                <span className="ah-skeleton ah-skeleton--text" />
                <span className="ah-skeleton ah-skeleton--short" />
              </div>
            ))}
          </div>
        )}

        {state.status === "forbidden" && (
          <StateMessage icon="lock" tone="warning" title={t("roles.deniedTitle")} role="alert">
            {t("roles.apiDeniedBody", { detail: state.detail })}
          </StateMessage>
        )}

        {state.status === "error" && (
          <StateMessage
            icon="alert"
            tone="danger"
            title={t("roles.errorTitle")}
            role="alert"
            action={
              <button type="button" className="ah-btn ah-btn--primary" onClick={reload}>
                <Icon name="refresh" size={16} />
                {t("common.tryAgain")}
              </button>
            }
          >
            {state.reason === "network" ? t("roles.errorNetwork") : t("roles.errorServer")}
          </StateMessage>
        )}

        {matrix && (
          <div className={`ah-roles__results${state.status === "ready" && state.refreshing ? " is-refreshing" : ""}`}>
            <PermissionMatrix
              matrix={matrix}
              valueOf={valueOf}
              isChanged={(permission, role) => cellKey(permission, role) in changes}
              onToggle={toggle}
              disabled={busy}
              ruleNumber={ruleNumber}
              idPrefix={ids}
            />

            {saveError && (
              <div className="ah-form-error ah-roles__error" role="alert">
                <span>{saveError.message}</span>
                {saveError.stale && (
                  <button type="button" className="ah-btn ah-btn--secondary ah-btn--small" onClick={reloadLatest}>
                    <Icon name="refresh" size={14} />
                    {t("roles.reload")}
                  </button>
                )}
              </div>
            )}

            <div className="ah-roles__actions">
              <p className="ah-roles__status" aria-live="polite">
                {changeCount > 0
                  ? tp("roles.changes", changeCount, { count: changeCount })
                  : matrix.updated_at
                    ? t("roles.lastUpdated", {
                        time: formatFullDateTime(new Date(matrix.updated_at)),
                        name: matrix.updated_by?.username ?? "—",
                      })
                    : t("roles.neverUpdated")}
              </p>
              <div className="ah-stack-form__actions">
                <button
                  type="button"
                  className="ah-btn ah-btn--secondary"
                  onClick={cancel}
                  disabled={busy || changeCount === 0}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="ah-btn ah-btn--primary"
                  onClick={save}
                  disabled={busy || changeCount === 0}
                >
                  {busy ? t("roles.saving") : t("roles.save")}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {matrix && (
        <section className="ah-panel" aria-labelledby={`${ids}-rules`}>
          <div className="ah-panel__header">
            <div>
              <h2 id={`${ids}-rules`} className="ah-panel__title">
                {t("roles.protectedTitle")}
              </h2>
              <p className="ah-panel__description">{t("roles.protectedDescription")}</p>
            </div>
          </div>
          <ol className="ah-roles__rules">
            {reasons.map((reason) => (
              <li key={reason}>
                <span className="ah-perm-matrix__lock" aria-hidden="true">
                  <Icon name="lock" size={12} />
                  {ruleNumber(reason)}
                </span>
                <span>{t(LOCK_LABELS[reason])}</span>
              </li>
            ))}
            <li>
              <span className="ah-perm-matrix__lock" aria-hidden="true">
                <Icon name="shieldCheck" size={12} />
              </span>
              <span>{t("roles.managerRule")}</span>
            </li>
          </ol>
        </section>
      )}
    </>
  );
}

/** Role permissions. Only Admins can view or change them; the API enforces it. */
function RolesPage() {
  const { user, can } = useAuth();
  const { t } = useI18n();
  const allowed = isAdminRole(user?.role) && can("roles:manage");

  return (
    <>
      <PageHeader eyebrow={t("dashboard.eyebrow")} title={t("roles.title")} description={t("roles.description")} />
      {allowed ? (
        <div className="ah-requests-page">
          <RolesEditor />
        </div>
      ) : (
        <section className="ah-panel">
          <StateMessage icon="lock" tone="warning" title={t("roles.deniedTitle")}>
            {t("roles.deniedBody")}
          </StateMessage>
        </section>
      )}
    </>
  );
}

export default RolesPage;
