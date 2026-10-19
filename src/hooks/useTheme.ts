import { useCallback, useState } from "react";

import { useMediaQuery } from "./useMediaQuery";

export type Theme = "light" | "dark";

const THEME_KEY = "accesshub.theme";

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Follows the system colour scheme until the user picks a theme, then
 * remembers that choice between visits.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [storedTheme, setStoredTheme] = useState(readStoredTheme);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const theme: Theme = storedTheme ?? (prefersDark ? "dark" : "light");

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setStoredTheme(next);

    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Preference only; the toggle still works for this visit.
    }
  }, [theme]);

  return { theme, toggleTheme };
}
