import { useEffect, useId, useMemo, useState } from "react";

import type { AuditEvent, AuditOutcome, AuditQuery } from "../api/client";
import { useAuth } from "../auth/context";
import { isAdminRole } from "../auth/roles";
import AuditDetailsDialog from "../components/audit/AuditDetailsDialog";
import {
  AUDIT_EVENT_TYPES,
  EVENT_LABELS,
  OUTCOMES,
  OUTCOME_LABELS,
  REASON_LABELS,
} from "../components/audit/auditLabels";
import OutcomeBadge from "../components/audit/OutcomeBadge";
import DataTable, { type Column } from "../components/ui/DataTable";
import Icon from "../components/ui/Icon";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import RoleBadge from "../components/ui/RoleBadge";
import StateMessage from "../components/ui/StateMessage";
import { useAuditEvents } from "../hooks/useAuditEvents";
import { useI18n } from "../i18n/context";

const PAGE_SIZES = [10, 25, 50];
const SEARCH_DELAY_MS = 300;

function LoadingRows({ label }: { label: string }) {
  return (
    <div className="ah-loading" aria-busy="true">
      <p className="ah-sr-only" role="status">
        {label}
      </p>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="ah-skeleton-row">
          <span className="ah-skeleton ah-skeleton--short" />
          <span className="ah-skeleton ah-skeleton--text" />
          <span className="ah-skeleton ah-skeleton--short" />
        </div>
      ))}
    </div>
  );
}

