import { describe, expect, it } from "vitest";

import { LOCALES, MESSAGES } from "./locales";
import type { MessageKey } from "./messages/en";
import { createTranslator, dayKeyIn, startOfDayIn, supportedTimeZone } from "./translate";

const english = MESSAGES.en;
const keys = Object.keys(english).sort() as MessageKey[];

function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe.each(LOCALES.map((locale) => locale.code))("%s messages", (code) => {
  const messages = MESSAGES[code];

  it("defines exactly the English keys", () => {
    expect(Object.keys(messages).sort()).toEqual(keys);
  });

  it("keeps every placeholder and leaves no string empty", () => {
    for (const key of keys) {
      expect(messages[key].trim(), key).not.toBe("");
      expect(placeholders(messages[key]), key).toEqual(placeholders(english[key]));
    }
  });
});

describe("createTranslator", () => {
  it("interpolates parameters and picks plural forms per locale", () => {
    const en = createTranslator("en");
    expect(en.tp("table.summary", 1, { start: 1, end: 1, total: 1 })).toBe(
      "Showing 1–1 of 1 user"
    );
    expect(en.tp("table.summary", 2, { start: 1, end: 2, total: 2 })).toBe(
      "Showing 1–2 of 2 users"
    );

    // French treats 0 as singular.
    expect(createTranslator("fr").tp("table.summaryNone", 0, { total: 0 })).toBe(
      "0 sur 0 utilisateur"
    );
  });

  it("translates the four roles and maps legacy values like the API", () => {
    const ja = createTranslator("ja");
    expect(ja.roleName("Admin")).toBe("管理者");
    expect(ja.roleName("manager")).toBe("マネージャー");
    expect(ja.roleName("user")).toBe("メンバー");
    expect(ja.roleName("auditor")).toBe("閲覧者／監査担当");
    expect(ja.roleName("something-unknown")).toBe("メンバー");
  });
});

describe("organisation timezone", () => {
  it("formats dates and times in the organisation's timezone", () => {
    const instant = new Date("2026-10-20T15:30:00Z");

    expect(createTranslator("en", "Asia/Tokyo").formatDay(instant)).toBe("Wednesday, October 21, 2026");
    expect(createTranslator("en", "America/New_York").formatDay(instant)).toBe("Tuesday, October 20, 2026");
    expect(createTranslator("en", "Asia/Tokyo").formatTime(instant)).toBe("12:30 AM");
    expect(createTranslator("en", "Asia/Tokyo").timeZone).toBe("Asia/Tokyo");
  });

  it("falls back to the viewer's own timezone for an unknown zone", () => {
    expect(createTranslator("en", "Mars/Olympus_Mons").timeZone).toBeUndefined();
    expect(supportedTimeZone(null)).toBeUndefined();
    expect(supportedTimeZone("Europe/London")).toBe("Europe/London");
  });

  it("groups by calendar day in the timezone", () => {
    const instant = new Date("2026-10-20T15:30:00Z");

    expect(dayKeyIn(instant, "Asia/Tokyo")).toBe("2026-10-21");
    expect(dayKeyIn(instant, "UTC")).toBe("2026-10-20");
  });

  it("finds when a day starts in the timezone, across daylight-saving changes", () => {
    expect(startOfDayIn("2026-10-20", 0, "Asia/Tokyo")).toBe("2026-10-19T15:00:00.000Z");
    expect(startOfDayIn("2026-10-20", 1, "UTC")).toBe("2026-10-21T00:00:00.000Z");
    // New York: summer time (UTC−4) ends on 1 November 2026.
    expect(startOfDayIn("2026-10-31", 0, "America/New_York")).toBe("2026-10-31T04:00:00.000Z");
    expect(startOfDayIn("2026-11-01", 1, "America/New_York")).toBe("2026-11-02T05:00:00.000Z");
    // London: the clocks go forward at 01:00 on 29 March 2026.
    expect(startOfDayIn("2026-03-29", 0, "Europe/London")).toBe("2026-03-29T00:00:00.000Z");
    expect(startOfDayIn("2026-03-30", 0, "Europe/London")).toBe("2026-03-29T23:00:00.000Z");
  });
});
