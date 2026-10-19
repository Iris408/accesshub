import en, { type Messages } from "./messages/en";
import es from "./messages/es";
import fr from "./messages/fr";
import ja from "./messages/ja";
import ko from "./messages/ko";
import zhCN from "./messages/zh-CN";

/** Flags are emoji text (no image assets) and are always shown with the name. */
export const LOCALES = [
  { code: "en", name: "English", flag: "🇬🇧", short: "EN" },
  { code: "ja", name: "日本語", flag: "🇯🇵", short: "JA" },
  { code: "ko", name: "한국어", flag: "🇰🇷", short: "KO" },
  { code: "fr", name: "Français", flag: "🇫🇷", short: "FR" },
  { code: "es", name: "Español", flag: "🇪🇸", short: "ES" },
  { code: "zh-CN", name: "简体中文", flag: "🇨🇳", short: "中文" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export type LocaleInfo = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const MESSAGES: Record<Locale, Messages> = {
  en,
  ja,
  ko,
  fr,
  es,
  "zh-CN": zhCN,
};

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale.code === value);
}
