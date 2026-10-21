import { forwardRef, useEffect, useId, useMemo, useState } from "react";

import {
  fetchAccessRequests,
  type AccessRequest,
  type AccessRequestQuery,
  type AccessRequestStatus,
  type RequestableRole,
} from "../../api/client";
import { useApiResource } from "../../hooks/useApiResource";
import { useI18n } from "../../i18n/context";
import DataTable, { type Column } from "../ui/DataTable";
import Icon from "../ui/Icon";
import Pagination from "../ui/Pagination";
import StateMessage from "../ui/StateMessage";
import { REQUESTABLE_ROLES, REQUEST_STATUSES, STATUS_LABELS } from "./requestLabels";
import RequestStatusBadge from "./RequestStatusBadge";
import RoleChange from "./RoleChange";

const PAGE_SIZES = [10, 25, 50];
const SEARCH_DELAY_MS = 300;

type RequestQueueProps = {
  /** Changes whenever requests may have changed (e.g. after a decision). */
  version: number;
  initialStatus?: AccessRequestStatus;
  onOpen: (request: AccessRequest) => void;
};

/** The organisation's request queue and history, filtered on the server. */
const RequestQueue = forwardRef<HTMLHeadingElement, RequestQueueProps>(function RequestQueue(
  { version, initialStatus, onOpen },
  headingRef
) {
  const { t, tp, roleName, formatNumber, formatDateTime, startOfDay } = useI18n();
  const ids = useId();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AccessRequestStatus | "">(initialStatus ?? "");
  const [requestedRole, setRequestedRole] = useState<RequestableRole | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const dateRangeInvalid = Boolean(from && to && from > to);

  const query = useMemo<AccessRequestQuery>(
    () => ({
      search: search || undefined,
      status: status || undefined,
      requestedRole: requestedRole || undefined,
      since: from && !dateRangeInvalid ? startOfDay(from) : undefined,
      until: to && !dateRangeInvalid ? startOfDay(to, 1) : undefined,
      page,
      pageSize,
    }),
    [search, status, requestedRole, from, to, dateRangeInvalid, page, pageSize, startOfDay]
  );

  const { state, reload } = useApiResource(`queue:${JSON.stringify(query)}:${version}`, (token, signal) =>
    fetchAccessRequests(token, query, signal)
  );

  const filtersActive = Boolean(search || status || requestedRole || from || to);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setRequestedRole("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const columns = useMemo<Column<AccessRequest, string>[]>(
    () => [
      {
        key: "requester",
        header: t("requests.columnRequester"),
        render: (request) => (
          <span className="ah-audit__person">
            <span className="ah-audit__name">
              {request.requester.username}
              {request.is_seed && (
                <span className="ah-badge ah-badge--demo">
                  {t("users.demoBadge")}
                  <span className="ah-sr-only"> ({t("users.demoBadgeLabel")})</span>
                </span>
              )}
            </span>
            {request.requester.current_username === null ? (
              <span className="ah-audit__muted">{t("requests.deletedAccount")}</span>
            ) : request.requester.current_username !== request.requester.username ? (
              <span className="ah-audit__muted">
                {t("requests.renamedTo", { name: request.requester.current_username })}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: "change",
        header: t("requests.columnChange"),
        render: (request) => <RoleChange request={request} />,
      },
      {
        key: "reason",
        header: t("requests.columnReason"),
        className: "ah-requests__reason",
        render: (request) => <span className="ah-clamp">{request.reason}</span>,
      },
      {
        key: "status",
        header: t("requests.columnStatus"),
        render: (request) => <RequestStatusBadge status={request.status} />,
      },
      {
        key: "submitted",
        header: t("requests.columnSubmitted"),
        className: "ah-audit__time",
        render: (request) => (
          <time dateTime={request.submitted_at}>{formatDateTime(new Date(request.submitted_at))}</time>
        ),
      },
      {
        key: "decision",
        header: t("requests.columnDecision"),
        render: (request) =>
          request.decision ? (
            <span className="ah-audit__person">
              <span>{request.decision.reviewer.username ?? "—"}</span>
              <time className="ah-audit__muted" dateTime={request.decision.decided_at}>
                {formatDateTime(new Date(request.decision.decided_at))}
              </time>
            </span>
          ) : (
            <span className="ah-audit__muted">{t("requests.awaiting")}</span>
          ),
      },
      {
        key: "actions",
        header: t("requests.columnActions"),
        className: "ah-col-actions",
        render: (request) => {
          const review = request.status === "pending" && request.can_decide;
          return (
            <button
              type="button"
              className={`ah-btn ${review ? "ah-btn--primary" : "ah-btn--secondary"} ah-btn--small`}
              aria-label={
                review
                  ? t("requests.reviewFor", { name: request.requester.username })
                  : t("requests.viewRequest", { id: request.id })
              }
              onClick={(event) => {
                event.currentTarget.focus();
                onOpen(request);
              }}
            >
              {review ? t("requests.review") : t("requests.view")}
            </button>
          );
        },
      },
    ],
    [t, formatDateTime, onOpen]
  );

  const ready = state.status === "ready" ? state : null;
  const total = ready?.data.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <section className="ah-panel" aria-labelledby={`${ids}-title`}>
      <div className="ah-panel__header">
        <div>
          <h2 id={`${ids}-title`} ref={headingRef} tabIndex={-1} className="ah-panel__title">
            {t("requests.queueTitle")}
            {ready && <span className="ah-panel__count">({formatNumber(total)})</span>}
          </h2>
          <p className="ah-panel__description">{t("requests.queueDescription")}</p>
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
            {t("requests.search")}
          </label>
          <div className="ah-input-wrap">
            <Icon name="search" size={18} className="ah-input-wrap__icon" />
            <input
              id={`${ids}-search`}
              className="ah-input"
              type="search"
              placeholder={t("requests.searchPlaceholder")}
              autoComplete="off"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
        </div>

        <div className="ah-field">
          <label htmlFor={`${ids}-status`} className="ah-field__label">
            {t("requests.statusFilter")}
          </label>
          <div className="ah-select">
            <select
              id={`${ids}-status`}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as AccessRequestStatus | "");
                setPage(1);
              }}
            >
              <option value="">{t("requests.allStatuses")}</option>
              {REQUEST_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(STATUS_LABELS[value])}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={16} className="ah-select__icon" />
          </div>
        </div>

        <div className="ah-field">
          <label htmlFor={`${ids}-role`} className="ah-field__label">
            {t("requests.roleFilter")}
          </label>
          <div className="ah-select">
            <select
              id={`${ids}-role`}
              value={requestedRole}
              onChange={(event) => {
                setRequestedRole(event.target.value as RequestableRole | "");
                setPage(1);
              }}
            >
              <option value="">{t("requests.allRoles")}</option>
              {REQUESTABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleName(role)}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={16} className="ah-select__icon" />
          </div>
        </div>

        <div className="ah-field ah-field--date">
          <label htmlFor={`${ids}-from`} className="ah-field__label">
            {t("requests.from")}
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
            {t("requests.to")}
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
            {t("requests.loading")}
          </p>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="ah-skeleton-row">
              <span className="ah-skeleton ah-skeleton--text" />
              <span className="ah-skeleton ah-skeleton--short" />
            </div>
          ))}
        </div>
      )}

      {state.status === "forbidden" && (
        <StateMessage icon="lock" tone="warning" title={t("requests.deniedTitle")} role="alert">
          {t("requests.apiDeniedBody", { detail: state.detail })}
        </StateMessage>
      )}

      {state.status === "error" && (
        <StateMessage
          icon="alert"
          tone="danger"
          title={t("requests.errorTitle")}
          role="alert"
          action={
            <button type="button" className="ah-btn ah-btn--primary" onClick={reload}>
              <Icon name="refresh" size={16} />
              {t("common.tryAgain")}
            </button>
          }
        >
          {state.reason === "network" ? t("requests.errorNetwork") : t("requests.errorServer")}
        </StateMessage>
      )}

      {ready && total === 0 && !filtersActive && (
        <StateMessage icon="userPlus" title={t("requests.emptyTitle")}>
          {t("requests.emptyBody")}
        </StateMessage>
      )}

      {ready && total === 0 && filtersActive && (
        <StateMessage
          icon="search"
          title={t("requests.noMatchesTitle")}
          action={
            <button type="button" className="ah-btn ah-btn--secondary" onClick={clearFilters}>
              {t("table.clearFilters")}
            </button>
          }
        >
          {t("requests.noMatchesBody")}
        </StateMessage>
      )}

      {ready && total > 0 && (
        <>
          <div
            className={`ah-requests__results${ready.refreshing ? " is-refreshing" : ""}`}
            aria-busy={ready.refreshing || undefined}
          >
            <DataTable
              caption={t("requests.caption")}
              columns={columns}
              rows={ready.data.requests}
              getRowKey={(request) => request.id}
            />
          </div>

          <div className="ah-table-footer">
            <p className="ah-table-footer__summary" role="status">
              {tp("requests.summary", total, {
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
                navigation: t("requests.pagination"),
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
    </section>
  );
});

export default RequestQueue;
