import { useId, useMemo, useState, type FormEvent } from "react";

import {
  ApiError,
  fetchSettings,
  updateSettings,
  type OrganisationSettings,
  type OrganisationSettingsValues,
  type RequestableRole,
} from "../api/client";
import { useAuth } from "../auth/context";
import { isAdminRole } from "../auth/roles";
import { isDemoSession } from "../auth/session";
import Icon from "../components/ui/Icon";
import PageHeader from "../components/ui/PageHeader";
import StateMessage from "../components/ui/StateMessage";
import { useApiResource } from "../hooks/useApiResource";
import { useI18n } from "../i18n/context";
import { supportedTimeZone } from "../i18n/translate";
import { useOrganisation } from "../organisation/context";

const SESSION_PRESETS = [15, 30, 60, 120, 240, 480, 720];

type SaveError = { message: string; stale: boolean };

function valuesOf(settings: OrganisationSettings): OrganisationSettingsValues {
  return {
    organisation_name: settings.organisation_name,
    timezone: settings.timezone,
    access_requests_enabled: settings.access_requests_enabled,
    requestable_roles: settings.requestable_roles,
    session_minutes: settings.session_minutes,
  };
}

function sameValues(a: OrganisationSettingsValues, b: OrganisationSettingsValues): boolean {
  return (
    (a.organisation_name ?? "").trim() === (b.organisation_name ?? "").trim() &&
    (a.timezone ?? "") === (b.timezone ?? "") &&
    a.access_requests_enabled === b.access_requests_enabled &&
    [...a.requestable_roles].sort().join() === [...b.requestable_roles].sort().join() &&
    a.session_minutes === b.session_minutes
  );
}

/** Every timezone the browser knows, for the picker. */
function timeZoneOptions(current: string | null): string[] {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = ["UTC"];
  }
  if (!zones.includes("UTC")) zones = ["UTC", ...zones];
  if (current && !zones.includes(current)) zones = [current, ...zones];
  return zones;
}

/** "14:05" now, in `timeZone` — so an Admin can check their choice. */
function nowIn(locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date());
}

