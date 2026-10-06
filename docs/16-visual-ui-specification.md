# 16 — Visual UI Specification

This document translates the approved Nexa CRM mockups into build rules.

## Goal

The implementation should be visually close enough that a side-by-side comparison with the reference screens clearly feels like the same product.

This means preserving:
- density,
- proportions,
- panel hierarchy,
- toolbar placement,
- card sizing,
- table design,
- badge language,
- icon scale,
- whitespace,
- information hierarchy.

Do not chase pixel-perfect reproduction at the cost of accessibility or responsiveness.

---

# Master Page Grid

Desktop:

```text
┌──────────── Sidebar ───────────┬──────────────────────── Main ─────────────────────────┐
│                               │ Topbar / Global Search / User                         │
│                               ├───────────────────────────────────────────────────────┤
│ Navigation                    │ Page Header                                           │
│                               │ KPI / Filters                                         │
│                               │ Primary Working Surface                               │
│                               │ Supporting Widgets                                    │
└───────────────────────────────┴───────────────────────────────────────────────────────┘
```

Use the same shell for all authenticated screens.

---

# Visual Hierarchy

Level 1:
Page title + primary action

Level 2:
KPI row / primary filters

Level 3:
Main operational table / board / detail body

Level 4:
Supporting charts / recent activity / side rails

The UI should never make the chart more visually important than the work users need to do.

---

# Dashboard

Reference:
`references/01-dashboard.png`

Approximate hierarchy:
1. Header + date
2. KPI row
3. Deals working table
4. Three supporting widgets

Important:
- table occupies the largest operational area
- charts stay compact
- dashboard is useful for action, not just reporting

---

# Leads

Reference:
`references/02-leads.png`

Approximate hierarchy:
1. Page title
2. Add Lead / Import
3. KPI row
4. search/filter bar
5. table
6. insight widgets

Important:
- rows remain compact
- tags can wrap minimally
- status uses dropdown-capable pill when editable
- the entire table should fit a 1440-ish desktop without absurd horizontal scroll

---

# Deals Board

Reference:
`references/03-deals-kanban.png`

Important:
- six columns can horizontally scroll on smaller screens
- each column keeps a consistent width
- cards are compact enough to see multiple deals
- Won and Lost remain visually part of the pipeline but semantically terminal
- pipeline summary at bottom stays short

---

# Deal Detail

Reference:
`references/04-deal-detail.png`

Grid:
- main content ~70%
- right rail ~30%

Top metric strip:
- value
- probability
- expected close
- owner

Primary actions remain visible at top.

Timeline is the dominant card.

---

# Contact Detail

Reference:
`references/05-contact-detail.png`

Top:
- identity card
- quick communication actions

Main:
- recent activity
- notes
- related deals

Right:
- contact properties
- related company
- upcoming task

Avoid treating CRM contacts like social-media profiles.

---

# Tasks

Reference:
`references/06-tasks.png`

Grid:
- task list ~75–80%
- calendar/summary rail ~20–25%

Task list is the primary working surface.

Checkbox and status must remain easy to act on.

---

# Reports

Reference:
`references/07-reports.png`

Use:
- 4 KPI cards
- 2 major charts
- 3 smaller analysis cards
- useful bottom table

Charts use the same restrained visual palette.

---

# Responsive Targets

Desktop reference target:
- 1366–1600px

Laptop:
- 1024–1365px
- collapse secondary information before core information

Tablet:
- 768–1023px
- sidebar collapses
- right rails stack
- board scrolls

Mobile:
- <768px
- tables become compact list/card variants or allow controlled horizontal scroll only where unavoidable
- quick actions remain reachable
