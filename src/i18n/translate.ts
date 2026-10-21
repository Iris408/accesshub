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

/** `zone` if the browser knows it, otherwise undefined (the viewer's own). */
export function supportedTimeZone(zone?: string | null): string | undefined {
  if (!zone) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return undefined;
  }
}

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** The calendar date and time an instant shows in `timeZone` (or locally). */
function wallClock(instant: number, timeZone?: string): WallClock {
  if (!timeZone) {
    const date = new Date(instant);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

/** A calendar day ("yyyy-mm-dd") in `timeZone`, for grouping. */
export function dayKeyIn(date: Date, timeZone?: string): string {
  const { year, month, day } = wallClock(date.getTime(), timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The instant a calendar day ("yyyy-mm-dd", plus `addDays`) starts in
 * `timeZone` (or locally), as ISO 8601 — for date-range filters.
 */
export function startOfDayIn(date: string, addDays = 0, timeZone?: string): string {
  const [year, month, day] = date.split("-").map(Number);

  if (!timeZone) return new Date(year, month - 1, day + addDays).toISOString();

  // Midnight read as UTC, corrected by the zone's offset at that moment
  // (checked twice so a daylight-saving change between the two is handled).
  const asUtc = Date.UTC(year, month - 1, day + addDays);
  const offsetAt = (instant: number) => {
    const clock = wallClock(instant, timeZone);
    return (
      Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second) -
      Math.floor(instant / 1000) * 1000
    );
  };
  let instant = asUtc - offsetAt(asUtc);
  const corrected = offsetAt(instant);
  if (asUtc - corrected !== instant) instant = asUtc - corrected;
  return new Date(instant).toISOString();
}

/**
 * `timeZone` is the organisation's (Settings); without one, dates and times
 * use the viewer's own timezone.
 */
export function createTranslator(locale: Locale, requestedTimeZone?: string | null) {
  const timeZone = supportedTimeZone(requestedTimeZone);
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
    timeZone,
  });
  const listFormat = new Intl.ListFormat(locale, { type: "conjunction" });
  const dateTimeFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
  const dayFormat = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone });
  const fullDateTimeFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "long",
    timeZone,
  });

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
    formatDateTime: (date: Date) => dateTimeFormat.format(date),
    formatFullDateTime: (date: Date) => fullDateTimeFormat.format(date),
    /** A whole day, e.g. "Tuesday, October 20, 2026". */
    formatDay: (date: Date) => dayFormat.format(date),
    /** The organisation's timezone, or undefined for the viewer's own. */
    timeZone,
    /** The calendar day ("yyyy-mm-dd") a date falls on, for grouping. */
    dayKey: (date: Date) => dayKeyIn(date, timeZone),
    /** When a picked calendar day (yyyy-mm-dd) starts, as ISO 8601. */
    startOfDay: (date: string, addDays = 0) => startOfDayIn(date, addDays, timeZone),
  };
}
