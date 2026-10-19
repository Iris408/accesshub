import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { ApiError, fetchProfile, isAbortError } from "../api/client";
import { AuthContext, type ProfileState } from "./context";
import { permissionsFor, type Permission } from "./permissions";
import { clearToken, getToken } from "./session";

function profileErrorState(error: unknown): ProfileState {
  if (error instanceof ApiError && error.kind === "forbidden") {
    return { status: "forbidden", detail: error.message };
  }

  return {
    status: "error",
    reason: error instanceof ApiError && error.kind === "network" ? "network" : "server",
  };
}

type AuthProviderProps = {
  children: ReactNode;
};

function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const [token] = useState(getToken);
  const [profile, setProfile] = useState<ProfileState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const signOut = useCallback(() => {
    clearToken();
    navigate("/", { replace: true });
  }, [navigate]);

  const handleProfileError = useEffectEvent((error: unknown) => {
    if (isAbortError(error)) return;

    // Only an explicit 401 means the token is no longer valid. Network errors,
    // 5xx and 403 keep the session so the user can retry.
    if (error instanceof ApiError && error.kind === "unauthorized") {
      signOut();
      return;
    }

    setProfile(profileErrorState(error));
  });

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    fetchProfile(token, controller.signal).then(
      (user) => setProfile({ status: "ready", user }),
      handleProfileError
    );

    return () => controller.abort();
  }, [token, attempt]);

  const retryProfile = useCallback(() => {
    setProfile({ status: "loading" });
    setAttempt((current) => current + 1);
  }, []);

  // Keeps the current screen while updating the profile, e.g. after an admin
  // renames themselves or sets a new password. Failures other than an expired
  // session leave the existing profile in place.
  const refreshProfile = useCallback(() => {
    if (!token) return;

    fetchProfile(token).then(
      (user) => setProfile({ status: "ready", user }),
      (error: unknown) => {
        if (error instanceof ApiError && error.kind === "unauthorized") signOut();
      }
    );
  }, [token, signOut]);

  const value = useMemo(() => {
    const user = profile.status === "ready" ? profile.user : null;
    const permissions = permissionsFor(user);

    return {
      token: token ?? "",
      profile,
      user,
      can: (permission: Permission) => permissions.has(permission),
      retryProfile,
      refreshProfile,
      signOut,
    };
  }, [token, profile, retryProfile, refreshProfile, signOut]);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
