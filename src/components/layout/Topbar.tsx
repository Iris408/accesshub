import { useId, type FormEvent, type Ref } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/context";
import type { Theme } from "../../hooks/useTheme";
import { useI18n } from "../../i18n/context";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import LanguageMenu from "./LanguageMenu";

type TopbarProps = {
  sidebarId: string;
  collapsed: boolean;
  mobileOpen: boolean;
  menuButtonRef: Ref<HTMLButtonElement>;
  theme: Theme;
  onOpenMenu: () => void;
  onToggleCollapsed: () => void;
  onToggleTheme: () => void;
};

function Topbar({
  sidebarId,
  collapsed,
  mobileOpen,
  menuButtonRef,
  theme,
  onOpenMenu,
  onToggleCollapsed,
  onToggleTheme,
}: TopbarProps) {
  const { user, can } = useAuth();
  const { t, roleName } = useI18n();
  const navigate = useNavigate();
  const searchId = useId();

  const themeLabel =
    theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark");

  function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = String(new FormData(event.currentTarget).get("search") ?? "").trim();
    navigate(term ? `/admin?search=${encodeURIComponent(term)}` : "/admin");
  }

  return (
    <header className="ah-topbar">
      <button
        ref={menuButtonRef}
        type="button"
        className="ah-icon-btn ah-topbar__menu"
        onClick={onOpenMenu}
        aria-controls={sidebarId}
        aria-expanded={mobileOpen}
        aria-label={t("shell.openNav")}
      >
        <Icon name="menu" />
      </button>

      <button
        type="button"
        className="ah-icon-btn ah-topbar__collapse"
        onClick={onToggleCollapsed}
        aria-controls={sidebarId}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
      >
        <Icon name="panel" />
      </button>

      {can("users:read") && (
        <form role="search" className="ah-global-search" onSubmit={searchUsers}>
          <label htmlFor={searchId} className="ah-sr-only">
            {t("shell.searchUsers")}
          </label>
          <Icon name="search" size={18} className="ah-input-wrap__icon" />
          <input
            id={searchId}
            name="search"
            type="search"
            className="ah-input"
            placeholder={t("shell.searchPlaceholder")}
            autoComplete="off"
          />
        </form>
      )}

      <div className="ah-topbar__controls">
        <LanguageMenu />

        <button
          type="button"
          className="ah-icon-btn ah-theme-toggle"
          onClick={onToggleTheme}
          aria-label={themeLabel}
          title={themeLabel}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
      </div>

      <div className="ah-profile">
        {user ? (
          <>
            <Avatar name={user.username} size="md" />
            <span className="ah-profile__text">
              <span className="ah-profile__name">{user.username}</span>
              <span className="ah-profile__role">{roleName(user.role)}</span>
            </span>
          </>
        ) : (
          <span className="ah-skeleton ah-skeleton--avatar-md" />
        )}
      </div>
    </header>
  );
}

export default Topbar;
