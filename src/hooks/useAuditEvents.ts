import { useCallback, useEffect, useEffectEvent, useState } from "react";

import {
  ApiError,
  fetchAuditEvents,
  isAbortError,
  type AuditPage,
  type AuditQuery,
} from "../api/client";
import { useAuth, type FailureReason } from "../auth/context";

export type AuditState =
  | { status: "loading" }
  /** `refreshing`: a new page/filter is loading while this one is shown. */
  | { status: "ready"; page: AuditPage; refreshing: boolean }
  /** `detail` is the API's own message and is shown untranslated. */
  | { status: "forbidden"; detail: string }
  | { status: "error"; reason: FailureReason };

type Settled = Exclude<AuditState, { status: "loading" }>;

/**
 * Loads GET /audit-events for `query`. 401 ends the session. While a new
 * query loads, the previous page stays visible (`refreshing`).
 */
export function useAuditEvents(query: AuditQuery): {
  state: AuditState;
  retry: () => void;
} {
  const { token, signOut } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [entry, setEntry] = useState<{ key: string; state: Settled } | null>(null);

  const key = JSON.stringify([query, attempt]);

  const handleError = useEffectEvent((error: unknown, requestKey: string) => {
    if (isAbortError(error)) return;

    if (error instanceof ApiError && error.kind === "unauthorized") {
      signOut();
      return;
    }

    setEntry({
      key: requestKey,
      state:
        error instanceof ApiError && error.kind === "forbidden"
          ? { status: "forbidden", detail: error.message }
          : {
              status: "error",
              reason:
                error instanceof ApiError && error.kind === "network" ? "network" : "server",
            },
    });
  });

  useEffect(() => {
    const controller = new AbortController();
    const requestKey = JSON.stringify([query, attempt]);

    fetchAuditEvents(token, query, controller.signal).then(
      (page) =>
        setEntry({ key: requestKey, state: { status: "ready", page, refreshing: false } }),
      (error: unknown) => handleError(error, requestKey)
    );

    return () => controller.abort();
  }, [token, query, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  let state: AuditState;

  if (!entry) {
    state = { status: "loading" };
  } else if (entry.key === key) {
    state = entry.state;
  } else if (entry.state.status === "ready") {
    state = { ...entry.state, refreshing: true };
  } else {
    state = { status: "loading" };
  }

  return { state, retry };
}
