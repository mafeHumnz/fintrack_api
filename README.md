# FinTrack API

![Tests](https://github.com/mafeHumnz/fintrack_api/actions/workflows/tests.yml/badge.svg)

FinTrack API is a backend application for personal finance management. It allows a user to manage accounts, categories, transactions, budgets, and savings goals through a REST API built with Node.js, Express, TypeScript, Prisma, and PostgreSQL. The project focuses on business rules such as balance reconciliation, credit card handling, budget tracking by category and period, and secure authentication with JWT.

## Overview

The API is designed to help users keep track of personal finances by separating core concerns into clear layers:

- authentication and user access control
- account management
- budget planning
- expenses and income recording
- savings goals
- validation and access control across protected routes

The implementation is organized around the real project structure in `src/app.ts`, `src/routes`, `src/controllers`, `src/services`, `src/repositories`, `src/schemas`, and `src/middlewares`.

---

## Main features

Based on the implementation in the routes and services:

- JWT-based authentication for signup and login
- user registration and login flows with password hashing via bcrypt
- account creation and listing, including credit card support with credit limits
- automatic balance updates for transaction creation, update, and deletion
- credit card validation to prevent balances above the configured limit
- budget creation and tracking by category, month, and year
- budget spent/remaining calculations based on category transactions
- savings goal tracking with target amount, current amount, progress, remaining amount, and days remaining
- validation with Zod schemas for request payloads
- rate limiting for login and registration attempts
- secure headers via Helmet
- Prisma-based persistence with PostgreSQL

---

## Tech stack

### Runtime and framework
- Node.js
- Express
- TypeScript
- tsx (used in development via the dev script)
- Node.js 22 in CI, based on `.github/workflows/tests.yml`

### ORM and database
- Prisma ORM
- PostgreSQL
- @prisma/client
- @prisma/adapter-pg
- pg

### Validation and schema handling
- Zod

### Authentication and security
- JWT via jsonwebtoken
- bcrypt
- Helmet
- express-rate-limit
- cors (present in `package.json`, but not enabled in `src/app.ts`)

### Testing
- Jest
- Supertest
- ts-jest
- cross-env

### API docs
- swagger-jsdoc
- swagger-ui-express

---

## Architecture at a high level

The project is divided into layers to keep the codebase maintainable and testable:

1. Routes
   - resource endpoints live under `src/routes`
   - each route file defines the HTTP path and binds middleware + controller logic
   - example: `src/routes/auth_routes.ts`, `src/routes/account_routes.ts`, `src/routes/transaction_routes.ts`

2. Middlewares
   - auth and validation logic live under `src/middlewares`
   - examples:
     - JWT verification in `src/middlewares/protect_middleware.ts`
     - Zod validation in `src/middlewares/auth_middleware.ts`
     - rate limiting in `src/middlewares/rate_limiters.ts`

3. Controllers
   - HTTP request handling and response shaping live in `src/controllers`
   - controllers validate inputs when needed and delegate business logic to services

4. Services
   - business rules are implemented in `src/services`
   - this is where financial logic lives, such as transaction balance recalculation, budget validation, and goal progress calculations

5. Repositories
   - database access is abstracted in `src/repositories`
   - repositories wrap Prisma operations and keep service logic focused on business rules

6. Prisma
   - Prisma schema configuration is defined in `prisma/schema.prisma`
   - the Prisma client is configured in `src/config/prisma.ts`
   - environment variables are validated in `src/config/env.ts`

This separation makes it easier to:
- enforce security at middleware level
- keep domain logic out of HTTP code
- centralize persistence in repositories
- keep request validation consistent with Zod schemas

---

## Requirements and prerequisites

### Required
- Node.js 22 recommended (matches CI in `.github/workflows/tests.yml`)
- npm
- Docker and Docker Compose
- PostgreSQL (either via Docker or a local instance)

### Optional / local database
- If you do not use Docker, PostgreSQL must be running and reachable through the value in DATABASE_URL.

---

## Installation

1. Clone the repository

```bash
git clone https://github.com/mafeHumnz/fintrack_api.git
cd fintrack_api
```

2. Install dependencies

```bash
npm install
```

3. Create your environment file based on the required variables

Create a file named `.env.development` in the project root with the variables described below, or copy the example file once created.

4. Start PostgreSQL with Docker

```bash
docker compose up -d
```

This starts the database defined in `docker-compose.yml` and exposes it on port 5433.

---

## Environment variables

The application validates its environment variables in `src/config/env.ts`.

Required variables:

- `NODE_ENV`
  - expected values: development, production, test
  - default: development if not provided

- `PORT`
  - HTTP server port
  - default: 3000

- `DATABASE_URL`
  - PostgreSQL connection string used by Prisma
  - required for all environments

- `JWT_SECRET`
  - secret used to sign and verify JWTs
  - must be at least 8 characters long

Important:
- the app loads the file matching `.env.${NODE_ENV}` through dotenv
- example file naming pattern: `.env.development`, `.env.production`, `.env.test`

### Example env file
A project root example file should contain:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5433/fintrack_dev
JWT_SECRET=your_super_secret_key_here
```

---

## .env.example

The project root `.env.example` file contains:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5433/fintrack_dev
JWT_SECRET=your_super_secret_key_here
```

---

## Running the API in development

Use the script defined in `package.json`:

```bash
npm run dev
```

This runs:

```bash
tsx watch src/server.ts
```

The server starts through `src/server.ts` and reads its configuration from `src/config/env.ts`.

---

## Running with Docker

The project includes a Docker setup in `docker-compose.yml`:

- a PostgreSQL 17 service named `postgres`
- an app service named `app`
- database credentials:
  - POSTGRES_USER=postgres
  - POSTGRES_PASSWORD=password
  - POSTGRES_DB=fintrack_dev
- app port mapping:
  - 3000:3000
- database port mapping:
  - 5433:5432

To start the full stack:

```bash
docker compose up --build
```

To stop it:

```bash
docker compose down
```

The `app` service uses `.env.production` as an env file and passes:
- `DATABASE_URL`
- `JWT_SECRET`

at build time through Docker args.

---

## Database configuration and Prisma migrations

The Prisma schema is defined in `prisma/schema.prisma`.

### Generate Prisma client

```bash
npx prisma generate
```

or via the script:

```bash
npm run prisma:generate
```

### Run Prisma migrations in development

```bash
npx prisma migrate dev
```

or:

```bash
npm run prisma:migrate
```

Use this when you are developing locally and want Prisma to create or apply new migrations in your local database.

### Apply migrations in non-interactive/CI environment

```bash
npx prisma migrate deploy
```

This is the command used in `.github/workflows/tests.yml` for CI. Use it for deployment or test environments where you want to apply existing migrations without creating new dev migrations.

### Prisma Studio

```bash
npx prisma studio
```

or:

```bash
npm run prisma:studio
```

---

## Running tests

The project test command defined in `package.json` is:

```bash
npm test
```

This runs:

```bash
cross-env NODE_OPTIONS=--experimental-vm-modules jest --config jest.config.cjs --runInBand
```

### Running a specific integration test

This project uses integration tests under the tests folder, and the repository commonly runs them by path using Node options. For example:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --config jest.config.cjs --runInBand --runTestsByPath tests/integration/accounts/account.create.integration.test.ts
```

Use this pattern to run a specific test file when debugging or validating one scenario.

---

## Available scripts

Based on `package.json`:

| Script | Command | Purpose |
|---|---|---|
| dev | `tsx watch src/server.ts` | Run the API in development mode with live reload |
| build | `tsc` | Compile the TypeScript project |
| start | `node dist/src/server.js` | Start the built application |
| test | `cross-env NODE_OPTIONS=--experimental-vm-modules jest --config jest.config.cjs --runInBand` | Run the test suite |
| prisma:generate | `prisma generate` | Generate the Prisma client |
| prisma:migrate | `prisma migrate dev` | Apply Prisma migrations in development |
| prisma:studio | `prisma studio` | Open the Prisma Studio GUI |

---

## Authentication

Authentication is implemented through JWT and protected middleware.

### Registration
The auth routes are defined in `src/routes/auth_routes.ts`.

- `POST /auth/register`
- validates name, email, and password with Zod
- checks whether the user already exists
- hashes the password with bcrypt
- creates the user in Prisma

### Login
- `POST /auth/login`
- validates email and password
- queries the user by email
- compares the supplied password with the stored bcrypt hash
- generates a JWT through `src/utils/generateToken.ts`
- returns the token to the client

### Protected routes
Routes under accounts, categories, transactions, budgets, and goals use the middleware from `src/middlewares/protect_middleware.ts`. The middleware:

- reads the Authorization header
- expects a Bearer token
- verifies the JWT using JWT_SECRET
- injects the authenticated user id into req.user

Example usage:

```http
Authorization: Bearer <token>
```

The token expiry is set to 1 hour in `src/utils/generateToken.ts`.

---

## Main API resources

This API exposes several resource groups:

### Auth
- user registration
- user login
- JWT issuance

### Accounts
- create, list, get by id, update, and delete accounts
- supports balance tracking
- supports credit card accounts and credit limits
- summary endpoint exposes net worth and per-account credit usage details

### Transactions
- create, list, get by id, update, and delete transactions
- updates account balance automatically
- validates insufficient funds and credit limits
- keeps account totals consistent with each transaction

### Budgets
- create budgets by category and period
- list all budgets for a user
- compute spent and remaining amounts by category and month/year
- prevent duplicate budgets for the same category and period

### Goals
- create savings goals
- list and read goals with progress metrics
- update goal values while maintaining target constraints
- calculate progress, remaining amount, and days remaining

---

## Security

The project includes several security measures in actual code:

- Helmet
  - enabled in `src/app.ts`
  - adds HTTP response headers for basic hardening

- Rate limiting
  - implemented in `src/middlewares/rate_limiters.ts`
  - login and registration are limited separately
  - a global limiter is also applied

- Zod validation
  - used across schema files in `src/schemas`
  - validates data before hitting business logic

- bcrypt hashing
  - passwords are hashed during registration in `src/services/auth_service.ts`

- Timing-attack mitigation
  - login uses a dummy bcrypt hash when no user is found, which reduces the difference in response timing between valid and invalid credentials

- JWT authentication
  - token validation is enforced by `src/middlewares/protect_middleware.ts`

Note:
- CORS is listed in `package.json`, but it is not currently enabled in `src/app.ts`.

---

## CI / GitHub Actions

The GitHub Actions workflow in `.github/workflows/tests.yml` runs on:

- push to main
- pull request to main

What it does:
1. checks out the repository
2. sets up Node.js 22
3. installs dependencies with npm ci
4. generates the Prisma client
5. runs Prisma migrations with `npx prisma migrate deploy`
6. executes the test suite with `npm test`

This workflow also starts a PostgreSQL 17 service using a test database so the tests can run against a real database.

---

## Swagger documentation

This project includes Swagger generation via swagger-jsdoc in `src/config/swagger.ts`, and the OpenAPI spec is exposed through Swagger UI in `src/app.ts`.

The UI is mounted at:

```text
/api-docs
```

When the server is running locally, open:

```text
http://localhost:3000/api-docs
```

---

## License


- License: MIT

---

## Contributing

This project is a portfolio/backend learning project, so contributions are welcome if you want to extend functionality or improve code quality. Before making changes:

1. create a feature branch
2. keep logic aligned with the current layered structure
3. validate with the existing tests
4. document any new API behavior or schema changes

---

## Quick reference

### Development
```bash
npm install
npm run dev
```

### Database
```bash
docker compose up -d
npx prisma generate
npx prisma migrate dev
```

### Tests
```bash
npm test
```

### Docker
```bash
docker compose up --build
```

---