function SettingsForm({ settings, onSaved, onReload }: {
  settings: OrganisationSettings;
  onSaved: (notice: string) => void;
  onReload: () => void;
}) {
  const { token, signOut, refreshProfile } = useAuth();
  const { locale, t, tp, roleName, formatFullDateTime } = useI18n();
  const ids = useId();

  const saved = useMemo(() => valuesOf(settings), [settings]);
  // Unsaved edits belong to the revision they started from.
  const [draft, setDraft] = useState<{ revision: number; values: OrganisationSettingsValues } | null>(null);
  const values = draft && draft.revision === settings.revision ? draft.values : saved;
  const changed = !sameValues(values, saved);

  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [errors, setErrors] = useState<{ name?: string; roles?: string }>({});

  const zones = useMemo(() => timeZoneOptions(values.timezone), [values.timezone]);
  const sessionOptions = SESSION_PRESETS.includes(values.session_minutes)
    ? SESSION_PRESETS
    : [...SESSION_PRESETS, values.session_minutes].sort((a, b) => a - b);
  const limits = settings.limits;
  const nameLength = (values.organisation_name ?? "").trim().length;

  function update(changes: Partial<OrganisationSettingsValues>) {
    setDraft({ revision: settings.revision, values: { ...values, ...changes } });
    setSaveError(null);
    setErrors({});
  }

  function toggleRole(role: RequestableRole, on: boolean) {
    const next = new Set(values.requestable_roles);
    if (on) next.add(role);
    else next.delete(role);
    update({ requestable_roles: limits.requestable_roles.filter((option) => next.has(option)) });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !changed) return;

    const found: { name?: string; roles?: string } = {};
    if (nameLength > limits.organisation_name_max) {
      found.name = t("settings.name.tooLong", { max: limits.organisation_name_max });
    }
    if (values.access_requests_enabled && values.requestable_roles.length === 0) {
      found.roles = t("settings.requests.rolesRequired");
    }
    setErrors(found);
    if (found.name || found.roles) {
      document.getElementById(found.name ? `${ids}-name` : `${ids}-role-${limits.requestable_roles[0]}`)?.focus();
      return;
    }

    setBusy(true);
    setSaveError(null);

    try {
      await updateSettings(token, settings.revision, {
        ...values,
        organisation_name: (values.organisation_name ?? "").trim() || null,
        timezone: values.timezone || null,
      });
      setBusy(false);
      setDraft(null);
      onSaved(t("settings.saved"));
    } catch (caught) {
      setBusy(false);
      if (caught instanceof ApiError && caught.kind === "unauthorized") {
        signOut();
        return;
      }
      if (caught instanceof ApiError && caught.kind === "conflict") {
        setSaveError({ message: t("settings.stale"), stale: true });
        return;
      }
      if (caught instanceof ApiError && caught.kind === "forbidden") refreshProfile();
      setSaveError({
        message:
          caught instanceof ApiError && caught.kind === "invalid"
            ? t("settings.saveRejected", { detail: caught.message })
            : caught instanceof ApiError && caught.kind === "forbidden"
              ? t("settings.saveDenied")
              : caught instanceof ApiError && caught.kind === "network"
                ? t("settings.saveNetwork")
                : t("settings.saveServer"),
        stale: false,
      });
    }
  }

  return (
    <form className="ah-settings" noValidate onSubmit={save} aria-busy={busy || undefined}>
      <section className="ah-panel" aria-labelledby={`${ids}-org`}>
        <div className="ah-panel__header">
          <div>
            <h2 id={`${ids}-org`} className="ah-panel__title">
              {t("settings.orgTitle")}
            </h2>
            <p className="ah-panel__description">{t("settings.orgDescription")}</p>
          </div>
        </div>
        <div className="ah-stack-form">
          <div className="ah-form-field">
            <label htmlFor={`${ids}-name`} className="ah-field__label">
              {t("settings.name.label")}
            </label>
            <input
              id={`${ids}-name`}
              className="ah-input ah-input--plain"
              type="text"
              autoComplete="organization"
              value={values.organisation_name ?? ""}
              disabled={busy}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={`${ids}-name-hint${errors.name ? ` ${ids}-name-error` : ""}`}
              onChange={(event) => update({ organisation_name: event.target.value })}
            />
            <span id={`${ids}-name-hint`} className="ah-field__hint">
              {t("settings.name.hint", { count: Math.max(0, limits.organisation_name_max - nameLength) })}
            </span>
            {errors.name && (
              <span id={`${ids}-name-error`} className="ah-field__error">
                {errors.name}
              </span>
            )}
          </div>

          <div className="ah-form-field">
            <label htmlFor={`${ids}-tz`} className="ah-field__label">
              {t("settings.timezone.label")}
            </label>
            <div className="ah-select">
              <select
                id={`${ids}-tz`}
                value={values.timezone ?? ""}
                disabled={busy}
                aria-describedby={`${ids}-tz-hint`}
                onChange={(event) => update({ timezone: event.target.value || null })}
              >
                <option value="">{t("settings.timezone.viewer")}</option>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={16} className="ah-select__icon" />
            </div>
            <span id={`${ids}-tz-hint`} className="ah-field__hint">
              {values.timezone
                ? t("settings.timezone.hint", {
                    time: nowIn(locale, supportedTimeZone(values.timezone)),
                  })
                : t("settings.timezone.viewerHint")}
            </span>
          </div>
        </div>
      </section>

      <section className="ah-panel" aria-labelledby={`${ids}-requests`}>
        <div className="ah-panel__header">
          <div>
            <h2 id={`${ids}-requests`} className="ah-panel__title">
              {t("settings.requests.title")}
            </h2>
            <p className="ah-panel__description">{t("settings.requests.description")}</p>
          </div>
        </div>
        <div className="ah-stack-form">
          <label className="ah-settings__switch">
            <input
              type="checkbox"
              checked={values.access_requests_enabled}
              disabled={busy}
              aria-describedby={`${ids}-enabled-hint`}
              onChange={(event) => update({ access_requests_enabled: event.target.checked })}
            />
            <span>
              <span className="ah-settings__switch-label">{t("settings.requests.enabledLabel")}</span>
              <span id={`${ids}-enabled-hint`} className="ah-field__hint">
                {t("settings.requests.enabledHint")}
              </span>
            </span>
          </label>

          <fieldset
            className="ah-settings__roles"
            disabled={busy || !values.access_requests_enabled}
            aria-describedby={`${ids}-roles-hint${errors.roles ? ` ${ids}-roles-error` : ""}`}
          >
            <legend className="ah-field__label">{t("settings.requests.rolesLegend")}</legend>
            {limits.requestable_roles.map((role) => (
              <label key={role} className="ah-settings__check">
                <input
                  id={`${ids}-role-${role}`}
                  type="checkbox"
                  checked={values.requestable_roles.includes(role)}
                  aria-invalid={Boolean(errors.roles)}
                  onChange={(event) => toggleRole(role, event.target.checked)}
                />
                {roleName(role)}
              </label>
            ))}
            <span id={`${ids}-roles-hint`} className="ah-field__hint">
              {t("settings.requests.rolesHint")}
            </span>
            {errors.roles && (
              <span id={`${ids}-roles-error`} className="ah-field__error">
                {errors.roles}
              </span>
            )}
          </fieldset>
        </div>
      </section>

      <section className="ah-panel" aria-labelledby={`${ids}-session`}>
        <div className="ah-panel__header">
          <div>
            <h2 id={`${ids}-session`} className="ah-panel__title">
              {t("settings.session.title")}
            </h2>
            <p className="ah-panel__description">{t("settings.session.description")}</p>
          </div>
        </div>
        <div className="ah-stack-form">
          <div className="ah-form-field">
            <label htmlFor={`${ids}-minutes`} className="ah-field__label">
              {t("settings.session.label")}
            </label>
            <div className="ah-select">
              <select
                id={`${ids}-minutes`}
                value={values.session_minutes}
                disabled={busy}
                aria-describedby={`${ids}-minutes-hint`}
                onChange={(event) => update({ session_minutes: Number(event.target.value) })}
              >
                {sessionOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes % 60 === 0
                      ? tp("settings.session.hours", minutes / 60, { count: minutes / 60 })
                      : tp("settings.session.minutes", minutes, { count: minutes })}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={16} className="ah-select__icon" />
            </div>
            <span id={`${ids}-minutes-hint`} className="ah-field__hint">
              {t("settings.session.hint")}
            </span>
          </div>
        </div>
      </section>

      <section className="ah-panel ah-settings__actions" aria-label={t("settings.actionsLabel")}>
        {saveError && (
          <div className="ah-form-error ah-roles__error" role="alert">
            <span>{saveError.message}</span>
            {saveError.stale && (
              <button
                type="button"
                className="ah-btn ah-btn--secondary ah-btn--small"
                onClick={() => {
                  setDraft(null);
                  setSaveError(null);
                  onReload();
                }}
              >
                <Icon name="refresh" size={14} />
                {t("settings.reload")}
              </button>
            )}
          </div>
        )}
        <div className="ah-roles__actions">
          <p className="ah-roles__status" aria-live="polite">
            {changed
              ? t("settings.unsaved")
              : settings.updated_at
                ? t("settings.lastUpdated", {
                    time: formatFullDateTime(new Date(settings.updated_at)),
                    name: settings.updated_by?.username ?? "—",
                  })
                : t("settings.defaults")}
          </p>
          <div className="ah-stack-form__actions">
            <button
              type="button"
              className="ah-btn ah-btn--secondary"
              disabled={busy || !changed}
              onClick={() => {
                setDraft(null);
                setErrors({});
                setSaveError(null);
              }}
            >
              {t("common.cancel")}
            </button>
            <button type="submit" className="ah-btn ah-btn--primary" disabled={busy || !changed}>
              {busy ? t("settings.saving") : t("settings.save")}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}

