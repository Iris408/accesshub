# Setup Guide

This document explains how to run AccessHub locally.

## Installation

Clone the repository:

```bash
git clone https://github.com/Iris408/accesshub
cd accesshub
```

Install dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_API_URL=https://mini-user-api.onrender.com
```

For local backend testing, use the local Secure User API URL:

```env
VITE_API_URL=http://127.0.0.1:8002
```

Never commit real `.env` files or secrets to GitHub.

## Run Locally

Start the development server:

```bash
npm run dev
```

For local testing on a specific port:

```bash
npm run dev -- --host 0.0.0.0 --port 5175
```

The frontend is then available at:

```text
http://localhost:5175
```

## Build Check

Run:

```bash
npm run build
```

This verifies that the React, TypeScript, and Vite frontend builds successfully.

## Public Demo

AccessHub never shows or ships demo credentials. The sign-in page offers
**Use demo account** only when a separate, isolated demo API is configured:

```env
VITE_API_URL=https://your-production-api.example.com
VITE_DEMO_API_URL=https://your-demo-api.example.com
```

- The demo API must be its own deployment with its own database, running
  with `APP_ENV=demo` and seeded with `python -m scripts.seed_demo_users`
  (124 synthetic users plus the `adminDemoUser` demo admin). It also needs its own
  `SECRET_KEY`, different from production.
- **Use demo account** calls `POST /demo/session` on the demo API — no
  username or password is involved — and the session's requests then go only
  to that API. Real sign-ins always use `VITE_API_URL`.
- The demo API refuses demo sessions whenever its database contains any
  non-demo account, and the button is hidden if `VITE_DEMO_API_URL` is unset
  or equal to `VITE_API_URL`.

Without `VITE_DEMO_API_URL` the button is not shown; sign in with an account
created by an administrator.

## Backend Dependency

AccessHub integrates with Secure User API.

Backend repository:

```text
https://github.com/Iris408/secure-user-api
```

Live backend Swagger documentation:

```text
https://mini-user-api.onrender.com/docs
```

## Deployment Architecture

The deployed application uses:

```text
AccessHub
Vercel Frontend
      ↓
Secure User API
Render Backend
      ↓
PostgreSQL
```

The frontend and backend are deployed independently and communicate through the configured `VITE_API_URL`.