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

