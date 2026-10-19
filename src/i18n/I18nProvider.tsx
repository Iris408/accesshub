import { useCallback, useMemo, useState, type ReactNode } from "react";

import { I18nContext } from "./context";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";
import { createTranslator } from "./translate";

const LANGUAGE_KEY = "accesshub.language";

function readStoredLocale(): Locale {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

type I18nProviderProps = {
  children: ReactNode;
};

function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);

    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // Preference only; the language still changes for this visit.
    }
  }, []);

  const value = useMemo(
    () => ({ ...createTranslator(locale), setLocale }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export default I18nProvider;