function AuditLog() {
  const { t, tp, roleName, formatNumber, formatDateTime, startOfDay } = useI18n();
  const ids = useId();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [outcome, setOutcome] = useState<AuditOutcome | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  // Search as the user types, without a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const dateRangeInvalid = Boolean(from && to && from > to);

  const query = useMemo<AuditQuery>(
    () => ({
      search: search || undefined,
      eventType: eventType || undefined,
      outcome: outcome || undefined,
      since: from && !dateRangeInvalid ? startOfDay(from) : undefined,
      // Inclusive "to" date: everything before the next local midnight.
      until: to && !dateRangeInvalid ? startOfDay(to, 1) : undefined,
      page,
      pageSize,
    }),
    [search, eventType, outcome, from, to, dateRangeInvalid, page, pageSize, startOfDay]
  );

  const { state, retry } = useAuditEvents(query);
  const filtersActive = Boolean(search || eventType || outcome || from || to);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setEventType("");
    setOutcome("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const columns = useMemo<Column<AuditEvent, string>[]>(
    () => [
      {
        key: "time",
        header: t("audit.columnTime"),
        className: "ah-audit__time",
        render: (event) => (
          <time dateTime={event.occurred_at}>{formatDateTime(new Date(event.occurred_at))}</time>
        ),
      },
      {
        key: "actor",
        header: t("audit.columnActor"),
        render: (event) =>
          event.actor?.username ? (
            <span className="ah-audit__person">
              <span className="ah-audit__name">{event.actor.username}</span>
              {event.actor.role && <RoleBadge role={event.actor.role} />}
            </span>
          ) : (
            <span className="ah-audit__muted">{t("audit.anonymous")}</span>
          ),
      },
      {
        key: "event",
        header: t("audit.columnEvent"),
        render: (event) => {
          const reason = event.details.reason;
          return (
            <span className="ah-audit__event">
              <span>
                {EVENT_LABELS[event.event_type]
                  ? t(EVENT_LABELS[event.event_type])
                  : event.event_type}
              </span>
              {typeof reason === "string" && (
                <span className="ah-audit__muted">
                  {REASON_LABELS[reason] ? t(REASON_LABELS[reason]) : reason}
                </span>
              )}
            </span>
          );
        },
      },
      {
        key: "target",
        header: t("audit.columnTarget"),
        render: (event) =>
          event.target?.username ? (
            <span className="ah-audit__name">
              {event.target.type === "role"
                ? t("audit.roleTarget", { role: roleName(event.target.username) })
                : event.target.username}
            </span>
          ) : (
            <span className="ah-audit__muted" aria-label={t("audit.noTarget")}>
              —
            </span>
          ),
      },
      {
        key: "outcome",
        header: t("audit.columnOutcome"),
        render: (event) => <OutcomeBadge outcome={event.outcome} />,
      },
      {
        key: "details",
        header: t("audit.columnDetails"),
        className: "ah-col-actions",
        render: (event) => (
          <button
            type="button"
            className="ah-btn ah-btn--secondary ah-btn--small"
            aria-label={t("audit.viewDetails", { id: event.id })}
            onClick={(clicked) => {
              // Safari/Firefox don't focus buttons on click; the dialog
              // returns focus to whatever had it when it opened.
              clicked.currentTarget.focus();
              setSelected(event);
            }}
          >
            {t("audit.details")}
          </button>
        ),
      },
    ],
    [t, roleName, formatDateTime]
  );

  const ready = state.status === "ready" ? state : null;
  const total = ready?.page.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <section className="ah-panel" aria-labelledby={`${ids}-title`}>
      <div className="ah-panel__header">
        <div>
          <h2 id={`${ids}-title`} className="ah-panel__title">
            {t("audit.panelTitle")}
            {ready && <span className="ah-panel__count">({formatNumber(total)})</span>}
          </h2>
          <p className="ah-panel__description">{t("audit.panelDescription")}</p>
        </div>
        <div className="ah-panel__actions">
          <button
            type="button"
            className="ah-btn ah-btn--secondary"
            onClick={retry}
            disabled={state.status === "loading" || Boolean(ready?.refreshing)}
          >
            <Icon name="refresh" size={16} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      <div className="ah-toolbar">
        <div className="ah-field ah-field--search">
          <label htmlFor={`${ids}-search`} className="ah-field__label">
            {t("audit.search")}
          </label>
          <div className="ah-input-wrap">
            <Icon name="search" size={18} className="ah-input-wrap__icon" />
            <input
              id={`${ids}-search`}
              className="ah-input"
              type="search"
              placeholder={t("audit.searchPlaceholder")}
              autoComplete="off"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
        </div>

        <div className="ah-field">
          <label htmlFor={`${ids}-type`} className="ah-field__label">
            {t("audit.eventType")}
          </label>
          <div className="ah-select">
            <select
              id={`${ids}-type`}
              value={eventType}
              onChange={(event) => {
                setEventType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("audit.allEvents")}</option>
              {AUDIT_EVENT_TYPES.map(({ type, label }) => (
                <option key={type} value={type}>
                  {t(label)}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={16} className="ah-select__icon" />
          </div>
        </div>

        <div className="ah-field">
          <label htmlFor={`${ids}-outcome`} className="ah-field__label">
            {t("audit.outcome")}
          </label>
          <div className="ah-select">
            <select
              id={`${ids}-outcome`}
              value={outcome}
              onChange={(event) => {
                setOutcome(event.target.value as AuditOutcome | "");
                setPage(1);
              }}
            >
              <option value="">{t("audit.allOutcomes")}</option>
              {OUTCOMES.map((value) => (
                <option key={value} value={value}>
                  {t(OUTCOME_LABELS[value])}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={16} className="ah-select__icon" />
          </div>
        </div>

        <div className="ah-field ah-field--date">
          <label htmlFor={`${ids}-from`} className="ah-field__label">
            {t("audit.from")}
          </label>
          <input
            id={`${ids}-from`}
            className="ah-input ah-input--plain"
            type="date"
            value={from}
            max={to || undefined}
            aria-invalid={dateRangeInvalid}
            aria-describedby={dateRangeInvalid ? `${ids}-dates` : undefined}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="ah-field ah-field--date">
          <label htmlFor={`${ids}-to`} className="ah-field__label">
            {t("audit.to")}
          </label>
          <input
            id={`${ids}-to`}
            className="ah-input ah-input--plain"
            type="date"
            value={to}
            min={from || undefined}
            aria-invalid={dateRangeInvalid}
            aria-describedby={dateRangeInvalid ? `${ids}-dates` : undefined}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {filtersActive && (
          <div className="ah-field ah-field--action">
            <button type="button" className="ah-btn ah-btn--secondary" onClick={clearFilters}>
              {t("table.clearFilters")}
            </button>
          </div>
        )}

        {dateRangeInvalid && (
          <p id={`${ids}-dates`} className="ah-field__error ah-toolbar__message" role="alert">
            {t("audit.dateRangeInvalid")}
          </p>
        )}
      </div>

      {state.status === "loading" && <LoadingRows label={t("audit.loading")} />}

      {state.status === "forbidden" && (
        <StateMessage icon="lock" tone="warning" title={t("audit.deniedTitle")} role="alert">
          {t("audit.apiDeniedBody", { detail: state.detail })}
        </StateMessage>
      )}

      {state.status === "error" && (
        <StateMessage
          icon="alert"
          tone="danger"
          title={t("audit.errorTitle")}
          role="alert"
          action={
            <button type="button" className="ah-btn ah-btn--primary" onClick={retry}>
              <Icon name="refresh" size={16} />
              {t("common.tryAgain")}
            </button>
          }
        >
          {state.reason === "network" ? t("audit.errorNetwork") : t("audit.errorServer")}
        </StateMessage>
      )}

      {ready && total === 0 && !filtersActive && (
        <StateMessage icon="fileText" title={t("audit.emptyTitle")}>
          {t("audit.emptyBody")}
        </StateMessage>
      )}

      {ready && total === 0 && filtersActive && (
        <StateMessage
          icon="search"
          title={t("audit.noMatchesTitle")}
          action={
            <button type="button" className="ah-btn ah-btn--secondary" onClick={clearFilters}>
              {t("table.clearFilters")}
            </button>
          }
        >
          {t("audit.noMatchesBody")}
        </StateMessage>
      )}

      {ready && total > 0 && (
        <>
          <div
            className={`ah-audit__results${ready.refreshing ? " is-refreshing" : ""}`}
            aria-busy={ready.refreshing || undefined}
          >
            <DataTable
              caption={t("audit.caption")}
              columns={columns}
              rows={ready.page.events}
              getRowKey={(event) => event.id}
            />
          </div>

          <div className="ah-table-footer">
            <p className="ah-table-footer__summary" role="status">
              {ready.refreshing
                ? t("audit.updating")
                : tp("audit.summary", total, {
                    start: formatNumber(start),
                    end: formatNumber(end),
                    total: formatNumber(total),
                  })}
            </p>

            <Pagination
              page={Math.min(page, pageCount)}
              pageCount={pageCount}
              onPageChange={setPage}
              labels={{
                navigation: t("audit.pagination"),
                previous: t("table.previousPage"),
                next: t("table.nextPage"),
                page: (number) => t("table.page", { page: formatNumber(number) }),
              }}
            />

            <div className="ah-field ah-field--inline">
              <label htmlFor={`${ids}-size`} className="ah-field__label">
                {t("table.rowsPerPage")}
              </label>
              <div className="ah-select ah-select--compact">
                <select
                  id={`${ids}-size`}
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {formatNumber(size)}
                    </option>
                  ))}
                </select>
                <Icon name="chevronDown" size={16} className="ah-select__icon" />
              </div>
            </div>
          </div>
        </>
      )}

      {selected && <AuditDetailsDialog event={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

/** Read-only audit log. The API serves it to admins only. */
function AuditLogPage() {
  const { user, can } = useAuth();
  const { t } = useI18n();
  const allowed = isAdminRole(user?.role) && can("audit:read");

  return (
    <>
      <PageHeader
        eyebrow={t("audit.eyebrow")}
        title={t("audit.title")}
        description={t("audit.description")}
      />

      {allowed ? (
        <AuditLog />
      ) : (
        <section className="ah-panel">
          <StateMessage icon="lock" tone="warning" title={t("audit.deniedTitle")}>
            {t("audit.deniedBody")}
          </StateMessage>
        </section>
      )}
    </>
  );
}

export default AuditLogPage;
