# 15 — Definition of Done

The MVP is ready only when:

## Product

- onboarding works
- dashboard works
- leads work
- contacts work
- companies work
- deal board works
- deal detail works
- tasks work
- timeline works
- notes work
- reports work
- search works
- notifications work
- imports/exports work
- settings work

## UX

- polished populated state
- polished empty state
- loading state
- error state
- mobile state
- keyboard/focus basics
- destructive confirmation
- useful success feedback

## Security

- protected routes
- RLS enabled
- role checks server-side
- no leaked service secret
- workspace isolation verified
- viewer cannot mutate
- admin-only features enforced

## Data

- migrations committed
- seed script committed
- indexes added
- no fake KPI values
- no hardcoded customer rows in UI

## Engineering

- typecheck passes
- lint passes
- tests pass
- critical E2E flows pass
- no obvious console errors
- no broken navigation
- no TODO placeholders for visible MVP actions

## Release

- `.env.example`
- setup instructions
- seed instructions
- deployment instructions
- demo credentials documented safely for local/test only
- implementation decisions recorded
