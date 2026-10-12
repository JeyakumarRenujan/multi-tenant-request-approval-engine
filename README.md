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
Copy the backend example environment file to `.env`:
```bash
cp backend/.env.example backend/.env
```
Update `DATABASE_URL` in `backend/.env` with your own PostgreSQL username and password:
```env
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/request_engine?schema=public"
```

### 4. JWT Secret Generation
Generate cryptographically strong secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Paste the generated values into `backend/.env`.

> [!NOTE]
> Any default credentials in `.env.example` are intended strictly for local development. Never commit real passwords, production secrets, or actual credentials to source control.
