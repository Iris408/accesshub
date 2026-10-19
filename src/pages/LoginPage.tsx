import { useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, login, startDemoSession } from "../api/client";
import { demoApiUrl } from "../api/config";
import { setToken } from "../auth/session";
import LanguageMenu from "../components/layout/LanguageMenu";
import AccessIllustration from "../components/public/AccessIllustration";
import { PROJECT_LINKS } from "../components/public/projectLinks";
import ThemeSwitch from "../components/public/ThemeSwitch";
import Icon from "../components/ui/Icon";
import { useTheme } from "../hooks/useTheme";
import { useI18n } from "../i18n/context";
import type { Translator } from "../i18n/translate";

type FieldErrors = { username?: string; password?: string };

/** Translates the API's known sign-in failures; other details are shown as sent. */
function loginErrorMessage(error: unknown, t: Translator["t"]): string {
  if (!(error instanceof ApiError)) return t("login.network");

  switch (error.message) {
    case "Invalid username or password":
      return t("login.invalid");
    case "Account is deactivated":
      return t("login.deactivated");
    case "No access token returned from backend":
      return t("login.noToken");
  }

  return error.kind === "network"
    ? t("login.network")
    : t("login.failed", { detail: error.message });
}

function BrandMark() {
  return (
    <svg className="ah-public__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M13.2 4h5.6L30 28h-6.4L16 11.2 8.4 28H2z" />
      <path className="ah-public__mark-accent" d="M2 28 13.2 4H16L6.2 28z" />
    </svg>
  );
}

function LoginPage() {
  const { t, locale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const ids = useId();

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Only offered when an isolated demo API is configured (never production).
  const demoAvailable = demoApiUrl() !== null;

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const found: FieldErrors = {};
    if (!username.trim()) found.username = t("login.usernameRequired");
    if (!password) found.password = t("login.passwordRequired");

    setErrors(found);
    setFormError("");

    if (found.username || found.password) {
      (found.username ? usernameRef : passwordRef).current?.focus();
      return;
    }

    setSubmitting(true);

    try {
      setToken(await login(username, password));
      navigate("/dashboard");
    } catch (error) {
      setSubmitting(false);
      setFormError(loginErrorMessage(error, t));
    }
  }

  async function openDemo() {
    if (submitting) return;

    setErrors({});
    setFormError("");
    setSubmitting(true);

    try {
      setToken(await startDemoSession(), "demo");
      navigate("/dashboard");
    } catch (error) {
      setSubmitting(false);
      setFormError(
        error instanceof ApiError && error.kind === "network"
          ? t("login.network")
          : t("login.demoUnavailable")
      );
    }
  }

  function fieldProps(field: keyof FieldErrors) {
    const error = errors[field];
    return {
      id: `${ids}-${field}`,
      "aria-invalid": Boolean(error),
      "aria-describedby": error ? `${ids}-${field}-error` : undefined,
    };
  }

  return (
    <div className="ah ah-public" data-theme={theme} lang={locale}>
      <title>{`${t("login.title")} · AccessHub`}</title>

      <header className="ah-public__header">
        <span className="ah-public__brand">
          <BrandMark />
          AccessHub
        </span>

        <div className="ah-public__controls">
          <LanguageMenu />
          <span className="ah-public__divider" aria-hidden="true" />
          <ThemeSwitch theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main className="ah-public__main">
        <section className="ah-public__intro">
          <h1 className="ah-public__heading">{t("login.heading")}</h1>
          <p className="ah-public__subheading">{t("login.subheading")}</p>
        </section>

        <div className="ah-public__art">
          <AccessIllustration />
        </div>

        <section className="ah-signin" aria-labelledby={`${ids}-title`}>
          <h2 id={`${ids}-title`} className="ah-signin__title">
            {t("login.title")}
          </h2>

          {formError && (
            <p className="ah-form-error" role="alert">
              {formError}
            </p>
          )}

          <form className="ah-signin__form" noValidate onSubmit={signIn}>
            <div className="ah-form-field">
              <label htmlFor={`${ids}-username`} className="ah-signin__label">
                {t("login.username")}
              </label>
              <div className="ah-input-wrap">
                <Icon name="user" size={18} className="ah-input-wrap__icon" />
                <input
                  ref={usernameRef}
                  {...fieldProps("username")}
                  className="ah-input ah-signin__input"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
              {errors.username && (
                <span id={`${ids}-username-error`} className="ah-field__error">
                  {errors.username}
                </span>
              )}
            </div>

            <div className="ah-form-field">
              <label htmlFor={`${ids}-password`} className="ah-signin__label">
                {t("login.password")}
              </label>
              <div className="ah-input-wrap">
                <Icon name="lock" size={18} className="ah-input-wrap__icon" />
                <input
                  ref={passwordRef}
                  {...fieldProps("password")}
                  className="ah-input ah-signin__input"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {errors.password && (
                <span id={`${ids}-password-error`} className="ah-field__error">
                  {errors.password}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="ah-btn ah-btn--primary ah-signin__submit"
              disabled={submitting}
            >
              {submitting ? t("login.submitting") : t("login.submit")}
            </button>

            {demoAvailable && (
              <button
                type="button"
                className="ah-btn ah-signin__demo"
                onClick={openDemo}
                disabled={submitting}
                aria-describedby={`${ids}-demo-note`}
              >
                {t("login.useDemo")}
              </button>
            )}
            {demoAvailable && (
              <p id={`${ids}-demo-note`} className="ah-signin__demo-note">
                {t("login.demoNote")}
              </p>
            )}
          </form>
        </section>
      </main>

      <footer className="ah-public__footer">
        <span className="ah-public__footer-brand">AccessHub</span>
        <nav aria-label={t("footer.label")}>
          <ul className="ah-public__links">
            {PROJECT_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {t(link.label)}
                  <Icon name="external" size={13} className="ah-public__external" />
                  <span className="ah-sr-only"> {t("footer.newTab")}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </footer>
    </div>
  );
}

export default LoginPage;
