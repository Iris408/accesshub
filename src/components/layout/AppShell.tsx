import { useCallback, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Outlet } from "react-router-dom";

import { useAuth } from "../../auth/context";
import { isDemoSession } from "../../auth/session";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useTheme } from "../../hooks/useTheme";
import { useI18n } from "../../i18n/context";
import ChangePasswordForm from "../auth/ChangePasswordForm";
import Icon from "../ui/Icon";
import StateMessage from "../ui/StateMessage";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const COLLAPSED_KEY = "accesshub.sidebarCollapsed";

// Keep in sync with the breakpoints in dashboard.css.
const MIN_TABLET = "(min-width: 768px)";
const MIN_DESKTOP = "(min-width: 1024px)";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function ProfileGate() {
  const { profile, retryProfile, signOut } = useAuth();
  const { t } = useI18n();

  switch (profile.status) {
    case "loading":
      return (
        <div className="ah-page-loading" aria-busy="true">
          <p className="ah-sr-only" role="status">
            {t("profile.loading")}
          </p>
          <span className="ah-skeleton ah-skeleton--heading" />
          <span className="ah-skeleton ah-skeleton--text" />
          <div className="ah-stats">
            {Array.from({ length: 4 }, (_, index) => (
              <span key={index} className="ah-skeleton ah-skeleton--card" />
            ))}
          </div>
        </div>
      );

    case "error":
      return (
        <StateMessage
          icon="alert"
          tone="danger"
          title={t("profile.errorTitle")}
          role="alert"
          action={
            <button type="button" className="ah-btn ah-btn--primary" onClick={retryProfile}>
              <Icon name="refresh" size={16} />
              {t("common.tryAgain")}
            </button>
          }
        >
          {profile.reason === "network"
            ? t("profile.errorNetwork")
            : t("profile.errorServer")}{" "}
          {t("profile.stillSignedIn")}
        </StateMessage>
      );

    case "forbidden":
      return (
        <StateMessage
          icon="lock"
          tone="warning"
          title={t("profile.deniedTitle")}
          role="alert"
          action={
            <button type="button" className="ah-btn ah-btn--secondary" onClick={signOut}>
              {t("profile.switchAccount")}
            </button>
          }
        >
          {t("profile.deniedBody", { detail: profile.detail })}
        </StateMessage>
      );

    case "ready":
      return profile.user.must_change_password ? <ChangePasswordForm /> : <Outlet />;
  }
}

/** Authenticated layout: sidebar, top bar and the routed page. */
function AppShell() {
  const { locale, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [demo] = useState(isDemoSession);
  const [drawerRequested, setDrawerRequested] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarId = useId();

  const isTabletUp = useMediaQuery(MIN_TABLET);
  const isDesktop = useMediaQuery(MIN_DESKTOP);

  // Phones get an off-canvas drawer, tablets an icon rail, and desktops a
  // sidebar the user can collapse into the rail.
  const mobileOpen = drawerRequested && !isTabletUp;
  const rail = isTabletUp && (!isDesktop || collapsed);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);

    try {
      localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {
      // Preference only; ignore storage failures.
    }
  }

  const closeDrawer = useCallback(() => {
    // Commit synchronously so the main column is no longer inert when focus
    // returns to the menu button.
    flushSync(() => setDrawerRequested(false));
    menuButtonRef.current?.focus();
  }, []);

  // Move focus into the drawer and let Escape close it.
  useEffect(() => {
    if (!mobileOpen) return;

    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDrawer();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, closeDrawer]);

  const shellClass = [
    "ah",
    rail && "ah--rail",
    mobileOpen && "ah--drawer-open",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass} data-theme={theme} lang={locale}>
      <a href="#main" className="ah-skip-link">
        {t("shell.skipToContent")}
      </a>

      <Sidebar
        id={sidebarId}
        closeButtonRef={closeButtonRef}
        onNavigate={() => {
          if (mobileOpen) closeDrawer();
          else setDrawerRequested(false);
        }}
        onClose={closeDrawer}
      />

      {mobileOpen && <div className="ah-backdrop" onClick={closeDrawer} />}

      <div className="ah-main-col" inert={mobileOpen}>
        <Topbar
          sidebarId={sidebarId}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          menuButtonRef={menuButtonRef}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenMenu={() => setDrawerRequested(true)}
          onToggleCollapsed={toggleCollapsed}
        />

        {demo && (
          <p className="ah-demo-banner" role="note">
            <Icon name="alert" size={18} className="ah-demo-banner__icon" />
            {t("demo.banner")}
          </p>
        )}

        <main id="main" className="ah-main" tabIndex={-1}>
          <ProfileGate />
        </main>
      </div>
    </div>
  );
}

export default AppShell;
