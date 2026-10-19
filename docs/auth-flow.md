# Auth Flow

This document explains the JWT authentication and role-based access flow used by AccessHub.

## Authentication Overview

AccessHub connects to the Secure User API backend and uses JWT access tokens for authenticated requests.

The frontend is responsible for handling the user-facing authentication state, while credential verification, token generation, user data, and role-based permissions are handled by Secure User API.

## Basic Flow

```text
1. User enters login credentials.
2. AccessHub sends a login request to Secure User API.
3. Secure User API verifies the credentials.
4. The backend returns a JWT access token.
5. AccessHub stores the token in local storage.
6. Protected requests send the token in the Authorization header.
7. The dashboard loads the authenticated user's profile.
8. The admin page requests user data only for users with admin-level access.
```

## Token Storage

The JWT access token is stored in local storage.

This allows AccessHub to include the token with authenticated API requests after login.

Local storage is used for this portfolio implementation and is documented as a limitation rather than a production authentication recommendation.

## Authorization Header

Protected API requests include the token using the Bearer authentication scheme:

```text
Authorization: Bearer your_access_token
```

## Protected Dashboard

The `/dashboard` route represents authenticated application content.

AccessHub uses the authentication state to prevent unauthenticated users from accessing protected dashboard functionality.

Authenticated profile information is retrieved from Secure User API.

## Admin-Only Page

The `/admin` route provides role-restricted functionality.

AccessHub uses authenticated user information and the backend's role-based access controls before displaying admin-only user data.

This demonstrates the separation between authentication and authorization:

- **Authentication** determines whether the user is signed in.
- **Authorization** determines which protected functionality the authenticated user can access.

## Roles and Permissions

The API defines four roles and returns the signed-in user's permissions on
`GET /profile`. The interface reads those permissions (falling back to the same
role matrix in `src/auth/permissions.ts` for older API versions) to decide what
to show; the API enforces every rule itself.

| Role | Can |
| --- | --- |
| Admin | Manage users and roles (`users:read`, `users:manage`) and everything below |
| Manager | Handle access requests; view team activity |
| Member | Use the service; submit access requests |
| Viewer / Auditor | Read activity and audit records without changing data |

Existing accounts keep their access: `admin` / `Admin` become Admin and the
original standard `user` accounts become Members.

## Session Rules

| API response | What AccessHub does |
| --- | --- |
| 401 on any request | Clears the token and returns to sign-in |
| 403 on `/profile` or `/users` | Shows an access-denied state; the session is kept |
| 403 on a change (create, edit, …) | Shows "You don't have permission" in the dialog |
| 409 on a change | Shows the API's reason (e.g. last active admin) in the dialog |
| Network error or 5xx | Keeps the session and offers Try again |

## Temporary Passwords

Admins create accounts from the Users screen. The API generates a one-time
temporary password, which AccessHub shows once in a dialog with a Copy button;
it is held only in component state and never logged or stored. When that user
signs in, every page is replaced by a "Choose a new password" form until they
set their own password (`POST /profile/password`).

## Account Lifecycle

- **Deactivate** is the normal way to remove access and can be undone.
- **Delete permanently** is only offered for deactivated users and requires
  typing the username to confirm.
- Admins can't deactivate, delete or change the role of their own account, and
  the last active admin can't be deactivated. The interface explains disabled
  actions; the API enforces the same rules.
- Demo seed accounts (`is_seed`) are labelled **Demo** in the table.

## Main Backend Routes Used

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/login` | Authenticate and receive a JWT access token |
| GET | `/profile` | Current user, role and permissions |
| POST | `/profile/password` | Replace a temporary password |
| GET | `/users` | User directory (Admin) |
| POST | `/users` | Create a user; returns a one-time temporary password |
| PUT | `/users/{id}` | Change username and role |
| POST | `/users/{id}/deactivate` | Deactivate |
| POST | `/users/{id}/reactivate` | Reactivate |
| DELETE | `/users/{id}` | Permanently delete a deactivated user |

The full contract is documented in the backend's
[API Reference](https://github.com/Iris408/secure-user-api/blob/main/docs/api-reference.md).

## Current Limitations

The current authentication implementation is intentionally limited to the scope of the AccessHub portfolio project.

Known limitations include:

- Refresh tokens are not implemented.
- JWT access tokens are stored in local storage.
- Authentication would require additional security hardening for production use.
- Frontend authentication test coverage can be expanded.

## Maintenance

The authentication flow is feature-complete for the current AccessHub scope.

Future work should focus on authentication security review, dependency updates, test coverage, compatibility fixes, and maintaining integration with Secure User API rather than adding additional product functionality.