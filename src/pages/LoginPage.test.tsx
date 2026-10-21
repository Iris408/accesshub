import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import LoginPage from "./LoginPage";
import I18nProvider from "../i18n/I18nProvider";
import { LOCALES } from "../i18n/locales";
import { callsTo, json, mockApi, networkError } from "../test/mockApi";
import publicCss from "../public.css?raw";

function renderLogin() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <I18nProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/dashboard" element={<p>Dashboard route</p>} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>
  );
}

function fill(username: string, password: string) {
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: username } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

function shell() {
  return document.querySelector<HTMLElement>(".ah-public");
}

describe("LoginPage sign-in", () => {
  it("posts credentials to /login, stores the token and opens the dashboard", async () => {
    const fetchMock = mockApi({
      "POST /login": () => json({ access_token: "jwt.token.value", token_type: "bearer" }),
    });

    renderLogin();
    fill("testuser", "password123");
    submit();

    expect(await screen.findByText("Dashboard route")).toBeTruthy();
    expect(localStorage.getItem("token")).toBe("jwt.token.value");

    const [[, init]] = callsTo(fetchMock, "/login");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      username: "testuser",
      password: "password123",
    });
  });

  it("never writes the login response or token to the console", async () => {
    const consoleSpies = (["log", "info", "debug", "warn", "error"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {})
    );
    mockApi({
      "POST /login": () => json({ access_token: "secret.jwt", token_type: "bearer" }),
    });

    renderLogin();
    fill("testuser", "password123");
    submit();
    await screen.findByText("Dashboard route");

    const logged = JSON.stringify(consoleSpies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain("secret.jwt");
  });

  it("asks for both fields before contacting the API", () => {
    const fetchMock = mockApi({});

    renderLogin();
    submit();

    expect(screen.getByText("Enter your username.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(screen.getByLabelText("Username").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Username"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("disables the button while signing in", async () => {
    let finish: (response: Response) => void = () => {};
    mockApi({ "POST /login": () => new Promise<Response>((resolve) => (finish = resolve)) });

    renderLogin();
    fill("testuser", "password123");
    submit();

    const pending = screen.getByRole("button", { name: "Signing in…" }) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);

    finish(json({ access_token: "jwt", token_type: "bearer" }));
    expect(await screen.findByText("Dashboard route")).toBeTruthy();
  });

  it.each([
    [json({ detail: "Invalid username or password" }, 401), "Invalid username or password."],
    [json({ detail: "Account is deactivated" }, 403), "This account has been deactivated."],
    [json({ token_type: "bearer" }), "The AccessHub API didn't return an access token."],
    [json({ detail: "Something unexpected" }, 500), "Sign-in failed: Something unexpected"],
  ])("explains a failed sign-in (%#)", async (response, message) => {
    mockApi({ "POST /login": () => response });

    renderLogin();
    fill("testuser", "wrong-password");
    submit();

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", message);
    await waitFor(() => expect(localStorage.getItem("token")).toBeNull());
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("reports when the API can't be reached", async () => {
    mockApi({ "POST /login": networkError });

    renderLogin();
    fill("testuser", "password123");
    submit();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Unable to connect to the AccessHub API"
    );
  });

  it("never shows demo credentials", () => {
    renderLogin();

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("testuser");
    expect(text).not.toContain("password123");
  });
});

describe("LoginPage demo access", () => {
  const DEMO_API = "https://demo-api.example.test";

  it("hides the demo action when no isolated demo API is configured", () => {
    // Explicit, so a developer's .env.local can't change the outcome.
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    vi.stubEnv("VITE_DEMO_API_URL", "");
    renderLogin();

    expect(screen.queryByRole("button", { name: "Use demo account" })).toBeNull();
  });

  it("hides the demo action when the demo API is the production API", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    vi.stubEnv("VITE_DEMO_API_URL", "https://api.example.test/");

    renderLogin();

    expect(screen.queryByRole("button", { name: "Use demo account" })).toBeNull();
  });

  it("opens a demo session on the isolated demo API without credentials", async () => {
    vi.stubEnv("VITE_DEMO_API_URL", DEMO_API);
    const fetchMock = mockApi({
      "POST /demo/session": () => json({ access_token: "demo.jwt", token_type: "bearer" }),
    });

    renderLogin();
    const demo = screen.getByRole("button", { name: "Use demo account" });
    expect(screen.getByText("Opens a separate demo that contains only synthetic data.")).toBeTruthy();

    fireEvent.click(demo);

    expect(await screen.findByText("Dashboard route")).toBeTruthy();
    const [[url, init]] = fetchMock.mock.calls;
    expect(String(url)).toBe(`${DEMO_API}/demo/session`);
    expect(init?.body).toBeUndefined();
    expect(localStorage.getItem("token")).toBe("demo.jwt");
    expect(localStorage.getItem("accesshub.session")).toBe("demo");
  });

  it("explains when the demo environment is unavailable", async () => {
    vi.stubEnv("VITE_DEMO_API_URL", DEMO_API);
    mockApi({
      "POST /demo/session": () =>
        json({ detail: "Demo sessions are disabled: this database contains non-demo accounts" }, 503),
    });

    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Use demo account" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The demo environment isn't available right now. Try again later."
    );
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("signs in normally against the production API, not the demo", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    vi.stubEnv("VITE_DEMO_API_URL", DEMO_API);
    const fetchMock = mockApi({
      "POST /login": () => json({ access_token: "real.jwt", token_type: "bearer" }),
    });

    renderLogin();
    fill("jane.doe", "a-long-password");
    submit();

    await screen.findByText("Dashboard route");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.example.test/login");
    expect(localStorage.getItem("accesshub.session")).toBeNull();
  });
});

describe("LoginPage layout controls", () => {
  it("shows the introduction, sign-in form and decorative illustration", () => {
    renderLogin();

    expect(
      screen.getByRole("heading", { level: 1, name: "A clearer view of who has access." })
    ).toBeTruthy();
    expect(screen.getByText("Manage users and roles from one place.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    expect(document.querySelector(".ah-illustration")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("animates the role cards in order without exposing them to assistive technology", () => {
    renderLogin();

    const svg = document.querySelector(".ah-illustration")!;
    const cards = Array.from(svg.querySelectorAll(".ah-illustration__role"));

    // Admin, Manager, Viewer / Auditor: each card a group that can lift on its own.
    expect(cards.map((card) => card.getAttribute("class"))).toEqual([
      "ah-illustration__role ah-illustration__role--1",
      "ah-illustration__role ah-illustration__role--2",
      "ah-illustration__role ah-illustration__role--3",
    ]);
    expect(cards.map((card) => card.querySelector("text")?.textContent)).toEqual([
      "Admin",
      "Manager",
      "Viewer / Auditor",
    ]);
    // Connector dots stay outside the moving groups, so lines never detach.
    expect(cards.every((card) => !card.querySelector(".ah-illustration__dot"))).toBe(true);

    // Decorative only: hidden, not focusable, and nothing to announce.
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.querySelector("[aria-live], [role]")).toBeNull();
  });

  it("orders the page for small screens: introduction, form, then the role strip", () => {
    renderLogin();

    const main = document.querySelector(".ah-public__main")!;
    const blocks = Array.from(main.children).map((child) => child.className);
    // The wide illustration (tablet and desktop) and the strip (mobile) are
    // both present; CSS shows one or the other.
    expect(blocks).toEqual(["ah-public__intro", "ah-public__art", "ah-signin", "ah-public__roles"]);
  });

  it("shows the roles as a compact, decorative strip in order", () => {
    renderLogin();

    const strip = document.querySelector(".ah-rolestrip")!;
    expect(strip.getAttribute("aria-hidden")).toBe("true");
    expect(strip.querySelector("[aria-live], [role], button, a")).toBeNull();

    const cards = Array.from(strip.querySelectorAll(".ah-rolestrip__card"));
    expect(cards.map((card) => card.className)).toEqual([
      "ah-rolestrip__card ah-rolestrip__card--1",
      "ah-rolestrip__card ah-rolestrip__card--2",
      "ah-rolestrip__card ah-rolestrip__card--3",
    ]);
    expect(cards.map((card) => card.querySelector(".ah-rolestrip__label")?.textContent)).toEqual([
      "Admin",
      "Manager",
      "Viewer / Auditor",
    ]);
    expect(cards.every((card) => card.querySelector(".ah-rolestrip__icon svg"))).toBe(true);
  });

  it("translates the role strip", () => {
    localStorage.setItem("accesshub.language", "fr");
    renderLogin();

    expect(
      Array.from(document.querySelectorAll(".ah-rolestrip__label")).map((label) => label.textContent)
    ).toEqual(["Administrateur", "Responsable", "Lecteur / Auditeur"]);
  });

  it("splits at tablet width and stacks below it, animating the strip like the illustration", () => {
    const block = (start: string) => {
      const from = publicCss.indexOf(start);
      expect(from).toBeGreaterThan(-1);
      return publicCss.slice(from, publicCss.indexOf("\n}\n", from));
    };

    const tablet = block("@media (max-width: 1100px) {");
    expect(tablet).toContain("grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);");

    const mobile = block("@media (max-width: 899.98px) {");
    expect(mobile).toMatch(/grid-template-areas:\s*"intro"\s*"form"\s*"roles";/);
    expect(mobile).toMatch(/\.ah-public__art \{\s*display: none;/);
    expect(mobile).toMatch(/\.ah-public__roles \{\s*display: block;/);

    // Long translations wrap rather than clip or widen the page.
    expect(block(".ah-rolestrip__label {")).toContain("overflow-wrap: anywhere;");
    expect(block(".ah-rolestrip__card {")).toContain("animation: ah-strip-lift 10.5s ease-in-out infinite;");
    expect(block(".ah-rolestrip__card--2,")).toContain("animation-delay: 3.5s;");
    expect(block(".ah-rolestrip__card--3,")).toContain("animation-delay: 7s;");

    const reduced = publicCss.slice(publicCss.indexOf(".ah-rolestrip__card,\n  .ah-rolestrip__icon {"));
    expect(reduced.slice(0, 80)).toContain("animation: none;");
  });

  it("staggers the role cards on one loop and stops it for reduced motion", () => {
    // jsdom doesn't run CSS animations, so check the stylesheet itself.
    const block = (start: string) => {
      const from = publicCss.indexOf(start);
      expect(from).toBeGreaterThan(-1);
      return publicCss.slice(from, publicCss.indexOf("}", from));
    };

    expect(block(".ah-illustration__role {")).toContain("animation: ah-role-lift 10.5s ease-in-out infinite;");
    expect(block(".ah-illustration__role-card {")).toContain(
      "animation: ah-role-highlight 10.5s ease-in-out infinite;"
    );
    // Admin first, then Manager after 3.5s, then Viewer / Auditor after 7s.
    expect(block(".ah-illustration__role--2 .ah-illustration__role-card {")).toContain("animation-delay: 3.5s;");
    expect(block(".ah-illustration__role--3 .ah-illustration__role-card {")).toContain("animation-delay: 7s;");

    const reduced = block("@media (prefers-reduced-motion: reduce) {");
    expect(reduced).toContain(".ah-illustration__role,");
    expect(reduced).toContain(".ah-illustration__role-card {");
    expect(reduced).toContain("animation: none;");
  });

  it("links to the verified project destinations in new tabs", () => {
    renderLogin();

    const footer = screen.getByRole("navigation", { name: "Project links" });
    const links = within(footer).getAllByRole("link");

    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["GitHub (opens in a new tab)", "https://github.com/Iris408/accesshub"],
      ["API (opens in a new tab)", "https://mini-user-api.onrender.com/docs"],
      ["Documentation (opens in a new tab)", "https://github.com/Iris408/accesshub/tree/main/docs"],
    ]);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("switches between light and dark and remembers the choice", () => {
    renderLogin();

    const toggle = screen.getByRole("switch", { name: "Dark theme" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(shell()?.dataset.theme).toBe("light");

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(shell()?.dataset.theme).toBe("dark");
    expect(localStorage.getItem("accesshub.theme")).toBe("dark");
  });

  it("draws both sun and moon icons as inline SVG in the switch", () => {
    renderLogin();
    const toggle = screen.getByRole("switch", { name: "Dark theme" });

    expect(toggle.querySelector(".ah-switch__icon--sun")?.tagName.toLowerCase()).toBe("svg");
    expect(toggle.querySelector(".ah-switch__icon--moon")?.tagName.toLowerCase()).toBe("svg");
    expect(toggle.querySelector(".ah-switch__thumb svg")).toBeTruthy();
    expect(toggle.querySelector("img")).toBeNull();
    // Icons are decorative; the switch's name and state carry the meaning.
    for (const svg of toggle.querySelectorAll("svg")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
    expect(toggle.textContent).toBe("");
  });

  it("labels the switch in the selected language", () => {
    localStorage.setItem("accesshub.language", "es");
    renderLogin();

    expect(screen.getByRole("switch", { name: "Tema oscuro" })).toBeTruthy();
  });

  it.each(LOCALES.filter((locale) => locale.code !== "en"))(
    "translates the page into $name",
    ({ code, name }) => {
      renderLogin();

      fireEvent.click(screen.getByRole("button", { name: "Language: English" }));
      fireEvent.click(screen.getByRole("menuitemradio", { name }));

      expect(shell()?.getAttribute("lang")).toBe(code);
      expect(screen.queryByText("A clearer view of who has access.")).toBeNull();
      expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
      expect(localStorage.getItem("accesshub.language")).toBe(code);
    }
  );

  it("keeps working in another language", async () => {
    localStorage.setItem("accesshub.language", "ja");
    mockApi({ "POST /login": () => json({ detail: "Invalid username or password" }, 401) });

    renderLogin();
    fireEvent.change(screen.getByLabelText("ユーザー名"), { target: { value: "testuser" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "サインイン" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "ユーザー名またはパスワードが正しくありません。"
    );
  });
});
