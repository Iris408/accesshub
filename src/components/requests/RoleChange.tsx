import type { AccessRequest } from "../../api/client";
import { useI18n } from "../../i18n/context";
import Icon from "../ui/Icon";
import RoleBadge from "../ui/RoleBadge";
import { roleBeforeRequest } from "./requestLabels";

/** "Current role → requested role" for a request. */
function RoleChange({ request }: { request: AccessRequest }) {
  const { t } = useI18n();
  const from = roleBeforeRequest(request);

  return (
    <span className="ah-role-change">
      <RoleBadge role={from} />
      <Icon name="chevronRight" size={14} className="ah-role-change__arrow" />
      <span className="ah-sr-only">{t("requests.changesTo")}</span>
      <RoleBadge role={request.requested_role} />
    </span>
  );
}

export default RoleChange;
