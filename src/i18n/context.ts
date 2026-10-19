import { createContext, useContext } from "react";

import type { Locale } from "./locales";
import type { Translator } from "./translate";

export type I18nContextValue = Translator & {
  setLocale: (locale: Locale) => void;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }

  return value;
}
