import type { Ref } from "react";
import { Link, NavLink } from "react-router-dom";

import { useAuth } from "../../auth/context";
import { useI18n } from "../../i18n/context";
import Icon, { type IconName } from "../ui/Icon";
import { MAIN_NAV, type NavItem } from "./navigation";

function navClass({ isActive }: { isActive: boolean }) {
  return `ah-nav__link${isActive ? " is-active" : ""}`;
}

type NavEntryProps = {
  to: string;
  icon: IconName;
  label: string;
  status?: NavItem["status"];
  locked?: boolean;
  onNavigate: () => void;
};

function NavEntry({ to, icon, label, status, locked, onNavigate }: NavEntryProps) {
  const { t } = useI18n();

  return (
    <li>
      <NavLink to={to} className={navClass} onClick={onNavigate}>
        <Icon name={icon} className="ah-nav__icon" />
        <span className="ah-nav__label">{label}</span>
        {status === "planned" && (
          <span className="ah-nav__tag">
            {t("shell.soon")}
            <span className="ah-sr-only"> {t("shell.notAvailableYet")}</span>
          </span>
        )}
        {locked && (
          <span className="ah-nav__lock">
            <Icon name="lock" size={14} />
            <span className="ah-sr-only"> {t("shell.adminsOnly")}</span>
          </span>
        )}
      </NavLink>
    </li>
  );
}

type SidebarProps = {
  id: string;
  closeButtonRef: Ref<HTMLButtonElement>;
  onNavigate: () => void;
  onClose: () => void;
};

function Sidebar({ id, closeButtonRef, onNavigate, onClose }: SidebarProps) {
  const { can, profile, signOut } = useAuth();
  const { t } = useI18n();

  return (
    <aside id={id} className="ah-sidebar" aria-label={t("shell.sidebar")}>
      <div className="ah-sidebar__brand">
        <Link to="/dashboard" className="ah-brand" onClick={onNavigate}>
          <span className="ah-brand__mark" aria-hidden="true">
            AH
          </span>
          <span className="ah-brand__word">
            Access<span>Hub</span>
          </span>
        </Link>

        <button
          ref={closeButtonRef}
          type="button"
          className="ah-icon-btn ah-sidebar__close"
          onClick={onClose}
          aria-label={t("shell.closeNav")}
        >
          <Icon name="close" />
        </button>
      </div>

      <nav className="ah-nav" aria-label={t("shell.mainNav")}>
        <ul>
          {MAIN_NAV.map((item) => (
            <NavEntry
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={t(`nav.${item.id}.label`)}
              status={item.status}
              locked={
                item.status === "admin" && profile.status === "ready" && !can("users:read")
              }
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>

      <div className="ah-sidebar__footer">
        <ul className="ah-nav">
          <NavEntry
            to="/help"
            icon="help"
            label={t("shell.help")}
            onNavigate={onNavigate}
          />
          <li>
            <button type="button" className="ah-nav__link" onClick={signOut}>
              <Icon name="logOut" className="ah-nav__icon" />
              <span className="ah-nav__label">{t("shell.signOut")}</span>
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}

export default Sidebar;
