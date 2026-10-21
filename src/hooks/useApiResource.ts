import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

import { ApiError, isAbortError } from "../api/client";
import { useAuth, type FailureReason } from "../auth/context";

export type ResourceState<T> =
  | { status: "loading" }
  /** `refreshing`: newer data is loading while this is shown. */
  | { status: "ready"; data: T; refreshing: boolean }
  /** `detail` is the API's own message and is shown untranslated. */
  | { status: "forbidden"; detail: string }
  | { status: "error"; reason: FailureReason };

type Settled<T> = Exclude<ResourceState<T>, { status: "loading" }>;

/**
 * Loads `load(token, signal)` whenever `key` changes (or `reload` is called).
 * 401 ends the session; while a new key loads, the previous data stays
 * visible. `key` must change whenever the loader's inputs change.
 */
export function useApiResource<T>(
  key: string,
  load: (token: string, signal: AbortSignal) => Promise<T>
): { state: ResourceState<T>; reload: () => void } {
  const { token, signOut, refreshProfile } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [entry, setEntry] = useState<{ key: string; state: Settled<T> } | null>(null);

  const requestKey = `${key}#${attempt}`;

  // The latest loader, updated before the fetch effect below runs.
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });

  const settle = useEffectEvent((forKey: string, outcome: { data: T } | { error: unknown }) => {
    if ("data" in outcome) {
      setEntry({ key: forKey, state: { status: "ready", data: outcome.data, refreshing: false } });
      return;
    }

    const { error } = outcome;
    if (isAbortError(error)) return;

    if (error instanceof ApiError && error.kind === "unauthorized") {
      signOut();
      return;
    }

    // A 403 can mean the role policy changed: update permissions (and with
    // them the navigation) right away.
    if (error instanceof ApiError && error.kind === "forbidden") refreshProfile();

    setEntry({
      key: forKey,
      state:
        error instanceof ApiError && error.kind === "forbidden"
          ? { status: "forbidden", detail: error.message }
          : {
              status: "error",
              reason: error instanceof ApiError && error.kind === "network" ? "network" : "server",
            },
    });
  });

  useEffect(() => {
    const controller = new AbortController();

    loadRef.current(token, controller.signal).then(
      (data) => settle(requestKey, { data }),
      (error: unknown) => settle(requestKey, { error })
    );

    return () => controller.abort();
  }, [token, requestKey]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  let state: ResourceState<T>;

  if (!entry) {
    state = { status: "loading" };
  } else if (entry.key === requestKey) {
    state = entry.state;
  } else if (entry.state.status === "ready") {
    state = { ...entry.state, refreshing: true };
  } else {
    state = { status: "loading" };
  }

  return { state, reload };
}
