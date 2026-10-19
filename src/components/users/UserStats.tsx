import { useMemo } from "react";

import type { UsersState } from "../../hooks/useUsers";
import { useI18n } from "../../i18n/context";
import StatCard from "../ui/StatCard";
import { roleOptions, summarizeUsers } from "./userQuery";

type UserStatsProps = {
  state: UsersState;
};

/** Summary tiles derived from the GET /users response. */
function UserStats({ state }: UserStatsProps) {
  const { t, roleName, formatNumber, formatPercent, formatList } = useI18n();
  const users = state.status === "ready" ? state.users : null;
  const summary = useMemo(() => (users ? summarizeUsers(users) : null), [users]);
  const roles = useMemo(
    () => (users ? roleOptions(users).map((option) => option.role) : []),
    [users]
  );

  if (state.status !== "loading" && !summary) return null;

  const loading = state.status === "loading";

  function shareOf(count: number, total: number): string {
    if (total === 0) return t("stats.noAccounts");
    return t("stats.share", { percent: formatPercent(count / total) });
  }

  return (
    <section className="ah-stats" aria-label={t("stats.label")}>
      <StatCard
        label={t("stats.total")}
        icon="users"
        tone="blue"
        loading={loading}
        value={summary && formatNumber(summary.total)}
        detail={t("stats.totalDetail")}
      />
      <StatCard
        label={t("stats.active")}
        icon="userCheck"
        tone="green"
        loading={loading}
        value={summary && (summary.active === null ? "—" : formatNumber(summary.active))}
        detail={
          summary &&
          (summary.active === null
            ? t("stats.activeUnavailable")
            : shareOf(summary.active, summary.total))
        }
      />
      <StatCard
        label={t("stats.admins")}
        icon="shieldCheck"
        tone="violet"
        loading={loading}
        value={summary && formatNumber(summary.admins)}
        detail={summary && shareOf(summary.admins, summary.total)}
      />
      <StatCard
        label={t("stats.roles")}
        icon="layers"
        tone="amber"
        loading={loading}
        value={summary && formatNumber(summary.roles)}
        detail={roles.length ? formatList(roles.map((role) => roleName(role))) : undefined}
      />
    </section>
  );
}

export default UserStats;
