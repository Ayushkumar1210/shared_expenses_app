# FairShare: Shared Expenses & CSV Import Anomaly Checker

A production-ready Shared Expenses App built with React, Vite, Node.js, Express, TypeScript, and Prisma (PostgreSQL).

## Project Overview

FairShare allows flatmates to track shared expenses, record debt settlements, optimize payments via debt simplification, and upload spreadsheets with built-in validation checking for 15 distinct anomaly rules.

### Key Features
1.  **JWT Authentication**: Secure registration, login, and protected routes.
2.  **Dynamic Group Timelines**: Tracks member arrivals and departures (`joinedAt` and `leftAt`). Ensures users are only included in calculations during their active membership.
3.  **Advanced Splitting**: Supports Equal, Exact, Percentage, and Weighted splits with penny rounding corrections.
4.  **Staged CSV Import**: Upload, parse, audit, and approve CSV imports. Detects duplicate bills, mismatched names, date format ambiguities, and chronological violations.
5.  **Audit Explainability**: Provides full computation logs showing exactly why a user's balance was calculated a certain way.

---

## Folder Structure

```
├── backend/                # Node.js + Express API
│   ├── prisma/             # Prisma schema, seeds, and migrations
│   ├── src/                # Backend TypeScript source files
│   └── tests/              # Backend integration and unit tests
├── frontend/               # React + Vite Client
│   ├── src/                # React components, pages, context, styles
│   └── index.html          # Main HTML template
└── package.json            # Root setup scripts
```

---

## Setup Instructions

### Prerequisites
*   Node.js (v18+)
*   PostgreSQL database instance (e.g. Neon, local container, or direct install)

### 1. Project Installation
Install all root, backend, and frontend dependencies:
```bash
npm run install:all
```

### 2. Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```bash
# In backend/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shared_expenses?schema=public"
JWT_SECRET="super-secret-jwt-key"
PORT=3001
```

### 3. Database Setup & Seeding
Create migrations and seed the database with the default flatmates (Aisha, Rohan, Priya, Meera, Dev, Sam) and their membership timeline:
```bash
# Inside the backend/ folder:
npx prisma db push
npm run prisma:seed
```

---

## Running Locally

To run both the backend server and frontend client concurrently:
```bash
npm run dev
```
*   **Frontend**: http://localhost:5173 (proxied to API)
*   **Backend**: http://localhost:3001

---

## Running Automated Tests

To execute unit and integration tests written with Vitest for splits, timelines, and anomaly checking:
```bash
# Inside the backend/ folder:
npm run test
```
