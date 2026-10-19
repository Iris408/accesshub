import { ApiError } from "../../api/client";
import type { Translator } from "../../i18n/translate";

/** Shown inside the dialog that made the request. */
export type MutationFailure = {
  message: string;
  /** Set when the error belongs to a specific form field. */
  field?: "username";
};

/** Resolves to null on success, or the error to show. */
export type MutationResult = Promise<MutationFailure | null>;

export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;

/**
 * Turns an API failure into translated copy. 401 is handled before this (it
 * ends the session); the API's own `detail` is included where it adds
 * information, untranslated, as it is server data.
 */
export function describeMutationError(
  error: unknown,
  t: Translator["t"]
): MutationFailure {
  if (!(error instanceof ApiError)) return { message: t("mutation.server") };

  switch (error.kind) {
    case "forbidden":
      return { message: t("mutation.denied") };
    case "conflict":
      return { message: t("mutation.conflict", { detail: error.message }) };
    case "invalid":
      return error.message === "Username already exists"
        ? { field: "username", message: t("userForm.usernameTaken") }
        : { message: t("mutation.invalid", { detail: error.message }) };
    case "notFound":
      return { message: t("mutation.notFound") };
    case "network":
      return { message: t("mutation.network") };
    default:
      return { message: t("mutation.server") };
  }
}
