import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

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

/**
 * Permissions can change while someone is signed in (an Admin edits the role
 * policy or their role). The profile is re-read when they move to another page
 * or return to the window, at most this often, so navigation and page access
 * follow without signing out. The API still checks every request.
 */
const PROFILE_REFRESH_MS = 5000;

type AuthProviderProps = {
  children: ReactNode;
};

function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const [token] = useState(getToken);
  const [profile, setProfile] = useState<ProfileState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const location = useLocation();
  // When the profile was last loaded successfully (0 = not loaded yet).
  const loadedAtRef = useRef(0);

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

    fetchProfile(token, controller.signal).then((user) => {
      loadedAtRef.current = Date.now();
      setProfile({ status: "ready", user });
    }, handleProfileError);

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
      (user) => {
        loadedAtRef.current = Date.now();
        setProfile({ status: "ready", user });
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.kind === "unauthorized") signOut();
      }
    );
  }, [token, signOut]);

  const refreshIfStale = useCallback(() => {
    if (loadedAtRef.current === 0) return;
    if (Date.now() - loadedAtRef.current < PROFILE_REFRESH_MS) return;
    loadedAtRef.current = Date.now();
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    refreshIfStale();
  }, [location.pathname, refreshIfStale]);

  useEffect(() => {
    window.addEventListener("focus", refreshIfStale);
    return () => window.removeEventListener("focus", refreshIfStale);
  }, [refreshIfStale]);

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
