import { useId, useMemo, useState } from "react";

import type { User } from "../../api/client";
import { normalizeRole } from "../../auth/roles";
import { useI18n } from "../../i18n/context";
import Avatar from "../ui/Avatar";
import DataTable, { type Column, type SortState } from "../ui/DataTable";
import Icon from "../ui/Icon";
import MenuButton, { type MenuItem } from "../ui/MenuButton";
import Pagination from "../ui/Pagination";
import RoleBadge from "../ui/RoleBadge";
import StateMessage from "../ui/StateMessage";
import type { ConfirmAction } from "./ConfirmUserDialog";
import {
  ALL_ROLES,
  activeAdminCount,
  hasStatus,
  isActive,
  queryUsers,
  roleOptions,
  type StatusFilter,
  type UserSortKey,
} from "./userQuery";

const PAGE_SIZES = [10, 25, 50];

export type UserAction = "edit" | ConfirmAction;

type UsersTableProps = {
  users: User[];
  currentUserId?: number;
  initialSearch?: string;
  defaultPageSize?: number;
  /** Row actions; omitted for people who can't manage users. */
  onAction?: (action: UserAction, user: User) => void;
};

function UsersTable({
  users,
  currentUserId,
  initialSearch = "",
  defaultPageSize = PAGE_SIZES[0],
  onAction,
}: UsersTableProps) {
  const { t, tp, roleName, formatNumber } = useI18n();
  const [search, setSearch] = useState(initialSearch);
  const [role, setRole] = useState(ALL_ROLES);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortState<UserSortKey>>({
    key: "username",
    direction: "asc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const ids = useId();
  const statusKnown = useMemo(() => hasStatus(users), [users]);
  const roles = useMemo(() => roleOptions(users), [users]);
  const adminCount = useMemo(() => activeAdminCount(users), [users]);
  const result = useMemo(
    () => queryUsers(users, { search, role, status, sort, page, pageSize }),
    [users, search, role, status, sort, page, pageSize]
  );

  // Mirrors the API's safeguards so unavailable actions explain themselves;
  // the API still enforces every rule.
  const columns = useMemo<Column<User, UserSortKey>[]>(() => {
    function rowActions(user: User): MenuItem[] {
      const self = user.id === currentUserId;
      const active = isActive(user);
      const lastAdmin =
        normalizeRole(user.role) === "admin" && active && !user.is_seed && adminCount <= 1;
      const run = (action: UserAction) => () => onAction?.(action, user);

      return [
        { key: "edit", label: t("users.edit"), icon: "edit", onSelect: run("edit") },
        active
          ? {
              key: "deactivate",
              label: t("users.deactivate"),
              icon: "userX",
              disabled: self || lastAdmin,
              hint: self ? t("users.selfHint") : lastAdmin ? t("users.lastAdminHint") : undefined,
              onSelect: run("deactivate"),
            }
          : {
              key: "reactivate",
              label: t("users.reactivate"),
              icon: "refresh",
              onSelect: run("reactivate"),
            },
        {
          key: "delete",
          label: t("users.delete"),
          icon: "trash",
          tone: "danger",
          disabled: self || active,
          hint: self
            ? t("users.selfHint")
            : active
              ? t("users.deleteNeedsDeactivate")
              : undefined,
          onSelect: run("delete"),
        },
      ];
    }

    // Usernames and IDs are API data and are rendered as returned.
    const base: Column<User, UserSortKey>[] = [
      {
        key: "username",
        header: t("table.columnUser"),
        sortable: true,
        render: (user) => (
          <span className="ah-user-cell">
            <Avatar name={user.username} />
            <span className="ah-user-cell__text">
              <span className="ah-user-cell__name">
                {user.username || t("table.unknownUser")}
                {user.id === currentUserId && (
                  <span className="ah-badge ah-badge--you">{t("users.you")}</span>
                )}
                {user.is_seed && (
                  <span className="ah-badge ah-badge--demo">
                    {t("users.demoBadge")}
                    <span className="ah-sr-only"> ({t("users.demoBadgeLabel")})</span>
                  </span>
                )}
              </span>
              {user.must_change_password && (
                <span className="ah-user-cell__meta">{t("users.passwordPending")}</span>
              )}
            </span>
          </span>
        ),
      },
      {
        key: "id",
        header: t("table.columnId"),
        sortable: true,
        className: "ah-col-id",
        render: (user) => <span className="ah-mono">#{user.id}</span>,
      },
      {
        key: "role",
        header: t("table.columnRole"),
        sortable: true,
        render: (user) => <RoleBadge role={user.role} />,
      },
    ];

    if (statusKnown) {
      base.push({
        key: "status",
        header: t("table.columnStatus"),
        sortable: true,
        render: (user) => {
          const active = isActive(user);
          return (
            <span className={`ah-status ah-status--${active ? "active" : "inactive"}`}>
              <span className="ah-status__dot" aria-hidden="true" />
              {active ? t("status.active") : t("status.deactivated")}
            </span>
          );
        },
      });
    }

    if (onAction) {
      base.push({
        // Not a sortable data column; the key only needs to be unique.
        key: "actions" as UserSortKey,
        header: t("table.columnActions"),
        className: "ah-col-actions",
        render: (user) => (
          <MenuButton
            label={t("users.actionsFor", { name: user.username })}
            menuLabel={t("users.actionsFor", { name: user.username })}
            triggerClassName="ah-icon-btn ah-row-actions"
            items={rowActions(user)}
          >
            <Icon name="more" size={18} />
          </MenuButton>
        ),
      });
    }

    return base;
  }, [t, statusKnown, onAction, currentUserId, adminCount]);

  const filtersActive = search.trim() !== "" || role !== ALL_ROLES || status !== "all";

  function clearFilters() {
    setSearch("");
    setRole(ALL_ROLES);
    setStatus("all");
    setPage(1);
  }

  function summary() {
    const total = formatNumber(users.length);

    if (result.matchCount === 0) {
      return tp("table.summaryNone", users.length, { total });
    }

    const range = {
      start: formatNumber(result.start),
      end: formatNumber(result.end),
      total,
    };

    return filtersActive
      ? tp("table.summaryFiltered", result.matchCount, {
          ...range,
          count: formatNumber(result.matchCount),
        })
      : tp("table.summary", users.length, range);
  }

  if (users.length === 0) {
    return (
      <StateMessage icon="users" title={t("table.emptyTitle")}>
        {t("table.emptyBody")}
      </StateMessage>
    );
  }

  return (
    <>
      <div className="ah-toolbar">
        <div className="ah-field ah-field--search">
          <label htmlFor={`${ids}-search`} className="ah-field__label">
            {t("table.search")}
          </label>
          <div className="ah-input-wrap">
            <Icon name="search" size={18} className="ah-input-wrap__icon" />
            <input
              id={`${ids}-search`}
              className="ah-input"
              type="search"
              placeholder={t("table.searchPlaceholder")}
              autoComplete="off"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="ah-field">
          <label htmlFor={`${ids}-role`} className="ah-field__label">
            {t("table.role")}
          </label>
          <div className="ah-select">
            <select
              id={`${ids}-role`}
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value={ALL_ROLES}>{t("table.allRoles")}</option>
              {roles.map((option) => (
                <option key={option.role} value={option.role}>
                  {roleName(option.role)} ({formatNumber(option.count)})
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={16} className="ah-select__icon" />
          </div>
        </div>

        <div className="ah-field">
          <label htmlFor={`${ids}-status`} className="ah-field__label">
            {t("table.status")}
          </label>
          <div className="ah-select">
            <select
              id={`${ids}-status`}
              value={status}
              disabled={!statusKnown}
              aria-describedby={statusKnown ? undefined : `${ids}-status-hint`}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="all">{t("table.allStatuses")}</option>
              <option value="active">{t("status.active")}</option>
              <option value="inactive">{t("status.deactivated")}</option>
            </select>
            <Icon name="chevronDown" size={16} className="ah-select__icon" />
          </div>
          {!statusKnown && (
            <span id={`${ids}-status-hint`} className="ah-field__hint">
              {t("table.statusHint")}
            </span>
          )}
        </div>
      </div>

      {result.matchCount === 0 ? (
        <StateMessage
          icon="search"
          title={t("table.noMatchesTitle")}
          action={
            <button type="button" className="ah-btn ah-btn--secondary" onClick={clearFilters}>
              {t("table.clearFilters")}
            </button>
          }
        >
          {t("table.noMatchesBody")}
        </StateMessage>
      ) : (
        <DataTable
          caption={t("table.caption")}
          columns={columns}
          rows={result.rows}
          getRowKey={(user) => user.id}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
      )}

      <div className="ah-table-footer">
        <p className="ah-table-footer__summary" role="status">
          {summary()}
        </p>

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          onPageChange={setPage}
          labels={{
            navigation: t("table.pagination"),
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
  );
}

export default UsersTable;
