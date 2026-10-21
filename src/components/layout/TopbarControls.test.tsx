import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import App from "../../App";
import { json, makeUsers, mockApi } from "../../test/mockApi";

const admin = { id: 4, username: "adminuser", role: "admin" };

function renderDashboard(profile = admin) {
  localStorage.setItem("token", "valid.jwt");
  mockApi({
    "GET /profile": () => json({ user: profile }),
    "GET /users": () => json(makeUsers(124)),
    "GET /activity": () => json({ events: [], total: 0, page: 1, page_size: 5 }),
  });
  window.history.pushState(null, "", "/dashboard");
  return render(<App />);
}

function shell() {
  return document.querySelector<HTMLElement>(".ah");
}

function stubSystemColorScheme(dark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: dark && query.includes("prefers-color-scheme: dark"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

describe("language menu", () => {
  it("defaults to English and lists every language with its flag and name", async () => {
    renderDashboard();

    const trigger = await screen.findByRole("button", { name: "Language: English" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);

    const menu = screen.getByRole("menu", { name: "Choose a language" });
    const items = within(menu).getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual([
      "🇬🇧English",
      "🇯🇵日本語",
      "🇰🇷한국어",
      "🇫🇷Français",
      "🇪🇸Español",
      "🇨🇳简体中文",
    ]);
    expect(items[0].getAttribute("aria-checked")).toBe("true");
  });

  it("translates the interface, leaves user data alone and remembers the choice", async () => {
    renderDashboard();
    await screen.findByText("Showing 1–10 of 124 users");

    fireEvent.click(screen.getByRole("button", { name: "Language: English" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "日本語" }));

    expect(screen.queryByRole("menu")).toBeNull();
    const trigger = screen.getByRole("button", { name: "言語: 日本語" });
    expect(document.activeElement).toBe(trigger);

    expect(screen.getByRole("heading", { level: 1, name: "アクセスの概要" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "ダッシュボード" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "サインアウト" })).toBeTruthy();
    expect(screen.getByLabelText("ロール")).toBeTruthy();
    expect(screen.getByText("124 人中 1–10 人を表示")).toBeTruthy();
    expect(await screen.findByText("アクティビティはまだありません")).toBeTruthy();

    // Usernames and IDs come from the API and are never translated.
    expect(screen.getByRole("cell", { name: /user001/ })).toBeTruthy();
    expect(screen.getByText("adminuser")).toBeTruthy();

    expect(shell()?.getAttribute("lang")).toBe("ja");
    expect(localStorage.getItem("accesshub.language")).toBe("ja");
  });

  it("restores a saved language on the next visit", async () => {
    localStorage.setItem("accesshub.language", "fr");
    renderDashboard();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Vue d’ensemble des accès" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Langue: Français" })).toBeTruthy();
  });

  it("supports the keyboard and closes on Escape without changing language", async () => {
    renderDashboard();

    const trigger = await screen.findByRole("button", { name: "Language: English" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const english = screen.getByRole("menuitemradio", { name: "English" });
    expect(document.activeElement).toBe(english);

    fireEvent.keyDown(english, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitemradio", { name: "日本語" })
    );

    fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitemradio", { name: "简体中文" })
    );

    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(shell()?.getAttribute("lang")).toBe("en");
  });

  it("closes when clicking outside", async () => {
    renderDashboard();

    fireEvent.click(await screen.findByRole("button", { name: "Language: English" }));
    expect(screen.getByRole("menu")).toBeTruthy();

    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("translates error and access-denied states but keeps the API's detail", async () => {
    localStorage.setItem("accesshub.language", "es");
    localStorage.setItem("token", "valid.jwt");
    mockApi({
      "GET /profile": () => json({ user: admin }),
      "GET /users": () => json({ detail: "Admin access required" }, 403),
    });
    window.history.pushState(null, "", "/admin");
    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Acceso denegado")).toBeTruthy();
    expect(alert.textContent).toContain("Admin access required");
  });

  it("translates the user-directory message for roles without access", async () => {
    localStorage.setItem("accesshub.language", "ko");
    renderDashboard({ id: 7, username: "member", role: "user" });

    expect(await screen.findByText("이 역할에서는 사용자 디렉터리를 사용할 수 없습니다")).toBeTruthy();
    expect(screen.getByText("멤버", { selector: "strong" })).toBeTruthy();
  });
});

describe("theme toggle", () => {
  it("follows the system preference until the user chooses", async () => {
    stubSystemColorScheme(true);
    renderDashboard();

    expect(
      await screen.findByRole("button", { name: "Switch to light theme" })
    ).toBeTruthy();
    expect(shell()?.dataset.theme).toBe("dark");
    expect(localStorage.getItem("accesshub.theme")).toBeNull();
  });

  it("toggles and remembers the choice over the system preference", async () => {
    stubSystemColorScheme(false);
    const { unmount } = renderDashboard();

    const toggle = await screen.findByRole("button", { name: "Switch to dark theme" });
    expect(shell()?.dataset.theme).toBe("light");

    fireEvent.click(toggle);
    expect(shell()?.dataset.theme).toBe("dark");
    expect(localStorage.getItem("accesshub.theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBe(toggle);

    unmount();
    renderDashboard();
    await screen.findByRole("button", { name: "Switch to light theme" });
    expect(shell()?.dataset.theme).toBe("dark");
  });

  it("labels the toggle in the selected language", async () => {
    localStorage.setItem("accesshub.language", "zh-CN");
    localStorage.setItem("accesshub.theme", "light");
    stubSystemColorScheme(true);
    renderDashboard();

    expect(await screen.findByRole("button", { name: "切换到深色主题" })).toBeTruthy();
    expect(shell()?.dataset.theme).toBe("light");
  });
});
