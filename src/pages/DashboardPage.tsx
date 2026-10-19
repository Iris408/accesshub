import { useAuth } from "../auth/context";
import ActivityPanel from "../components/dashboard/ActivityPanel";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import UserStats from "../components/users/UserStats";
import UsersPanel from "../components/users/UsersPanel";
import { useUsers } from "../hooks/useUsers";
import { useI18n } from "../i18n/context";

function DashboardPage() {
  const { user, can } = useAuth();
  const canReadUsers = can("users:read");
  const { t, roleName } = useI18n();
  const users = useUsers();

  return (
    <>
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.title")}
        description={
          canReadUsers
            ? t("dashboard.adminDescription")
            : t("dashboard.memberDescription", { name: user?.username ?? "" })
        }
      />

      {canReadUsers ? (
        <UserStats state={users.state} />
      ) : (
        user && (
          <section className="ah-stats" aria-label={t("dashboard.yourAccount")}>
            <StatCard
              label={t("dashboard.signedInAs")}
              icon="userCheck"
              value={user.username}
            />
            <StatCard
              label={t("dashboard.role")}
              icon="shield"
              tone="violet"
              value={roleName(user.role)}
              detail={t("dashboard.roleDetail")}
            />
            <StatCard
              label={t("dashboard.userId")}
              icon="fileText"
              tone="green"
              value={`#${user.id}`}
            />
          </section>
        )
      )}

      <div className="ah-dashboard-grid">
        <UsersPanel users={users} />
        <ActivityPanel />
      </div>
    </>
  );
}

export default DashboardPage;
