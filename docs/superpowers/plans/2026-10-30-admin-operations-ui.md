# Funloom Admin and Operations UI Implementation Plan

> **For agentic workers:** Execute this plan inline in the current authorized session, preserving existing business behavior.

**Goal:** Replace the desktop administrator and operations presentation with a shared Ant Design shell, compact blue theme, grouped navigation, and consistent content surfaces without changing business APIs, routes, permissions, or copy.

**Architecture:** Add a reusable `AdminShell` that owns the desktop header, grouped menu, route selection, and Ant Design `ConfigProvider`. Keep each existing manager responsible for its data and actions, while a scoped CSS token layer normalizes the existing CSS Module surfaces during the migration. Wire the shell into the two main panels and the two standalone admin/operator pages.

**Tech Stack:** React 19, TypeScript, React Router 7, Ant Design 6, `@ant-design/icons`, existing CSS Modules, dnd-kit, Recharts.

---

### Task 1: Add the shared desktop shell and theme

**Files:**
- Create: `src/components/admin-shell/AdminShell.tsx`
- Create: `src/components/admin-shell/AdminShell.module.css`
- Create: `src/components/admin-shell/adminTheme.ts`
- Create: `src/components/admin-shell/adminNavigation.tsx`
- Modify: `package.json`, `package-lock.json`

- [x] Define grouped admin/operator menu models with existing paths, role gating, and pending count badges.
- [x] Render `Layout`, `Header`, `Sider`, `Content`, `Menu`, `Avatar`, `Dropdown`, and a home button.
- [x] Scope the Ant Design theme to the shell and preserve logout through the existing auth state.
- [x] Add explicit `@ant-design/icons` dependency.

### Task 2: Wire the shell into existing routes

**Files:**
- Modify: `src/page/AdminPanel.tsx`
- Modify: `src/page/operator/OperatorPanel.tsx`
- Modify: `src/page/CommentAdminPage.tsx`
- Modify: `src/page/operator/OperatorWorkStats.tsx`

- [x] Replace ordinary user `Navbar` and hand-built navigation with `AdminShell`.
- [x] Keep existing content render branches, data loading, route handlers, and permission checks.
- [x] Keep nested route pages reachable from the shared menu.
- [x] Keep special admin-only comment behavior and operator-only desktop guard.

### Task 3: Normalize existing manager visuals

**Files:**
- Modify: `src/page/AdminPanel.module.css`
- Modify: `src/page/operator/OperatorPanel.module.css`
- Modify: `src/page/operator/OperatorReports.module.css`
- Modify: `src/components/Admin/MetricSummary.module.css`
- Modify: `src/components/PlatformBenefitsManager.module.css`
- Modify: selected manager views that had duplicate page titles.

- [x] Replace the main admin workspace's warm backgrounds, blur, oversized radii, and heavy shadows with the scoped blue/white token layer.
- [x] Remove duplicate page-level titles and descriptions so the menu carries page identity while card and table headings remain available.
- [x] Normalize shared menu, form, report table, metric, status, empty, and action surfaces.
- [x] Preserve special media, chart, drag-sort, and evidence layouts.

### Task 4: Validate the desktop admin surface

**Files:**
- No new test files unless an existing check needs a focused regression case.

- [x] Run `npm run build`.
- [x] Run targeted existing checks for operator reports, admin diamonds, withdrawals, and AI model center.
- [x] Run `git status --short --untracked-files=all` and remove temporary verification output.

