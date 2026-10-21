import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, fetchOrganisation, isAbortError, type OrganisationSummary } from "../api/client";
import { useAuth } from "../auth/context";
import { useI18n } from "../i18n/context";
import { DEFAULT_ORGANISATION, OrganisationContext } from "./context";

/**
 * Loads the organisation settings everyone's interface uses (name, timezone,
 * access request policy) for the signed-in user. They are re-read whenever
 * the profile is (on navigation, window focus and after a 403), so an Admin's
 * changes reach other sessions without a reload. The API enforces them.
 */
function OrganisationProvider({ children }: { children: ReactNode }) {
  const { token, profile, signOut } = useAuth();
  const { setTimeZone } = useI18n();
  const [organisation, setOrganisation] = useState<OrganisationSummary | null>(null);
  const [attempt, setAttempt] = useState(0);

  // A new object each time the profile is (re)loaded; null until it's usable.
  const user = profile.status === "ready" && !profile.user.must_change_password ? profile.user : null;

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();

    fetchOrganisation(token, controller.signal).then(setOrganisation, (error: unknown) => {
      if (isAbortError(error)) return;
      if (error instanceof ApiError && error.kind === "unauthorized") signOut();
      // Otherwise keep what we have; the defaults match the API's.
    });

    return () => controller.abort();
  }, [token, user, attempt, signOut]);

  const timeZone = organisation?.timezone ?? null;
  useEffect(() => {
    setTimeZone(timeZone);
  }, [timeZone, setTimeZone]);

  // Signing out leaves the organisation's timezone behind.
  useEffect(() => () => setTimeZone(null), [setTimeZone]);

  const refreshOrganisation = useCallback(() => setAttempt((current) => current + 1), []);

  const value = useMemo(
    () => ({ organisation: organisation ?? DEFAULT_ORGANISATION, refreshOrganisation }),
    [organisation, refreshOrganisation]
  );

  return <OrganisationContext.Provider value={value}>{children}</OrganisationContext.Provider>;
}

export default OrganisationProvider;
