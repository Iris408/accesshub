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

## Main Backend Routes Used

AccessHub integrates with Secure User API routes including:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Authenticate and receive a JWT access token |
| GET | `/users/me` | Retrieve the current authenticated user |
| GET | `/users` | Retrieve the admin-only user list |

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