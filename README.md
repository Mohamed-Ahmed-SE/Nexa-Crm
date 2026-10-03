# Nexa CRM

A runnable Next.js App Router foundation for Nexa CRM.

## Requirements

- Node.js 20.19+ (20.x) or 22.12+
- npm

## Setup

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to `/app/dashboard` and provides shared navigation for the Phase 0 CRM shell.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Current scope

This foundation includes the responsive app shell, route-level implementation-stage empty states, TypeScript, Tailwind CSS, ESLint, and Vitest. Authentication, workspace storage, CRM records, metrics, search, notifications, and mutations are not connected yet; no external credentials are required for this slice.
