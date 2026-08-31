# Project Details

This document contains additional technical and architectural notes for AccessHub.

## Architecture

```text
AccessHub
React + TypeScript Frontend
        ↓
Secure User API
FastAPI Backend
        ↓
PostgreSQL Database
```

AccessHub is the frontend interface for the authentication system. Authentication, user data, and role-based permissions are provided by the separately maintained Secure User API backend.

## Frontend

The frontend is built with React, TypeScript, Vite, React Router, and CSS.

Main frontend responsibilities:

- Render the login interface
- Submit user credentials to the backend
- Store the returned JWT access token
- Fetch the authenticated user's profile
- Protect authenticated routes
- Render the main dashboard
- Provide admin-only user access
- Apply role-based UI behaviour
- Handle loading and error states
- Provide logout functionality

## Backend API

AccessHub integrates with Secure User API, a separate FastAPI authentication backend.

The backend provides:

- FastAPI REST API
- PostgreSQL persistence
- SQLAlchemy ORM
- JWT authentication
- Role-based access control
- Protected user profile access
- Admin-only user listing
- Render deployment

Backend repository:

```text
https://github.com/Iris408/mini-user-api
```

## Authentication Flow

At a high level:

```text
User credentials
      ↓
AccessHub login
      ↓
Secure User API
      ↓
JWT access token
      ↓
Authenticated requests
      ↓
Protected / role-based interface
```

AccessHub uses the authenticated user's token when communicating with protected backend endpoints. UI access is then adjusted according to authentication state and user role.

More detailed authentication behaviour is documented in [`auth-flow.md`](./auth-flow.md).

## Deployment

The frontend is deployed on Vercel.

The Secure User API backend is deployed separately on Render.

This demonstrates integration between independently deployed frontend and backend applications.

## Current Limitations

AccessHub is a portfolio authentication project rather than a production identity platform.

Current limitations include:

- Refresh token support is not implemented.
- Token storage uses local storage for demonstration purposes.
- Admin functionality depends on an administrator account existing in the backend.
- Authentication security would require additional hardening for a production application.
- Frontend automated test coverage is currently limited.

These limitations are documented rather than treated as required feature work for the current release.

## Maintenance

AccessHub is feature-complete for its current portfolio scope.

Future work is limited primarily to maintenance and reliability improvements, such as:

- Dependency and security updates
- CI maintenance
- Test coverage improvements
- Authentication security review
- Documentation updates
- Compatibility fixes

New product functionality is outside the current maintenance scope unless the project is intentionally reopened for development.

## Related Project

AccessHub integrates with Secure User API.

Related backend repository:

```text
https://github.com/Iris408/mini-user-api
```

## Learning Outcomes

Through AccessHub, I developed practical experience with:

- React and TypeScript frontend development
- Vite project configuration
- React Router and protected routes
- JWT authentication flows
- Token-based authenticated API requests
- Role-based frontend behaviour
- Admin-only functionality
- Loading and error-state handling
- Frontend/backend integration
- Vercel frontend deployment
- Render backend integration
- Docker
- GitHub Actions CI