# FinTrack API

Personal finance management API built with Node.js, Express, TypeScript, Prisma, PostgreSQL and Docker.

## Overview

FinTrack API is a backend application designed to help users manage their personal finances. The system allows users to track income, expenses, accounts, categories, budgets and financial transactions in a structured way.

This project is being developed in phases following a professional backend workflow and architecture.

---

## Features

Current:

* Authentication with JWT
* Environment configuration for development and production
* PostgreSQL database integration
* Prisma ORM setup
* Docker support
* Input validation
* Swagger API documentation

Planned:

* User management
* Financial accounts
* Transactions
* Categories
* Budgets
* Financial reports
* Stored procedures
* Analytics

---

## Tech Stack

Backend:

* Node.js
* Express
* TypeScript

Database:

* PostgreSQL
* Prisma ORM

Infrastructure:

* Docker
* Docker Compose

Authentication:

* JWT
* bcrypt

Validation:

* Zod
* express-validator

Documentation:

* Swagger

---

## Project Structure

```text
fintrack_api/

├── src/
│   ├── config/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── middlewares/
│   └── server.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docs/
│
├── .env.example
├── docker-compose.yml
├── tsconfig.json
├── prisma.config.ts
└── package.json
```

## Environment Variables

Create:

```env
.env.development
```

Example:

```env
NODE_ENV=development

PORT=3000

DATABASE_URL=postgresql://postgres:password@localhost:5433/fintrack_dev

JWT_SECRET=your_secret_key
```

---

## Installation

Clone repository:

```bash
git clone https://github.com/mafeHumnz/fintrack_api.git
```

Enter project:

```bash
cd fintrack_api
```

Install dependencies:

```bash
npm install
```

Start PostgreSQL container:

```bash
docker compose up -d
```

Generate Prisma client:

```bash
npx prisma generate
```

Run migrations:

```bash
npx prisma migrate dev
```

Run development server:

```bash
npm run dev
```

---

## Available Scripts

```bash
npm run dev
npm run build
npm start

npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

---

## Development Workflow

This project follows a branch strategy:

```text
main
└── feature/*
```

Examples:

```text
feature/auth-jwt
feature/user-module
feature/transaction-module
```

---

## Author

Maria Humanez Barrera
