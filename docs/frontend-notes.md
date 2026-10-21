# Frontend Notes

This document describes AccessHub’s frontend pages, behavior and maintenance.

## Pages

| Page | Route | Description |
| --- | --- | --- |
| Sign in | `/` | Sign-in page with language and theme controls, plus an optional isolated demo |
| Dashboard | `/dashboard` | Access overview, users table and latest activity |
| Users | `/admin` | User directory and user management for roles with permission |
| Help & support | `/help` | Answers to common sign-in and access questions |
| Audit Log | `/audit-log` | Read-only audit events for Admins, with filters and details |
| Access Requests | `/access-requests` | Submit a role request or review requests, depending on permissions |
| Roles | `/roles` | Admin-only permission matrix |
| Activity | `/activity` | Organisation sign-ins and access events for roles with `activity:read` |
| Settings | `/settings` | Admin-only organisation settings |

All pages except sign-in require a session and use the authenticated shell
(sidebar and top bar). Unknown routes show a “Page not found” page.

## Main Frontend Responsibilities

- Sign-in, demo-session startup, form validation and error messages
- Session token storage and authenticated API requests
- Profile loading, permission-based navigation and session handling
- User directory search, filters, sorting and pagination
- User creation, role changes, deactivation, reactivation and deletion
- Access request submission, review and decision history
- Role permission configuration for Admins
- Activity feed and Admin-only Audit Log
- Organisation settings
- Required password changes for temporary passwords
- Light and dark themes and six interface languages
- Loading, empty, error and access-denied states

## Project Structure

```text
accesshub/
  src/
    api/client.ts          Typed API client and API URL selection
    auth/                  Auth context, roles, permissions and token storage
    components/
      activity/            Activity feed items
      audit/                Audit details and event labels
      auth/                 Change-password form
      dashboard/            Recent activity panel
      layout/               App shell, sidebar, top bar and language menu
      public/               Sign-in illustration, role strip and theme switch
      requests/             Request form, queue and review dialogs
      roles/                Permission matrix and labels
      ui/                   Shared dialogs, tables, icons and controls
      users/                User table, panel and management dialogs
    hooks/                  API resources, audit events, users and UI hooks
    i18n/                   Translation runtime and six language dictionaries
    organisation/           Organisation settings context
    pages/                  Route-level page components
    test/                   Test setup and API mocks
    dashboard.css           Theme tokens and authenticated app styles
    public.css              Sign-in page and role illustration styles
  docs/
  screenshots/
```

## Frontend Implementation

### Sign-in and demo session

Regular sign-in sends `POST /login` with `{ username, password }` to the
production API and stores the returned access token.

When `VITE_DEMO_API_URL` is configured, **Use demo account** starts a
credential-free session through the demo API. Authenticated requests in that
session continue to use the demo API; they are not sent to the production API.
The demo account is `adminDemoUser`. Seeded demo accounts cannot sign in with
a password.

