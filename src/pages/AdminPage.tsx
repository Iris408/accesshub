import { useSearchParams } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import UserStats from "../components/users/UserStats";
import UsersPanel from "../components/users/UsersPanel";
import { useUsers } from "../hooks/useUsers";
import { useI18n } from "../i18n/context";

/** The "Users" screen, kept on the existing /admin route. */
function AdminPage() {
  const { t } = useI18n();
  const users = useUsers();
  const [searchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";

  return (
    <>
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("usersPage.title")}
        description={t("usersPage.description")}
      />

      <UserStats state={users.state} />

      {/* Re-key so a new top-bar search resets the table's filters. */}
      <UsersPanel
        key={search}
        users={users}
        initialSearch={search}
        defaultPageSize={25}
      />
    </>
  );
}

export default AdminPage;