function SettingsEditor() {
  const { t } = useI18n();
  const { refreshOrganisation } = useOrganisation();
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const { state, reload } = useApiResource(`settings:${version}`, (token, signal) =>
    fetchSettings(token, signal)
  );

  return (
    <>
      {isDemoSession() && (
        <p className="ah-notice ah-notice--info ah-demo-shared" role="note">
          <Icon name="alert" size={18} className="ah-notice__icon" />
          <span className="ah-notice__text">{t("settings.demoShared")}</span>
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

      {state.status === "loading" && (
        <section className="ah-panel">
          <div className="ah-loading" aria-busy="true">
            <p className="ah-sr-only" role="status">
              {t("settings.loading")}
            </p>
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="ah-skeleton-row">
                <span className="ah-skeleton ah-skeleton--text" />
              </div>
            ))}
          </div>
        </section>
      )}

      {state.status === "forbidden" && (
        <section className="ah-panel">
          <StateMessage icon="lock" tone="warning" title={t("settings.deniedTitle")} role="alert">
            {t("settings.apiDeniedBody", { detail: state.detail })}
          </StateMessage>
        </section>
      )}

      {state.status === "error" && (
        <section className="ah-panel">
          <StateMessage
            icon="alert"
            tone="danger"
            title={t("settings.errorTitle")}
            role="alert"
            action={
              <button type="button" className="ah-btn ah-btn--primary" onClick={reload}>
                <Icon name="refresh" size={16} />
                {t("common.tryAgain")}
              </button>
            }
          >
            {state.reason === "network" ? t("settings.errorNetwork") : t("settings.errorServer")}
          </StateMessage>
        </section>
      )}

      {state.status === "ready" && (
        <div className={state.refreshing ? "ah-roles__results is-refreshing" : "ah-roles__results"}>
          <SettingsForm
            settings={state.data}
            onReload={() => setVersion((current) => current + 1)}
            onSaved={(message) => {
              setNotice(message);
              // Show what the API saved, and apply it to this session's interface.
              setVersion((current) => current + 1);
              refreshOrganisation();
            }}
          />
        </div>
      )}
    </>
  );
}

/** Organisation settings. Only Admins can view or change them; the API enforces it. */
function SettingsPage() {
  const { user, can } = useAuth();
  const { t } = useI18n();
  const allowed = isAdminRole(user?.role) && can("settings:manage");

  return (
    <>
      <PageHeader eyebrow={t("dashboard.eyebrow")} title={t("settings.title")} description={t("settings.description")} />
      {allowed ? (
        <div className="ah-requests-page">
          <SettingsEditor />
        </div>
      ) : (
        <section className="ah-panel">
          <StateMessage icon="lock" tone="warning" title={t("settings.deniedTitle")}>
            {t("settings.deniedBody")}
          </StateMessage>
        </section>
      )}
    </>
  );
}

export default SettingsPage;
