import { describe, expect, it } from "vitest";

import { LOCALES, MESSAGES } from "./locales";
import type { MessageKey } from "./messages/en";
import { createTranslator } from "./translate";

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
