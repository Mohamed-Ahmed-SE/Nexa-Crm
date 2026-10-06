# 19 — Case Study Framework

Nexa CRM is intended to become a real portfolio case study.

The final case study must describe actual product reasoning, implementation, and measured behavior. Do not invent user interviews, revenue impact, customer counts, conversion lifts, or other results that did not happen.

---

# Suggested Case Study Story

## 1. Problem

Many small sales teams manage customer relationships across:
- spreadsheets,
- WhatsApp/chat,
- personal notes,
- email,
- calendars,
- memory.

This creates practical problems:
- leads are forgotten,
- follow-ups are missed,
- history is fragmented,
- team members do not know who owns what,
- managers cannot see pipeline health,
- reporting is manual.

## 2. Product Goal

Create a CRM that helps a team answer:

1. What is happening?
2. What needs attention?
3. What should happen next?

## 3. Product Decisions

Examples to document:
- dashboard is operational, not only analytical
- tables are dense because CRM users manage many records
- every record has a unified timeline
- deal board makes ownership and progression visible
- "needs attention" logic highlights stale/overdue work
- lead conversion avoids duplicate manual entry
- tasks are connected to customer/deal context
- reports use actual sales records

## 4. UX Decisions

Explain:
- why quick create uses sheets
- why detail pages use right property rails
- why filters are near tables
- why status is represented with both text and color
- why the Kanban keeps Won/Lost visible
- why the task page combines a queue with a calendar summary

## 5. Technical Decisions

Document:
- multi-tenant workspace model
- database-level RLS
- role permissions
- transactional lead conversion
- audit/activity events
- server-side filtering and pagination
- business-rule centralization

## 6. Challenges

Keep a real implementation log.

Potential real challenges:
- multi-tenant authorization
- drag-and-drop with optimistic updates
- reusable filtering across several tables
- query performance
- preserving timeline history
- CSV import mapping
- keeping UI compact on smaller screens

Only include challenges that actually occurred.

## 7. Outcome

Before launch, use verifiable engineering outcomes:
- number of implemented workflows
- test coverage / E2E flows
- Lighthouse metrics if measured
- supported responsive widths
- feature completion

After real usage, the case study may include:
- real feedback
- task completion improvement
- reduced missed follow-ups
- adoption
- time saved

Only if actually measured.

---

# Case Study Screenshots

Recommended:
- Dashboard
- Leads
- Deal Kanban
- Deal Detail
- Contact Detail
- Tasks
- Reports
- Mobile view
- Empty state
- Add Lead / Add Deal form

---

# Portfolio Presentation

Suggested order:

1. Hero
2. Context
3. Problem
4. Goals
5. Research / assumptions
6. Information architecture
7. Key user flows
8. Design system
9. Dashboard
10. Leads
11. Pipeline
12. Deal detail
13. Tasks
14. Reports
15. Engineering architecture
16. Security / multi-tenancy
17. Testing
18. Outcome
19. Lessons
20. Next steps

The case study should show product thinking, not only pretty screenshots.
