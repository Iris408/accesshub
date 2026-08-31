# CI Notes

This document explains the continuous integration checks used by AccessHub.

## Current CI Workflows

AccessHub includes two GitHub Actions workflows:

- Frontend CI
- Docker CI

These workflows validate the frontend application and container configuration when changes are made to the repository.

## Frontend CI

Frontend CI checks include:

- Checking out the repository
- Setting up Node.js
- Installing frontend dependencies
- Running TypeScript and build checks
- Confirming the Vite frontend builds successfully

This helps catch dependency, TypeScript, and build issues before changes are considered complete.

## Docker CI

Docker CI checks include:

- Checking out the repository
- Building the Docker image
- Validating the Docker configuration
- Confirming the container build completes successfully

This helps ensure AccessHub remains buildable as a container after repository changes.

## Why CI Matters

Continuous integration provides automated validation as the project is maintained.

The current workflows help confirm that:

- Frontend dependencies install successfully
- React and TypeScript code builds successfully
- The Vite production build remains valid
- Docker configuration remains buildable
- Maintenance changes do not introduce obvious build failures

## Deployment

AccessHub is deployed on Vercel and integrates with Secure User API deployed on Render.

Deployment is currently separate from the GitHub Actions CI workflows.

The repository therefore describes its automation as **CI**, rather than CI/CD.

## Maintenance

The current CI workflows cover the core build-validation requirements for AccessHub.

Future maintenance may include:

- Frontend test integration
- Authentication flow tests
- Route rendering tests
- Dependency and security checks
- Coverage reporting

Automated deployment is not part of the current AccessHub maintenance scope.