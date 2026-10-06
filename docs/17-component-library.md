# 17 — Component Library

Codex should build a reusable CRM component system rather than page-specific duplicates.

## App Structure Components

- `AppShell`
- `Sidebar`
- `SidebarSection`
- `SidebarItem`
- `Topbar`
- `GlobalSearchTrigger`
- `UserMenu`
- `NotificationButton`
- `PageContainer`
- `PageHeader`

## Data Display

- `MetricCard`
- `EntityAvatar`
- `StatusPill`
- `PriorityPill`
- `TagChip`
- `PropertyRow`
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `Pagination`

## Table System

- `DataTable`
- `TableToolbar`
- `ColumnVisibilityMenu`
- `FilterButton`
- `SavedViewPicker`
- `BulkActionBar`
- `RowActions`
- `SortableHeader`

The table API should support:
- column definitions
- pagination
- server-side query state
- sorting
- filters
- row selection
- loading
- empty results
- bulk actions

## Forms

- `FormField`
- `TextInput`
- `EmailInput`
- `PhoneInput`
- `TextArea`
- `Select`
- `Combobox`
- `OwnerSelect`
- `PipelineSelect`
- `StageSelect`
- `TagPicker`
- `DatePicker`
- `DateTimePicker`
- `CurrencyInput`
- `ProbabilityInput`

## Overlay Components

- `Modal`
- `ConfirmDialog`
- `Drawer`
- `QuickCreateSheet`
- `CommandPalette`
- `Popover`

## CRM Components

- `ActivityTimeline`
- `ActivityTimelineItem`
- `ActivityComposer`
- `TaskRow`
- `TaskQuickComplete`
- `DealCard`
- `KanbanColumn`
- `LeadStatusSelect`
- `DealStageSelect`
- `RelatedEntityLink`
- `EntitySummaryCard`
- `ContactCard`
- `FileRow`
- `NoteCard`

## Charts

- `RevenueTrendChart`
- `PipelineStageChart`
- `SourceDonutChart`
- `WinLossDonut`
- `RepActivityBars`
- `StageDistributionBar`

Charts accept data as props.
Charts never query the database directly.

## Component State Contract

Every interactive component must consider:
- default
- hover
- focus
- active
- disabled
- loading where applicable
- error where applicable

## Accessibility

- icon-only buttons: accessible name
- dialogs: focus trap
- dropdowns: keyboard navigable
- table row actions: keyboard reachable
- focus visible
- semantic headings
- labels associated to fields

## Reuse Requirement

Leads, Contacts, Companies, and Deals list screens should reuse:
- the same table shell,
- filter patterns,
- pagination,
- query-state patterns,
- bulk-selection model.

Do not build four disconnected data-grid implementations.
