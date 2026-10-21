import { useEffect, useId, useMemo, useState } from "react";

import { fetchActivity, type ActivityEvent, type AuditOutcome, type AuditQuery } from "../api/client";
import { useAuth } from "../auth/context";
import ActivityItem from "../components/activity/ActivityItem";
import AuditDetailsDialog from "../components/audit/AuditDetailsDialog";
import { AUDIT_EVENT_TYPES, OUTCOMES, OUTCOME_LABELS } from "../components/audit/auditLabels";
import Icon from "../components/ui/Icon";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import StateMessage from "../components/ui/StateMessage";
import { useApiResource } from "../hooks/useApiResource";
import { useI18n } from "../i18n/context";

const PAGE_SIZE = 30;
const SEARCH_DELAY_MS = 300;

/** Consecutive events grouped by day (the feed is newest first). */
function groupByDay(events: ActivityEvent[], dayKey: (date: Date) => string) {
  const groups: Array<{ key: string; date: Date; events: ActivityEvent[] }> = [];
  for (const event of events) {
    const key = dayKey(new Date(event.occurred_at));
    const last = groups.at(-1);
    if (last?.key === key) last.events.push(event);
    else groups.push({ key, date: new Date(event.occurred_at), events: [event] });
  }
  return groups;
}

function ActivityFeed() {
  const { t, tp, formatNumber, formatDay, dayKey, startOfDay } = useI18n();
  const ids = useId();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [outcome, setOutcome] = useState<AuditOutcome | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ActivityEvent | null>(null);

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
      until: to && !dateRangeInvalid ? startOfDay(to, 1) : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, eventType, outcome, from, to, dateRangeInvalid, page, startOfDay]
  );

  const { state, reload } = useApiResource(`activity:${JSON.stringify(query)}`, (token, signal) =>
    fetchActivity(token, query, signal)
  );

  const filtersActive = Boolean(search || eventType || outcome || from || to);
  const ready = state.status === "ready" ? state : null;
  const total = ready?.data.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setEventType("");
    setOutcome("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <section className="ah-panel" aria-labelledby={`${ids}-title`}>
      <div className="ah-panel__header">
        <div>
          <h2 id={`${ids}-title`} className="ah-panel__title">
            {t("activityFeed.panelTitle")}
            {ready && <span className="ah-panel__count">({formatNumber(total)})</span>}
          </h2>
          <p className="ah-panel__description">{t("activityFeed.panelDescription")}</p>
        </div>
        <div className="ah-panel__actions">
          <button
            type="button"
            className="ah-btn ah-btn--secondary"
            onClick={reload}
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

      {state.status === "loading" && (
        <div className="ah-loading" aria-busy="true">
          <p className="ah-sr-only" role="status">
            {t("activityFeed.loading")}
          </p>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="ah-skeleton-row">
              <span className="ah-skeleton ah-skeleton--short" />
              <span className="ah-skeleton ah-skeleton--text" />
            </div>
          ))}
        </div>
      )}

      {state.status === "forbidden" && (
        <StateMessage icon="lock" tone="warning" title={t("activityFeed.deniedTitle")} role="alert">
          {t("activityFeed.apiDeniedBody", { detail: state.detail })}
        </StateMessage>
      )}

      {state.status === "error" && (
        <StateMessage
          icon="alert"
          tone="danger"
          title={t("activityFeed.errorTitle")}
          role="alert"
          action={
            <button type="button" className="ah-btn ah-btn--primary" onClick={reload}>
              <Icon name="refresh" size={16} />
              {t("common.tryAgain")}
            </button>
          }
        >
          {state.reason === "network" ? t("activityFeed.errorNetwork") : t("activityFeed.errorServer")}
        </StateMessage>
      )}

      {ready && total === 0 && !filtersActive && (
        <StateMessage icon="activity" title={t("activityFeed.emptyTitle")}>
          {t("activityFeed.emptyBody")}
        </StateMessage>
      )}

      {ready && total === 0 && filtersActive && (
        <StateMessage
          icon="search"
          title={t("activityFeed.noMatchesTitle")}
          action={
            <button type="button" className="ah-btn ah-btn--secondary" onClick={clearFilters}>
              {t("table.clearFilters")}
            </button>
          }
        >
          {t("activityFeed.noMatchesBody")}
        </StateMessage>
      )}

      {ready && total > 0 && (
        <>
          <div
            className={`ah-feed${ready.refreshing ? " is-refreshing" : ""}`}
            aria-busy={ready.refreshing || undefined}
          >
            {groupByDay(ready.data.events, dayKey).map((group) => (
              <section key={group.key} className="ah-feed__day" aria-labelledby={`${ids}-${group.key}`}>
                <h3 id={`${ids}-${group.key}`} className="ah-feed__date">
                  {formatDay(group.date)}
                </h3>
                <ol className="ah-feed__list">
                  {group.events.map((event) => (
                    <ActivityItem key={event.id} event={event} onDetails={setSelected} />
                  ))}
                </ol>
              </section>
            ))}
          </div>

          <div className="ah-table-footer">
            <p className="ah-table-footer__summary" role="status">
              {ready.refreshing
                ? t("audit.updating")
                : tp("activityFeed.summary", total, {
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
                navigation: t("activityFeed.pagination"),
                previous: t("table.previousPage"),
                next: t("table.nextPage"),
                page: (number) => t("table.page", { page: formatNumber(number) }),
              }}
            />
          </div>
        </>
      )}

      {selected && <AuditDetailsDialog event={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

/** The organisation's sign-ins and access events. The API checks activity:read. */
function ActivityPage() {
  const { can } = useAuth();
  const { t } = useI18n();

  return (
    <>
      <PageHeader eyebrow={t("dashboard.eyebrow")} title={t("activityFeed.title")} description={t("activityFeed.description")} />
      {can("activity:read") ? (
        <ActivityFeed />
      ) : (
        <section className="ah-panel">
          <StateMessage icon="lock" tone="warning" title={t("activityFeed.deniedTitle")}>
            {t("activityFeed.deniedBody")}
          </StateMessage>
        </section>
      )}
    </>
  );
}

export default ActivityPage;
