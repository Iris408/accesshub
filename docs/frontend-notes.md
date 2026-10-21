# Frontend Notes

This document contains frontend-specific implementation notes for AccessHub.

## Pages

| Page | Route | Description |
| --- | --- | --- |
| Sign in | `/` | Public sign-in page with language menu, light/dark switch and an optional isolated demo |
| Dashboard | `/dashboard` | Access overview: summary cards, users table and the five latest activity events |
| Users | `/admin` | User directory and admin user management |
| Help & support | `/help` | Answers to common sign-in and access questions |
| Audit Log | `/audit-log` | Read-only audit events for admins, with filters and details |
| Access Requests | `/access-requests` | Request a role change; reviewers see new requests, the queue and decision history |
| Roles | `/roles` | Admin-only permission matrix for the four roles |
| Activity | `/activity` | Organisation sign-ins and access events (`activity:read`) |
| Settings | `/settings` | Admin-only organisation settings |

All pages except sign-in require a token and live inside the authenticated
shell (sidebar, top bar). Unknown routes show a "Page not found" page.

## Main Frontend Responsibilities

- Sign-in form, validation and error messages
- JWT access token storage (`localStorage`, key `token`)
- Profile loading, permission checks and session handling (401 ends the session)
- Users table: search, role and status filters, sorting and pagination
- Admin user management: create, edit role, deactivate, reactivate, delete
- Access requests: submitting, reviewing, approving and declining
- Role permission matrix for Admins
- Organisation activity feed
- Organisation settings
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

### Audit Log

The Audit Log page reads `GET /audit-events` (admins only; others see an
access-denied message and no request is sent). Filters — username search,
event type, outcome and a local-date range — and pagination are applied by the
API. Each row has a **Details** button that opens a dialog with every recorded
field, translated where the value is a known code. The page offers no way to
change or delete events. Event, outcome and reason labels live in
`src/components/audit/auditLabels.ts`; unknown values from a newer API are
shown as their raw code.

### Access Requests

What the page shows follows the profile's permissions; the API enforces the
same rules and the page never assumes a request will be allowed.

- **Members and Managers** (`access_requests:submit`, not Admins) get a
  request form — role (never Admin or their current role) and a reason — and
  their own requests from `GET /access-requests/mine`. While a request is
  pending the form is replaced by a notice, since the API allows one at a time.
- **Managers and Admins** (`access_requests:review`) get a **New requests**
  box (`GET /access-requests/summary`: pending count and the five newest) and
  the full queue (`GET /access-requests`) with requester search, status,
  requested role and local-date range filters plus pagination, all applied by
  the API. "View all pending" filters the queue to pending and moves focus to it.
- **Viewer / Auditor** accounts see an explanation and no queue requests are
  sent. If they have past requests (e.g. a Member whose request for Viewer /
  Auditor was approved), their history is still shown.
- **Review dialog:** every field, then Approve / Decline with an optional note
  when the API's `can_decide` is true. Otherwise it explains why
  (`decision_block_reason`), e.g. only admins can decide Manager requests or
  you can't review your own. A `409`/`404` (already decided elsewhere)
  shows a message and refreshes the lists.
- For pending requests the role change reads current role → requested role;
  for decided requests it uses the role at submission, because an approval has
  already changed the current role.
- Synthetic seed requests (`is_seed`) carry a **Demo** badge.
- Loading, empty, no-matches, error/retry, forbidden (the API's message) and
  expired-session (signs out) states are handled by `src/hooks/useApiResource.ts`.

Components live in `src/components/requests/`; status, block-reason and error
labels are in `requestLabels.ts`.

### Roles

The Roles page reads `GET /role-permissions` and saves with
`PUT /role-permissions` (Admins only: other roles see an explanation and no
request is sent). Capabilities are rows and roles are columns.

- Editable cells are checkboxes labelled "Allow “capability” for role", with
  the capability's description as their accessible description. Changed cells
  are highlighted and counted; **Save changes** and **Cancel** stay disabled
  until something changes.
- Locked cells show allowed/not allowed, a lock and a rule number. The
  numbered **Protected rules** list below explains each rule (Admin keeps every
  permission; user management, the audit log and the policy are Admin-only;
  Viewer / Auditor is read-only; Members always keep request access), and
  screen readers hear the reason in the cell. The role-based rule that only
  Admins decide Manager requests is listed too.
- Saving sends the complete matrix with the `version` it was based on. On
  success the page reloads the matrix from the API and shows a notice; a
  `422` shows the API's reason and keeps the unsaved changes; a `409` explains
  that someone else saved first and offers **Reload latest** (which discards
  the unsaved changes). The page never shows success unless the API accepted
  the change.
- Activity permissions are not shown: they have no effect yet.
- On phones the capability column stays in place while the role columns
  scroll.

Labels live in `src/components/roles/permissionLabels.ts`; unknown
permissions from a newer API are shown as their code.

### Activity

The Activity page reads `GET /activity`, available to anyone whose profile
lists `activity:read` (by default Admin, Manager and Viewer / Auditor; others
see an explanation and no request is sent). It is a feed rather than a table:
events are grouped by local day, each showing the event, outcome, who did it,
what it affected and a short reason, with a **Details** button that opens the
same accessible dialog as the Audit Log. Because the API sends a smaller,
display-safe projection, the dialog shows fewer fields than the Admin-only
Audit Log. Filters (username search, event type, outcome, local-date range)
and pagination (30 per page) are applied by the API. The dashboard's
**Recent activity** panel shows the five latest events from the same
endpoint and links to the page.

### Settings

The Settings page reads `GET /settings` and saves with `PUT /settings`
(Admins only; others see an explanation and no request is sent). It has three
groups — Organisation (name, timezone), Access requests (on/off, requestable
roles) and Sessions (length) — each explaining its effect. Saving sends every
setting with the `revision` it was based on; success is shown only after the
API accepts it, then the values are re-read. A `422` shows the API's reason
and keeps the edits; a `409` offers **Reload latest**. The page checks the
name length and that at least one role is requestable before sending.

### Organisation settings across the app

`OrganisationProvider` (inside `AuthProvider`) loads `GET /organisation`
whenever the profile loads or refreshes (navigation, window focus, after a
403) and right after an Admin saves settings, so changes reach open sessions
without a reload:

- **Name** — shown under the logo in the sidebar.
- **Timezone** — passed to the i18n formatters (`createTranslator(locale,
  timeZone)`), so every date and time, Activity's day groups and the date
  filters on Audit Log, Activity and Access Requests use it. Without one (the
  default) they use the viewer's own timezone. Signing out resets it.
- **Access request policy** — the request form only offers allowed roles,
  and shows a notice instead of the form when requests are off. If the API
  refuses a request because the policy changed, the policy is re-read.

### Route-level code splitting

Every signed-in page is loaded with `React.lazy` (see `src/App.tsx`); the
sign-in page stays in the main bundle so the first screen needs no extra
request. `AppShell` wraps the routed page in `Suspense`, so the sidebar and
top bar stay in place while a page's chunk loads.

### Permission changes during a session

The API is authoritative and checks the current policy on every request. To
keep the interface in step, `AuthProvider` re-reads `/profile` when the user
moves to another page or returns to the window (at most every 5 seconds), and
immediately whenever a page gets `403` from the API. Navigation locks and page
access then follow the new permissions without signing out or reloading.

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
- Access requests workflow with review queue and decision history
- Configurable role permissions with protected rules
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