The sign-in page uses a two-column layout on tablet and desktop, and a compact
layout with a role strip on phones. Its role-card animation respects the
operating system’s reduced-motion setting. See the
[Setup Guide](./setup.md#public-demo) for environment setup.

### Protected routes and roles

The app loads `GET /profile` to obtain the current role and permissions. The
frontend uses them to display navigation and page controls; the API enforces
access on every request. A session ends when the API returns `401`. See
[Auth Flow](./auth-flow.md) for details.

### Themes and languages

The theme follows the system preference until the user chooses one. The
selected theme and language are remembered in `localStorage`. The supported
languages are English, Japanese, Korean, French, Spanish and Simplified
Chinese.

Every language dictionary must define the same keys as the English
dictionary; tests check translation consistency.

### Users

The Users page shows the directory to roles that have `users:read`. User
management actions require the API’s corresponding permission. The page
supports search, role and status filters, sorting and pagination.

Admins can create users, change roles, deactivate or reactivate accounts, and
delete users. A generated temporary password is shown once, and the user must
change it at first sign-in.

### Access Requests

The page follows the current profile permissions, and the API independently
enforces the same rules.

- Roles with `access_requests:submit` can request an allowed role other than
  their current role. Admins cannot submit requests. The form is replaced by
  a notice while a request is pending; the API also prevents duplicate
  pending requests.
- Roles with `access_requests:review` see a **New requests** summary and the
  full request queue. The queue supports requester search, status, requested
  role and date filters, plus pagination.
- Users can see their own request history. Viewer / Auditor accounts can see
  their history when they have one, but cannot submit or review requests.
- Reviewers can approve or decline when permitted. The UI explains cases they
  cannot decide, such as a request for Manager access that requires an Admin.
  If a request was already decided elsewhere, the page reports that and
  refreshes the lists.
- Seeded synthetic requests have a **Demo** badge.

The request form also follows the organisation’s request policy. When
requests are disabled, users see a notice instead of the form.

### Roles

The Roles page reads `GET /role-permissions` and saves changes with
`PUT /role-permissions`. It is Admin-only.

Editable cells are shown as checkboxes. Protected cells explain why they
cannot be changed, including the rules that Admin retains full access and
that user management, the Audit Log, role permissions and Settings remain
Admin-only. Saving uses the policy version that was loaded. If another Admin
has already saved, the page offers to reload the latest matrix.

In a demo session, a notice explains that saved permission changes are shared
with other demo visitors.

### Activity

The Activity page reads `GET /activity`. Access requires `activity:read`,
which is enabled by default for Admin, Manager and Viewer / Auditor. Admins
can change the Manager, Member and Viewer / Auditor settings on the Roles
page. Members do not have access by default.

The feed groups events by the organisation’s configured timezone and supports
username, event type, outcome and date filters. It shows a display-safe set of
event details. The dashboard’s **Recent activity** panel shows the latest
events from the same endpoint.

The demo Activity feed contains events generated by actual demo use. It is
not prefilled with fabricated history.

### Audit Log

The Audit Log reads `GET /audit-events` and is Admin-only. Other roles see an
access-denied message without the page requesting audit data.

Filters include username, event type, outcome and date range, with
server-side pagination. A **Details** dialog shows the recorded fields.
Events cannot be edited or deleted through the frontend. The database also
enforces append-only behavior.

The demo Audit Log starts empty and records real events from demo use.

### Settings

The Settings page reads `GET /settings` and saves with `PUT /settings`. It is
Admin-only. Settings cover the organisation name, timezone, access request
policy and session length.

Saving submits the complete settings set and its revision. A stale save is
rejected, and the page offers to reload the latest values. Successful setting
changes are recorded in the Audit Log and Activity feed.

In a demo session, a notice explains that saved settings are shared with other
demo visitors.

### Organisation settings across the app

The organisation context loads settings for the signed-in session and
refreshes them when the profile is refreshed or an Admin saves changes.

- **Organisation name:** displayed in the sidebar.
- **Timezone:** used for displayed dates and times, Activity day groups, and
  date filters on Activity, Audit Log and Access Requests. If no timezone is
  configured, the viewer’s local timezone is used.
- **Access request policy:** controls which roles may be requested and
  whether new requests can be submitted.

### API integration

Requests go through `src/api/client.ts`. It attaches the bearer token and
selects the API base URL according to the session: regular sessions use
`VITE_API_URL`; demo sessions use `VITE_DEMO_API_URL`.

API errors are converted to typed errors, including unauthorized, forbidden,
conflict, invalid input, not found, network and server errors. Pages use these
to show the appropriate message or session behavior.

### Route-level code splitting

Authenticated pages load on demand with `React.lazy`. The sign-in page remains
in the initial bundle. While a page loads, the sidebar and top bar stay in
place.

### Permission changes during a session

The API checks current permissions on every request. The frontend refreshes
the profile when a user changes page, returns to the window or receives a
`403`, so navigation and page access update without requiring sign-out.

## Maintenance

The shared demo is intentionally changeable. Demo visitors can make changes
to users, permissions and settings, and create requests and activity.

**Planned maintenance:** establish and document a repeatable way to restore
the demo to its intended baseline. The reset plan should cover demo users,
role permissions, settings and seeded access requests. Decide explicitly how
to handle the append-only Audit Log and real Activity events, which should not
be silently rewritten as fake history. Until a reset procedure is implemented
and reviewed, restore the demo only through a deliberate, verified process
against the dedicated demo database.

Other maintenance includes dependency updates, compatibility fixes, security
review, test coverage and keeping documentation accurate.