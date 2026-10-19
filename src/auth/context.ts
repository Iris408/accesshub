import { createContext, useContext } from "react";

import type { Profile } from "../api/client";
import type { Permission } from "./permissions";

/** Why a request failed; the UI turns this into translated copy. */
export type FailureReason = "network" | "server";

export type ProfileState =
  | { status: "loading" }
  | { status: "ready"; user: Profile }
  /** `detail` is the API's own message and is shown untranslated. */
  | { status: "forbidden"; detail: string }
  | { status: "error"; reason: FailureReason };

export type AuthContextValue = {
  token: string;
  profile: ProfileState;
  user: Profile | null;
  /**
   * Whether the signed-in user has a permission. Used to shape the UI; the
   * API enforces every permission itself.
   */
  can: (permission: Permission) => boolean;
  retryProfile: () => void;
  /** Re-fetches the profile in the background (no loading state). */
  refreshProfile: () => void;
  /** Clears the stored token and returns to the login page. */
  signOut: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return value;
}
