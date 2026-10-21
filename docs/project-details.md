# Project Details

This document describes AccessHub’s architecture, responsibilities, deployment
and current maintenance scope.

## Architecture

```text
AccessHub frontend
React · TypeScript · Vite
          │
          ├── Production session ──> Secure User API ──> Production PostgreSQL
          │
          └── Demo session ────────> Demo API ─────────> Demo PostgreSQL
```

The frontend and backend are maintained in separate repositories and deployed
independently. The demo uses its own API and database so demo activity and
changes remain separate from production data.

## Frontend

The frontend uses React, TypeScript, Vite, React Router and CSS.

Its responsibilities include:

- Sign-in and demo-session startup
- Session token storage and authenticated API requests
- Profile loading and protected routes
- Permission-aware navigation and page controls
- User directory and user management
- Access request submission and review
- Admin configuration of role permissions and organisation settings
- Activity feed and Admin-only Audit Log
- Loading, empty, error and access-denied states
- Light and dark themes, six languages and responsive layouts

Authenticated pages are loaded on demand. The API remains responsible for
enforcing authentication, roles and permissions; hiding a frontend control
does not grant or deny access by itself.

## Backend API

AccessHub integrates with Secure User API, a separately maintained FastAPI
backend. The API provides:

- PostgreSQL persistence with SQLAlchemy
- JWT authentication and protected routes
- Four roles: Admin, Manager, Member and Viewer / Auditor
- User lifecycle management and temporary passwords
- Configurable role permissions with protected rules
- Access request submission, review and history
- Organisation Activity and an append-only Admin Audit Log
- Organisation settings enforced by the API
- Health and readiness endpoints, automated tests and Docker support

Backend repository:

[Secure User API](https://github.com/Iris408/secure-user-api)

## Authentication and data separation

Regular sign-in uses the production API configured by `VITE_API_URL`. When
the demo is enabled, **Use demo account** starts a session through
`VITE_DEMO_API_URL`. Requests authenticated with that demo session continue
to use the demo API; they are not sent to the production API.

The demo account is `adminDemoUser`. It has the Admin role, but seeded demo
accounts cannot sign in with a password. Demo users can change shared demo
data, including users, role permissions and settings. Demo Activity and Audit
Log records come from real demo use rather than fabricated event history.

See [`auth-flow.md`](./auth-flow.md) and the
[Setup Guide](./setup.md) for more detail.

## Deployment

The frontend is deployed on Vercel. The production API and isolated demo API
are deployed separately on Render, each with its own database configuration.

This setup demonstrates independently deployed frontend and backend
applications, plus a separate environment for public demonstration.

## Current limitations

AccessHub is a portfolio project that demonstrates authentication and
access-management workflows. It is not intended to serve as a complete
enterprise identity platform.

Current limitations and deferred work include:

- Access tokens are stored in browser local storage; refresh tokens are not
  implemented.
- Sign-in rate limiting is not implemented.
- Sign-out clears the browser session but is not recorded as a server event.
- Activity does not automatically refresh; users can refresh the page feed.
- Audit events are retained indefinitely. The database prevents editing and
  deletion, so any retention policy needs a reviewed change.
- Email and in-app notifications are not implemented.
- Shortening the configured session length affects newly issued tokens; it
  does not revoke existing sessions.
- The public demo is shared. Changes made by one visitor can affect what
  another visitor sees until the demo is reset.

## Maintenance

The project is in maintenance for its current portfolio scope. Maintenance
includes dependency and security updates, CI upkeep, compatibility fixes,
test coverage and documentation accuracy.

A demo reset is a planned maintenance task. The reset procedure should restore
the intended baseline for demo users, role permissions, settings and seeded
access requests. It must also state how to handle the append-only Audit Log
and real Activity events so that real history is not silently replaced by
fabricated data. Until a reset process is implemented and reviewed, restore
the demo only through a deliberate, verified process against the dedicated
demo database.

## Learning outcomes

Through AccessHub, I developed practical experience with:

- React and TypeScript application development
- React Router, protected routes and lazy page loading
- JWT authentication and authenticated API requests
- Permission-aware interfaces backed by server-side authorization
- REST API integration with FastAPI
- PostgreSQL-backed application behavior
- Loading, error and access-denied states
- Responsive layouts, accessibility, themes and localization
- Frontend and backend testing
- Docker and GitHub Actions
- Independent Vercel and Render deployments