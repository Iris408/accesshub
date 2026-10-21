# Setup Guide

This guide explains how to install, configure and run the AccessHub frontend.

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

Create a `.env.local` file in the **project root**—the same folder as `package.json`. Do not put it in `src/`.

For the deployed APIs:

```env
VITE_API_URL=https://mini-user-api.onrender.com
VITE_DEMO_API_URL=https://accesshub-demo-api.onrender.com
```

`VITE_API_URL` is the regular API used for username-and-password sign-in. `VITE_DEMO_API_URL` is optional and enables the **Use demo account** button.

For a local production API:

```env
VITE_API_URL=http://127.0.0.1:8002
```

The demo API can point to a separately running demo backend, or to the hosted demo API if you intend to use that shared demo.

These values are base URLs: include `https://` or `http://`, but do not add a comma, `localhost` by itself, or an endpoint path such as `/demo/session`. Keep `.env.local` out of Git.

After changing environment variables, restart the local development server. Vite reads them when it starts. In Vercel, save the variables in the project’s Environment Variables settings and redeploy for the changes to take effect.

## Run Locally

Start the development server:

```bash
npm run dev
```

Vite prints the local address in the terminal, usually:

```text
http://localhost:5173
```

To choose a specific port:

```bash
npm run dev -- --host 0.0.0.0 --port 5175
```

The frontend will then be available at:

```text
http://localhost:5175
```

## Build Check

Run:

```bash
npm run build
```

This type-checks and builds the React, TypeScript and Vite frontend.

## Demo

AccessHub does not display or ship demo credentials. The **Use demo account** button appears only when a separate demo API is configured with `VITE_DEMO_API_URL`.

- The demo API must be a separate deployment with its own database. It must run with `APP_ENV=demo`, use its own `SECRET_KEY`, and be seeded as described in the backend [Setup Guide](https://github.com/Iris408/secure-user-api/blob/main/docs/setup.md#seeding-the-demo-database-on-render).
- The button calls `POST /demo/session` on the demo API without a username or password. All requests made during that demo session go only to the demo API. Regular sign-ins continue to use `VITE_API_URL`.
- The demo API refuses to start a demo session if its database contains a non-demo account. The button is hidden when the demo URL is unset or matches the regular API URL.
- The hosted demo is shared. Changes made during a demo session can affect what later visitors see. A reset process is on the maintenance backlog; running the seed command again does not reset changed settings or permissions.

If the demo button does not appear, check that `VITE_DEMO_API_URL` is set in the project root or Vercel settings and points to the separate demo API. For local development, restart the Vite server after changing the value.

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

The frontend and backend are deployed independently:

```text
AccessHub frontend (Vercel)
        ↓
Secure User API (Render)
        ↓
PostgreSQL
```

The frontend’s `VITE_API_URL` and optional `VITE_DEMO_API_URL` determine which API receives its requests. The demo API uses a separate database from the production API.