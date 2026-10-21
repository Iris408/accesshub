# CI Notes

This document describes the automated checks for the AccessHub frontend
repository.

## Workflows

AccessHub has two GitHub Actions workflows:

- **Frontend CI** checks lint, tests and the production build.
- **Docker CI** builds the repository’s Docker image.

Both workflows run on pushes to `main` and on pull requests targeting `main`.

## Frontend CI

The workflow uses Node.js 22 and runs:

```bash
npm ci
npm run lint
npm test
npm run build
```

The build command runs the TypeScript project build and then creates the Vite
production bundle. The test command runs the Vitest suite.

A successful workflow checks that dependencies install, lint passes, tests
pass, TypeScript compiles and the frontend can be built.

## Docker CI

Docker CI builds the image from the repository root:

```bash
docker build -t accesshub .
```

This verifies that the Docker image can be built. It does not deploy the image
or test a connection to either hosted API.

## Running checks locally

From the AccessHub project root:

```bash
npm ci
npm run lint
npm test
npm run build
docker build -t accesshub .
```

Run the frontend checks before pushing changes or opening a pull request.

## Deployment

GitHub Actions validates changes; it does not deploy the frontend or backend.

The frontend is hosted on Vercel. The production and demo APIs are separate
services hosted on Render. Deployment behavior is configured in those hosting
projects, so check their deployment status after merging or pushing changes to
`main`. A green CI result means the repository checks passed; it does not by
itself confirm that a deployment is live or that the frontend can reach the
APIs.

## Maintenance

Keep the workflows aligned with the project’s actual scripts and supported
Node.js version. When adding a check, make sure it can run reliably in GitHub
Actions and document the equivalent local command here.