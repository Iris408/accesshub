import { useI18n } from "../../i18n/context";
import Icon, { type IconName } from "../ui/Icon";

const ROLES: ReadonlyArray<{ role: "admin" | "manager" | "viewer"; icon: IconName }> = [
  { role: "admin", icon: "shieldCheck" },
  { role: "manager", icon: "users" },
  { role: "viewer", icon: "search" },
];

/**
 * Decorative: the Admin, Manager and Viewer / Auditor roles as a compact
 * strip, shown under the sign-in form on small screens instead of the wide
 * illustration.
 * The cards take turns to highlight on the same slow loop as the illustration
 * (public.css); with reduced motion they stay still. Hidden from assistive
 * technology, like the illustration it stands in for.
 */
function RoleStrip() {
  const { roleName } = useI18n();

  return (
    <ol className="ah-rolestrip" aria-hidden="true">
      {ROLES.map(({ role, icon }, index) => (
        <li key={role} className={`ah-rolestrip__card ah-rolestrip__card--${index + 1}`}>
          <span className="ah-rolestrip__icon">
            <Icon name={icon} size={20} />
          </span>
          <span className="ah-rolestrip__label">{roleName(role)}</span>
        </li>
      ))}
    </ol>
  );
}

export default RoleStrip;
