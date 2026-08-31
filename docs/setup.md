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

## Demo Account

Use the demo account shown on the AccessHub login page:

```text
Username: testuser
Password: password123
```

The connected backend must contain an administrator account for the admin panel to retrieve protected user data successfully.

## Backend Dependency

AccessHub integrates with Secure User API.

Backend repository:

```text
https://github.com/Iris408/mini-user-api
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