# Frontend Notes

This document contains frontend-specific implementation notes for AccessHub.

## Pages

| Page | Route | Description |
| --- | --- | --- |
| Login | `/` | User authentication and demo login interface |
| Dashboard | `/dashboard` | Protected dashboard for authenticated users |
| Admin | `/admin` | Admin-only user list and account overview |

## Main Frontend Responsibilities

The AccessHub frontend handles:

- Login form state
- Authentication requests to Secure User API
- JWT access token storage
- Authenticated profile requests
- Protected route rendering
- Admin-only user requests
- Role-based UI behaviour
- Loading states
- Error handling
- Logout behaviour
- Responsive interface styling

## Project Structure

```text
accesshub/
  src/
    components/
      NavBar.tsx
    pages/
      LoginPage.tsx
      DashboardPage.tsx
      AdminPage.tsx
    App.tsx
    main.tsx
    styles.css
  screenshots/
  docs/
  .github/
  package.json
  vite.config.ts
  README.md
```

## Frontend Implementation

### Authentication

The login page accepts user credentials and sends them to Secure User API.

After successful authentication, the returned JWT access token is stored by the frontend and used for subsequent authenticated API requests.

### Protected Routes

Authenticated areas of AccessHub are protected so that users without an access token cannot access the dashboard or admin interface.

### Role-Based Interface

AccessHub uses authenticated user information to control access to role-specific functionality.

Standard authenticated users can access the protected dashboard, while administrator functionality is restricted to users with the appropriate backend role.

### API Integration

The frontend communicates with the separately deployed Secure User API backend.

API integration includes:

- Authentication requests
- Authenticated profile requests
- Admin-only user listing
- Role validation
- Loading and error-state handling

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

- Refreshed login interface
- Protected dashboard layout
- Admin panel statistics
- User account cards
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