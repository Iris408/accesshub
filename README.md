![Docker CI](https://github.com/Iris408/accesshub/actions/workflows/docker-ci.yml/badge.svg)
![Frontend CI](https://github.com/Iris408/accesshub/actions/workflows/frontend-ci.yml/badge.svg)

# AccessHub

AccessHub is a React and TypeScript authentication frontend connected to a deployed FastAPI backend.

## Live Demo

Frontend:

- [AccessHub](https://accesshub-iris408.vercel.app)

Backend API:

- [Secure User API Swagger Docs](https://mini-user-api.onrender.com/docs)

Related backend repository:

- [Secure User API](https://github.com/Iris408/secure-user-api)

## Current Status

| Area | Status |
| --- | --- |
| React / TypeScript frontend | ✅ Complete |
| Login flow | ✅ Working |
| JWT token storage | ✅ Working |
| Protected dashboard | ✅ Working |
| Admin user management | ✅ Working |
| Four-role permissions | ✅ Working |
| Access requests workflow | ✅ Working |
| Configurable role permissions | ✅ Working |
| Activity feed | ✅ Working |
| Organisation settings | ✅ Working |
| Loading and error states | ✅ Complete |
| Vercel deployment | ✅ Live |
| Render backend integration | ✅ Live |
| Frontend CI | ✅ Passing |
| Docker CI | ✅ Passing |

## Features

- User login flow
- JWT token storage
- Protected dashboard route
- Four roles — Admin, Manager, Member, Viewer / Auditor — with permissions
  enforced by the API and reflected in the interface
- User management for admins: add, edit role, deactivate, reactivate and
  permanently delete, with accessible confirmation dialogs
- One-time temporary passwords and a required password change at first sign-in
- Users table with search, role and status filters, sorting and pagination
- Access requests: members and managers ask for a different role; managers
  and admins review a "New requests" box and a filterable queue, and approve
  or decline with an optional note (only admins decide Manager requests)
- Admin-only Settings: organisation name, timezone (used for every date and
  time in the interface), access request policy and session length
- Activity feed of organisation sign-ins and access events, filterable by
  username, event type, outcome and date, for roles with `activity:read`
- Roles page where Admins choose what Managers, Members and Viewers / Auditors
  may do, with protected rules shown and explained; navigation follows
  permission changes without signing out
- Read-only Audit Log of sign-ins and administrative changes, with filters
- Light and dark themes and six interface languages
- Authenticated API requests
- API integration with deployed FastAPI backend
- Multi-page frontend routing
- Loading and error handling
- Responsive UI styling
- Vercel deployment
- Frontend and Docker CI workflows

## Maintenance Backlog

- Add a guarded, operator-run reset for the hosted demo. It should restore
  demo-owned users, sample access requests, role permissions and organisation
  settings to their defaults; refuse production or an unexpected database;
  and preserve the append-only audit history.

## Screenshots

### Sign-in

| Desktop | Mobile |
| --- | --- |
| <img src="./screenshots/login-desktop.png" alt="AccessHub desktop sign-in page" width="700"/> | <img src="./screenshots/login-mobile.png" alt="AccessHub mobile sign-in page" width="300"/> |

### Admin dashboard

| Light theme | Dark theme |
| --- | --- |
| <img src="./screenshots/dashboard-light.png" alt="AccessHub admin dashboard in light theme" width="700"/> | <img src="./screenshots/dashboard-dark.png" alt="AccessHub admin dashboard in dark theme" width="700"/> |

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router, CSS |
| Backend API | FastAPI, PostgreSQL, SQLAlchemy, JWT authentication |
| Deployment | Vercel, Render |
| DevOps / Tooling | Docker, GitHub Actions, Git, GitHub |

## Quick Start

Clone the repository:

```bash
git clone https://github.com/Iris408/accesshub
cd accesshub
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
VITE_API_URL=https://mini-user-api.onrender.com
VITE_DEMO_API_URL=https://accesshub-demo-api.onrender.com
```

Run locally:

```bash
npm run dev
```

Build check:

```bash
npm run build
```

## Documentation

More detailed project documentation is available in the `docs/` folder.

| Document | Description |
| --- | --- |
| [Setup Guide](./docs/setup.md) | Local setup, environment variables, build commands, and the isolated public demo |
| [Auth Flow](./docs/auth-flow.md) | JWT login, token storage, protected routes, and admin-only access |
| [Frontend Notes](./docs/frontend-notes.md) | Pages, UI behaviour, routing, loading states, and frontend improvements |
| [Project Details](./docs/project-details.md) | Architecture, related backend, limitations, future improvements, and learning notes |
| [CI Notes](./docs/ci.md) | Frontend CI and Docker CI workflow notes |

## Project Summary

AccessHub is a React and TypeScript authentication frontend demonstrating a complete JWT-based authentication and authorisation flow. It integrates with Secure User API to provide protected routing, role-based access, admin-only functionality, authenticated API requests, and production-style deployment using Vercel, Render, Docker, and GitHub Actions CI.

## Author

Built by Iris408