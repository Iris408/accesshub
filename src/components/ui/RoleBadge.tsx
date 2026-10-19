import { isAdminRole } from "../../auth/roles";
import { useI18n } from "../../i18n/context";

type RoleBadgeProps = {
  role?: string;
};

function RoleBadge({ role }: RoleBadgeProps) {
  const { roleName } = useI18n();
  const variant = isAdminRole(role) ? "admin" : "default";

  return <span className={`ah-badge ah-badge--${variant}`}>{roleName(role)}</span>;
}

export default RoleBadge;
