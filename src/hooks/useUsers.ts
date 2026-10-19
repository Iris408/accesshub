import { useCallback, useEffect, useEffectEvent, useState } from "react";

import { ApiError, fetchUsers, isAbortError, type User } from "../api/client";
import { useAuth, type FailureReason } from "../auth/context";

export type UsersState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; users: User[]; loadedAt: Date }
  /** `detail` is the API's own message and is shown untranslated. */
  | { status: "forbidden"; detail: string }
  | { status: "error"; reason: FailureReason };

export type UsersResource = {
  state: UsersState;
  /** Shows the loading state, then reloads (Retry / Refresh buttons). */
  reload: () => void;
  /** Reloads in the background so the table keeps its filters and page. */
  refresh: () => Promise<void>;
};

/**
 * Loads GET /users for users with `users:read`. Others never send the request
 * (the profile's permissions are checked first), but the API's own 403 is
 * still handled.
 */
export function useUsers(): UsersResource {
  const { token, can, signOut } = useAuth();
  const canRead = can("users:read");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<UsersState>(() =>
    canRead ? { status: "loading" } : { status: "idle" }
  );

  const failureState = useCallback(
    (error: unknown): UsersState | null => {
      if (isAbortError(error)) return null;

      if (error instanceof ApiError && error.kind === "unauthorized") {
        signOut();
        return null;
      }

      if (error instanceof ApiError && error.kind === "forbidden") {
        return { status: "forbidden", detail: error.message };
      }

      return {
        status: "error",
        reason: error instanceof ApiError && error.kind === "network" ? "network" : "server",
      };
    },
    [signOut]
  );

  const handleError = useEffectEvent((error: unknown) => {
    const next = failureState(error);
    if (next) setState(next);
  });

  useEffect(() => {
    if (!canRead) return;

    const controller = new AbortController();

    fetchUsers(token, controller.signal).then(
      (users) => setState({ status: "ready", users, loadedAt: new Date() }),
      handleError
    );

    return () => controller.abort();
  }, [token, canRead, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const users = await fetchUsers(token);
      setState({ status: "ready", users, loadedAt: new Date() });
    } catch (error) {
      const next = failureState(error);
      if (next) setState(next);
    }
  }, [token, failureState]);

  return { state, reload, refresh };
}
