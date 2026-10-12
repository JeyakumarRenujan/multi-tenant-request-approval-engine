# Multi-Tenant Client Request & Approval Workflow Engine

A multi-tenant request and approval workflow engine built with Node.js, Express, TypeScript, PostgreSQL, Prisma, React, and Tailwind CSS.

## Project Structure
- `/backend`: Node.js + Express + TypeScript + Prisma API
- `/frontend`: React + TypeScript + Vite + Tailwind CSS application

## Core Security & Architecture Principles
1. **Never trust client-supplied tenant context**: Organization and role claims are derived strictly from verified JWTs and the database.
2. **Strict data isolation**: Every tenant query is scoped by `organizationId`. Client users are scoped by `clientId`.
3. **No information leakage**: Cross-tenant requests return `404 Not Found` (never `403 Forbidden`).
4. **Environment variables**: Secrets are isolated in `.env` files and never committed to source control.

## Setup

### 1. Prerequisites
- **Node.js**: 20+
- **PostgreSQL**: 16

### 2. Database Initialization
Create a PostgreSQL database named `request_engine`:
```sql
CREATE DATABASE request_engine;
```

### 3. Environment Configuration
Copy the backend and frontend example environment files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
Update `DATABASE_URL` in `backend/.env` with your PostgreSQL username and password:
```env
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/request_engine?schema=public"
```

### 4. JWT Secret Generation
Generate cryptographically strong secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Paste the generated values into `backend/.env`.

### 5. Running the Application
**Backend**:
```bash
cd backend
npm install
npx prisma migrate deploy
npm run build
npm start
```

**Frontend**:
```bash
cd frontend
npm install
npm run build
npm run dev
```

## Known Limitations & Security Trade-Offs

### Token Storage Trade-Off
- **Access Token**: Stored strictly in-memory (`memoryAccessToken`), never persisted to `localStorage` or `sessionStorage`. This shields the access token from persistent XSS extraction and disk inspection.
- **Refresh Token in SessionStorage**: Stored in `sessionStorage` to allow transparent token refresh during page navigation and tab lifecycles when `httpOnly` cookies are unavailable across separate host ports.
  - *Trade-off*: Although `sessionStorage` is accessible by client JavaScript (and therefore subject to in-session XSS risks), it is isolated to the active browser tab session and cleared upon tab closure. Single-use refresh token rotation and revocation on reuse mitigate replay attacks.
  - *Production Recommendation*: Set `httpOnly`, `Secure`, `SameSite=Strict` cookies for refresh tokens via a reverse proxy or unified domain.

### State Machine Workflow & Terminal States
- **Terminal States**: `REJECTED` and `COMPLETED` are terminal states in the approval workflow state machine. Once a request reaches `REJECTED` or `COMPLETED`, no further state transitions are permitted to guarantee non-repudiation and immutable audit histories.
- **Optimistic Locking**: Every mutation increments the entity `version` counter and validates `expectedVersion` in atomic transactions (`WHERE id = :id AND version = :expectedVersion`), rejecting concurrent conflicts with `409 CONFLICT`.

> [!NOTE]
> Any default credentials in `.env.example` are intended strictly for local development. Never commit real passwords, production secrets, or actual credentials to source control.
