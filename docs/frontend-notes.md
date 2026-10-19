# Frontend Notes

This document contains frontend-specific implementation notes for AccessHub.

## Pages

| Page | Route | Description |
| --- | --- | --- |
| Sign in | `/` | Public sign-in page with language menu, light/dark switch and an optional isolated demo |
| Dashboard | `/dashboard` | Access overview: summary cards, users table and activity panel |
| Users | `/admin` | User directory and admin user management |
| Help & support | `/help` | Answers to common sign-in and access questions |
| Access Request, Roles, Activity, Audit Log, Settings | `/access-requests`, `/roles`, `/activity`, `/audit-log`, `/settings` | Placeholders until the API supports them |

All pages except sign-in require a token and live inside the authenticated
shell (sidebar, top bar). Unknown routes show a "Page not found" page.

## Main Frontend Responsibilities

- Sign-in form, validation and error messages
- JWT access token storage (`localStorage`, key `token`)
- Profile loading, permission checks and session handling (401 ends the session)
- Users table: search, role and status filters, sorting and pagination
- Admin user management: create, edit role, deactivate, reactivate, delete
- Temporary-password change at first sign-in
- Light/dark theme and six interface languages
- Loading, empty, error and access-denied states

## Project Structure

```text
accesshub/
  src/
    api/client.ts          Typed API client (all backend requests)
    auth/                  Auth context, roles, permissions, token storage
    components/
      auth/                Change-password form
      dashboard/           Activity panel
      layout/              App shell, sidebar, top bar, language menu
      public/              Sign-in page illustration, theme switch, links
      ui/                  Shared components (dialog, menu, table, icons…)
      users/               Users table, panel and management dialogs
    hooks/                 useUsers, useTheme, useMediaQuery
    i18n/                  Translation runtime and one dictionary per language
    pages/                 Route components
    test/                  Test setup and API mocks
    dashboard.css          Theme tokens and app shell styles
    public.css             Sign-in page layout
  docs/
  screenshots/
```

## Frontend Implementation

### Sign-in

The sign-in page sends `POST /login` with `{ username, password }` and stores the
returned `access_token`. It checks that both fields are filled in before
calling the API, shows a "Signing in…" state, and translates the API's known
errors. When an isolated demo API is configured (`VITE_DEMO_API_URL`),
**Use demo account** opens a credential-free session on that API only; see
[Setup Guide](./setup.md#public-demo).

### Protected Routes and Roles

Authenticated pages load `GET /profile`, which returns the user's role and
permissions. The interface uses those permissions to decide what to show; the
API enforces them. See [Auth Flow](./auth-flow.md) for roles and session rules.

### Themes and Languages

The theme follows the system preference until the user picks one; the choice
and the selected language (English, 日本語, 한국어, Français, Español, 简体中文)
are remembered in `localStorage`. Every locale must define the same keys as the
English dictionary — the build and tests fail otherwise.

### API Integration

All requests go through `src/api/client.ts`, which adds the bearer token and
turns error responses into typed errors (`unauthorized`, `forbidden`,
`conflict`, `invalid`, `notFound`, `network`, `server`).

## UI

AccessHub is intentionally designed as a focused authentication and access-management interface rather than a larger general-purpose application.

The interface demonstrates:

- Authentication flow
- Protected route behaviour
- Role-based access
- Admin-only functionality
- Backend API integration
- Loading and error feedback
- Responsive dashboard presentation

## Completed Improvements

The current frontend includes:

- Illustrated sign-in page with language menu and light/dark switch
- Dashboard with summary cards, users table and activity panel
- Four-role permissions and admin user management
- Environment-based API URL handling
- Loading states
- Error handling
- Admin users API integration
- Secure User API role checking
- Responsive styling
- AccessHub product branding

## Maintenance

The frontend is feature-complete for the current AccessHub portfolio scope.

Ongoing work should focus on maintenance rather than feature expansion, including dependency updates, compatibility fixes, test coverage, security review, and documentation accuracy.