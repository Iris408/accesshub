# Authentication and Access Flow

AccessHub uses a React and TypeScript frontend with the Secure User API backend. The API authenticates users, issues JWT access tokens and enforces permissions on protected endpoints. The frontend uses the returned profile and permissions to show the appropriate navigation and controls.

## Regular Sign-in

1. The user enters a username and password.
2. AccessHub sends them to `POST /login` on the API configured by `VITE_API_URL`.
3. The API verifies the credentials and returns an access token.
4. AccessHub stores the token and the regular API URL in browser local storage.
5. The frontend sends the token with authenticated requests and loads the profile from `GET /profile`.
6. The API checks the token and the user's current account and permissions when handling protected requests.

## Demo Sign-in

The **Use demo account** button appears only when a separate demo API is configured with `VITE_DEMO_API_URL`.

1. The user selects **Use demo account**. No username or password is sent.
2. AccessHub calls `POST /demo/session` on the demo API.
3. The demo API returns a token for the seeded `adminDemoUser` account.
4. AccessHub stores the demo session and sends all requests in that session only to the demo API.

The demo API runs against a separate database and refuses to create a demo session if it contains a non-demo account. Seeded accounts cannot sign in with a password. Demo data is shared among visitors, so changes to demo users, roles or settings can affect later visitors.

## Token Storage and Requests

The access token is stored in browser local storage. Authenticated requests include it using the Bearer scheme:

```text
Authorization: Bearer <access-token>
```

The frontend uses the API URL associated with the active session. A demo session cannot send its authenticated requests to the regular production API.

Local storage is used for this portfolio implementation. It is convenient for a browser application, but it is more exposed to JavaScript-based attacks than an appropriately configured, HTTP-only cookie.

## Authentication and Authorization

Authentication answers whether the user is signed in. Authorization determines which actions that user can take.

The API is authoritative for authorization. It checks the user's current role and stored permission policy when protected requests are handled. Hiding a button or navigation item in the frontend is not a substitute for the API check.

`GET /profile` returns the signed-in user's profile and effective permissions. The interface uses these to display available pages and actions. Admins can change configurable permissions on the Roles page; the API applies the updated policy to subsequent requests.

## Roles and Protected Features

AccessHub has four roles:

| Role | Typical access |
| --- | --- |
| Admin | Manage users, role permissions and organisation settings; review all access requests; read the Audit Log |
| Manager | View users, review eligible access requests and view organisation activity, depending on the saved permission policy |
| Member | Use the service and submit access requests |
| Viewer / Auditor | Read-only access to permitted pages, including organisation activity by default |

Admins retain the full permission set. `roles:manage`, `settings:manage`, user management and access to the Audit Log remain Admin-only. Other role permissions can be adjusted within the safeguards displayed on the Roles page.

The Audit Log is Admin-only. The Activity page presents a smaller, display-safe view of recorded organisation events to roles that have `activity:read`.

## Access Requests

Where a user's role has permission to submit requests, they can request an allowed role through Access Requests. The API applies the organisation's access-request settings and enforces the review rules:

- Admins decide requests for Manager access.
- Eligible Managers and Admins can decide other requests.
- Nobody can decide their own request.

Requests and decisions are stored by the API. Access-request reasons and decision notes are not included in audit-event details.

## Temporary Passwords and Account Lifecycle

Admins can create user accounts from the Users page. The API generates a one-time temporary password, which AccessHub shows once. When the new user signs in, the frontend requires them to choose a new password before accessing other pages.

Admins can change roles, deactivate or reactivate accounts, and permanently delete deactivated accounts. The API prevents self-lockout and protects the last active Admin.

## Session Handling

| API response or event | AccessHub behaviour |
| --- | --- |
| `401` on an authenticated request | Clears the session and returns to sign-in |
| `403` on a protected page or action | Shows an access-denied state and keeps the session |
| `409` on a change | Shows the API's conflict message, such as an outdated settings copy |
| Network error or `5xx` | Keeps the session and offers a retry |

The API checks the database for the user's current role and permissions, so permission changes take effect on subsequent requests without requiring sign-out. The session length configured in Settings applies to newly issued tokens; existing tokens retain the expiry they were issued with.

Signing out clears the stored session in the browser. It does not call a server-side sign-out endpoint.

## Main Backend Routes

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/login` | Authenticate a regular user |
| `POST` | `/demo/session` | Start a session for the isolated demo |
| `GET` | `/profile` | Load the current profile and permissions |
| `POST` | `/profile/password` | Change a password |
| `GET`, `POST` | `/users` | List or create users, subject to permissions |
| `GET`, `PUT`, `DELETE` | `/users/{user_id}` | Read, update or delete a user, subject to permissions and safeguards |
| `GET`, `POST` | `/access-requests` | List or submit access requests |
| `GET` | `/activity` | Read the permitted activity feed |
| `GET` | `/audit-events` | Read the Admin-only Audit Log |
| `GET`, `PUT` | `/role-permissions` | Read or update configurable role permissions |
| `GET`, `PUT` | `/settings` | Read or update organisation settings |

For the full endpoint contract, see the backend [API Reference](https://github.com/Iris408/secure-user-api/blob/main/docs/api-reference.md).

## Current Limitations

- Access tokens are stored in browser local storage.
- Refresh tokens are not implemented.
- Signing out clears the local session; there is no server-side sign-out endpoint.
- Demo sessions share the hosted demo's data and settings.