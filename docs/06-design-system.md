# 06 — Design System

This is the canonical visual system for Nexa CRM.

Primary references:
- `references/01-dashboard.png`
- `references/02-leads.png`
- `references/03-deals-kanban.png`
- `references/04-deal-detail.png`
- `references/05-contact-detail.png`
- `references/06-tasks.png`
- `references/07-reports.png`

---

# Design Character

Nexa CRM should feel:

- premium,
- calm,
- precise,
- lightweight,
- trustworthy,
- data-dense without feeling crowded,
- modern but not trendy for the sake of trend.

It should resemble a polished B2B SaaS application rather than a generic admin template.

Avoid:
- oversized cards,
- heavy gradients,
- glassmorphism,
- neon effects,
- excessive shadows,
- oversized typography,
- floating blobs,
- decorative animations,
- huge empty spaces,
- low-density layouts that make users scroll unnecessarily.

---

# Layout Tokens

## App frame

Desktop:
- full-height viewport
- subtle cool-gray outer canvas
- white app surface
- left sidebar ~240px
- topbar ~56–64px
- content padding ~20–28px

## Content

Use dense but breathable composition.

Recommended spacing rhythm:
- 4
- 6
- 8
- 12
- 16
- 20
- 24
- 32

Most cards should use:
- 16–20px internal padding

## Border radius

- inputs/buttons: 8–10px
- cards: 10–14px
- large panels: 12–16px
- pills: fully rounded or ~9999px

Avoid exaggerated 24–32px radii.

---

# Colors

Use semantic CSS variables.

Suggested light theme baseline:

```css
--background: 220 20% 97%;
--surface: 0 0% 100%;
--foreground: 224 35% 12%;
--muted-foreground: 218 12% 48%;
--border: 220 18% 90%;
--input: 220 18% 90%;
--primary: 222 89% 58%;
--primary-foreground: 0 0% 100%;
--success: 153 65% 42%;
--warning: 38 92% 55%;
--danger: 0 78% 62%;
--info: 214 90% 60%;
--purple: 262 83% 66%;
```

Exact values may be tuned visually to the references.

Important:
- use color softly in icon backgrounds and pills,
- do not flood cards with saturated color,
- keep the primary content neutral.

---

# Typography

Recommended:
- Geist or Inter

Weights:
- regular 400
- medium 500
- semibold 600
- bold 700 sparingly

Typical scale:
- page title: 24–30
- section title: 15–18
- body: 13–15
- table body: 12–14
- metadata: 11–12
- KPI value: 24–32

The references use compact product typography, not marketing-page typography.

---

# Icons

Use one consistent icon set, preferably Lucide.

Rules:
- 16px common
- 18–20px in navigation
- 20–22px inside KPI icon containers
- no mixed filled/outline families unless intentional
- icon color follows semantic context

---

# Sidebar

Visual behavior:
- white / very light surface
- thin right divider
- compact nav items
- active route uses light blue background and small blue accent
- muted section labels
- badges aligned right
- no oversized icons

Hover:
- subtle neutral background

Active:
- blue-tinted background
- stronger icon/text
- optional 2px accent bar

---

# Topbar

- clean white background
- thin bottom border
- centered/available-space global search
- compact notification icon
- avatars
- user profile menu

The topbar should feel integrated, not like a second navigation bar.

---

# Cards

Core card:
- white surface
- 1px border
- low/no shadow
- 10–14px radius

KPI card:
- small icon container
- small label
- large metric
- small trend line
- overflow only when meaningful

Avoid a card-within-card hierarchy unless information structure benefits.

---

# Buttons

## Primary

- near-black/navy or brand blue depending context
- white label
- strong contrast
- medium height ~36–40px

Examples:
- Add Lead
- Add Deal
- Add Task
- Save

## Secondary

- white
- border
- neutral text

## Destructive

- soft red / destructive fill for strong actions
- confirmation required

## Success

Used for actions such as Mark Won, where the semantic distinction is useful.

---

# Inputs

- 36–40px default height
- 8–10px radius
- white background
- thin gray border
- strong focus ring
- placeholder clearly secondary

Selects and date pickers should visually match inputs.

Search inputs often include:
- leading search icon
- optional command shortcut

---

# Status Pills

Compact rounded pills.

Examples:

Lead:
- New: neutral/blue-gray
- Contacted: amber
- Qualified: blue
- Unqualified: red
- Converted: green

Deal:
- Discovery: gray
- Qualified: blue
- Proposal: amber
- Negotiation: purple
- Won: green
- Lost: red

Task priority:
- Low: green/blue soft
- Medium: amber
- High: red

Task state:
- Not Started: neutral
- Pending: amber
- In Progress: blue
- Completed: green
- Cancelled: gray/red

Color supports text; it never replaces text.

---

# Tables

Tables are a major identity of the product.

Visual rules:
- compact row height
- subtle row separators
- very light header background
- sticky header optional on long pages
- checkbox column narrow
- icons/avatars small
- text truncates gracefully
- right actions via ellipsis
- selected rows visibly but softly highlighted

Header controls:
- Search
- Filters
- Saved View
- Sort
- Export
- Create

Pagination:
- left: page size + count
- center/right: page numbers
- optional direct page field

Tables must not horizontally explode on standard laptop widths.

---

# Kanban

Column:
- very subtle tinted background
- thin border
- small color accent at top
- stage header
- total amount
- deal count

Card:
- white
- thin border
- ~10px radius
- no giant shadow
- title
- company
- value
- close date
- owner
- priority/attention pill

Drag state:
- elevate slightly
- strong drop target
- preserve compact layout

---

# Charts

Charts are clean and secondary.

Use:
- soft brand palette
- minimal axes
- light grid lines
- compact legends
- tooltips
- no 3D
- no excessive gradients

Charts must represent real queries.

---

# Timeline

Use:
- vertical guide line
- small semantic activity icon
- title
- one-line or two-line description
- timestamp
- user avatar/name
- overflow menu if editable

System events should appear visually neutral but trustworthy.

---

# Right Rails

Detail pages may use a 320–380px right rail.

Cards:
- properties
- primary contact
- files
- next task

Rows should be compact label/value pairs.

---

# Empty States

Empty state should be simple:
- small icon
- one sentence
- one primary action
- optional secondary import action

No giant illustrations required.

---

# Loading States

Use skeletons matching the final geometry:
- KPI skeleton cards
- table rows
- detail property rows
- chart skeleton blocks

Avoid global spinners for pages when partial skeletons work.

---

# Motion

- 120–220ms
- subtle opacity/position
- no page-wide cinematic transitions
- reduced-motion supported

---

# Dark Mode

Not required for MVP.

If added later:
- design it fully
- do not auto-invert
- preserve stage/status meaning and contrast
