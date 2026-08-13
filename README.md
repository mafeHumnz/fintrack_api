# FinTrack API

![Tests](https://github.com/mafeHumnz/fintrack_api/actions/workflows/tests.yml/badge.svg)

FinTrack API is a RESTful backend for personal finance management. It provides JWT-based authentication and CRUD operations for accounts, transactions, categories, budgets and savings goals, with business rules for balance synchronization and budget tracking.

## Tech Stack

- **Runtime:** Node.js, `ts-node`/`tsx`
- **Framework:** Express
- **Language:** TypeScript
- **Database:** PostgreSQL (via Prisma)
- **Validation:** Zod
- **Auth / Security:** JSON Web Tokens (jsonwebtoken), `bcrypt` for password hashing, `helmet` for secure headers
- **Rate limiting:** express-rate-limit
- **Testing:** Jest, Supertest
- **Docs:** swagger-jsdoc, swagger-ui-express

## Key Features

- Authentication with JWT (`/auth/register`, `/auth/login`).
- Account management with support for `CREDIT_CARD` accounts and `creditLimit`.
- Transactions that automatically update account balances (create, update and delete adjust balances inside a DB transaction).
- Budget per category and period with spent/remaining calculations.
- Savings goals with progress, remaining amount and days remaining calculations.
- Input validation using Zod schemas.
- Global and endpoint-specific rate limiting (login/register limits).
- Secure HTTP headers via Helmet.
- Timing-attack mitigation in login using a constant dummy bcrypt hash.

## Environment variables

The application validates these environment variables in `src/config/env.ts` — set them in your `.env.*` file (do not commit secrets):

- `NODE_ENV` (development | production | test)
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`

## Quickstart (local)

Clone the repo:

```bash
git clone https://github.com/mafeHumnz/fintrack_api.git
cd fintrack_api
```

Install dependencies:

```bash
npm install
```

Start the database (Docker Compose):

```bash
docker compose up -d
```

Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Run the development server:

```bash
npm run dev
```

## Running tests

Run the test suite with the project script:

```bash
npm test
```

## API Endpoints

All routes (except `/auth`) require a Bearer JWT token.

**Auth**

| Method | Path | Description |
|---|---:|---|
| POST | /auth/register | Create a new user (validates and hashes password) |
| POST | /auth/login | Authenticate user and return JWT (mitigates timing attacks) |

**Accounts**

| Method | Path | Description |
|---|---:|---|
| POST | /accounts | Create account (supports `creditLimit` for credit cards) |
| GET | /accounts | List user's accounts |
| GET | /accounts/summary | Net worth and per-account credit info (`availableCredit`, `creditUsage`) |
| GET | /accounts/:id | Get account by id |
| PATCH | /accounts/:id | Update account (type/creditLimit validations) |
| DELETE | /accounts/:id | Delete account (prevents deletion when transactions exist) |

**Transactions**

| Method | Path | Description |
|---|---:|---|
| POST | /transactions | Create transaction — updates account balance in a DB transaction and validates credit/insufficient funds |
| GET | /transactions | List user's transactions |
| GET | /transactions/:id | Get transaction by id |
| PATCH | /transactions/:id | Update transaction — handles moving between accounts and balance reconciliation |
| DELETE | /transactions/:id | Delete transaction — reverses its effect on the account balance |

**Categories**

| Method | Path | Description |
|---|---:|---|
| POST | /categories | Create a category |
| GET | /categories | List categories |
| GET | /categories/:id | Get category by id |
| PATCH | /categories/:id | Update category |
| DELETE | /categories/:id | Delete category |

**Budgets**

| Method | Path | Description |
|---|---:|---|
| POST | /budgets | Create budget (one per category+period enforced) |
| GET | /budgets | List budgets with `spent` and `remaining` calculations |
| GET | /budgets/:id | Get budget with `spent` and `remaining` |
| PATCH | /budgets/:id | Update budget (validates duplicates by category+period) |
| DELETE | /budgets/:id | Delete budget |

**Goals (Savings)**

| Method | Path | Description |
|---|---:|---|
| POST | /goals | Create a savings goal |
| GET | /goals | List goals (includes `progress`, `remaining`, `daysRemaining`) |
| GET | /goals/:id | Get goal summary by id |
| PATCH | /goals/:id | Update goal (validates target/current amounts) |
| DELETE | /goals/:id | Delete goal |

## Project structure (src)

- `src/config/` — environment and Prisma client configuration
- `src/routes/` — Express route definitions (one file per resource)
- `src/controllers/` — HTTP handlers that call services and handle responses
- `src/services/` — Business logic (accounts, transactions, budgets, goals) and transactional operations
- `src/repositories/` — Data access wrappers around Prisma client
- `src/schemas/` — Zod validation schemas for request payloads
- `src/middlewares/` — Auth (`authenticateToken`), validation (`validateSchema`), and rate limiters
- `src/utils/` — small helpers (e.g., token generation)
- `src/generated/` — Prisma generated client types
- `src/types/` — Custom typing to attach authenticated user data to requests (req.user) in Express.

## Security

- Secure headers: `helmet()` is enabled in `src/app.ts`.
- Rate limiting: global limiter plus login/register-specific limiters are implemented in `src/middlewares/rate_limiters.ts`.
- Input validation: request bodies are validated with Zod (`src/schemas/*` + `validateSchema`).
- Password hashing: `bcrypt` is used to hash passwords on registration.
- Timing-attack mitigation: login uses a constant dummy bcrypt hash when user is not found to keep response time consistent.
- JWT authentication: `authenticateToken` middleware validates tokens and injects `req.user`.

Note: `cors` is listed in `package.json` but not enabled in `src/app.ts`.

## License & Author

- **License:** This is a personal project. All rights are reserved. Copying or distribution of the code is not permitted.
- **Author:** Maria Humanez Barrera

---
