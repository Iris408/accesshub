import { createElement, Fragment, type ReactNode } from "react";

import { normalizeRole } from "../auth/roles";
import { MESSAGES, type Locale } from "./locales";
import type { MessageKey } from "./messages/en";

export type TranslateParams = Record<string, string | number>;

/** Base names of keys that have `_one` / `_other` plural forms. */
export type PluralKey = {
  [K in MessageKey]: K extends `${infer Base}_other` ? Base : never;
}[MessageKey];

const PLACEHOLDER = /\{(\w+)\}/g;

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;

  return template.replace(PLACEHOLDER, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

export type Translator = ReturnType<typeof createTranslator>;

export function createTranslator(locale: Locale) {
  const messages = MESSAGES[locale];
  const pluralRules = new Intl.PluralRules(locale);
  const numberFormat = new Intl.NumberFormat(locale);
  const percentFormat = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const listFormat = new Intl.ListFormat(locale, { type: "conjunction" });

  function t(key: MessageKey, params?: TranslateParams): string {
    return interpolate(messages[key], params);
  }

  /** Picks the `_one` / `_other` form for `count` using the locale's rules. */
  function tp(key: PluralKey, count: number, params?: TranslateParams): string {
    const form = pluralRules.select(count) === "one" ? "one" : "other";
    return t(`${key}_${form}`, params);
  }

  /** Like `t`, but placeholders may be React nodes (e.g. <strong>). */
  function tx(key: MessageKey, params: Record<string, ReactNode>): ReactNode {
    return messages[key].split(/(\{\w+\})/).map((part, index) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      return name && name in params
        ? createElement(Fragment, { key: index }, params[name])
        : part;
    });
  }

  /** Translated role name; legacy values are normalised like the API does. */
  function roleName(role?: string): string {
    return t(`role.${normalizeRole(role)}`);
  }

  return {
    locale,
    t,
    tp,
    tx,
    roleName,
    formatNumber: (value: number) => numberFormat.format(value),
    formatPercent: (ratio: number) => percentFormat.format(ratio),
    formatTime: (date: Date) => timeFormat.format(date),
    formatList: (items: string[]) => listFormat.format(items),
  };
}
