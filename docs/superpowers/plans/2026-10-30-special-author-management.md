# Special Author Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the operator center a paginated list of all contracted and invited authors, with searchable existing-user additions and editable author benefits.

**Architecture:** Add a dedicated admin authors read endpoint backed by `CreatorBenefitService`, while extending the existing admin user lookup with nickname matching and pagination. Keep author updates on the existing endpoint; replace the benefits view's search-only UI with a server-backed author list plus an add-user modal and reuse the existing editor for both flows.

**Tech Stack:** Hono-style handlers, D1-compatible SQL, Node `node:test` checks, React 19, TypeScript, CSS Modules, `react-i18next`.

---

### Task 1: Lock down the admin author query contract

**Files:**
- Modify: `E:/KuranGameAI/funloom-kuran/Interactive-fiction-backend/checks/creatorBenefits.check.mjs`
- Modify: `E:/KuranGameAI/funloom-kuran/Interactive-fiction-backend/services/d1/creatorBenefitService.js`
- Modify: `E:/KuranGameAI/funloom-kuran/Interactive-fiction-backend/interface/handlers/admin/creatorBenefits.js`
- Modify: `E:/KuranGameAI/funloom-kuran/Interactive-fiction-backend/interface/routes/adminCreatorBenefits.js`

- [x] **Step 1: Add failing service and handler assertions**

  Extend the existing admin benefits test with contracted and special users, then assert that `listAdminCreatorAuthorsHandler` returns only those rows, filters by nickname/phone/Kuran ID and type, returns stable pagination, and rejects non-admin callers. Assert the route registrar includes `GET /api/admin/creator-benefits/authors`.

- [x] **Step 2: Run the focused check and verify the expected failure**

  Run `npm run test:txtFreedomRevamp` only if needed for setup; for this feature run `node --test checks/creatorBenefits.check.mjs` from the backend. Expected failure: the new handler is undefined and the new route is absent.

- [x] **Step 3: Implement the paginated service query**

  Add `listAuthors(DB, { keyword, authorType, page, pageSize })` to `CreatorBenefitService`. Normalize page to at least 1 and page size to 20..100, count matching users joined to `creator_benefit_overrides`, restrict the type to `contracted` or `special`, match escaped keyword against `userCode`, `nickname`, and `phoneNumber`, order by newest user id, and hydrate each row with `getCreatorBenefits(DB, userId, { includeWorks: false })`.

- [x] **Step 4: Implement the admin handler and route**

  Add `listAdminCreatorAuthorsHandler`, require admin access through the existing helper, read query parameters, call the service, and return `{ success: true, data: { list, pagination } }`. Register the GET route beside the existing admin creator-benefit routes.

- [x] **Step 5: Extend existing user lookup without breaking callers**

  Update `searchUsers` to match nickname, accept page/pageSize, and return `{ list, pagination }`. Update its handler to pass those values while keeping `keyword` required and preserving the existing list item shape.

- [x] **Step 6: Run the focused check and commit the backend contract**

  Run `node --test checks/creatorBenefits.check.mjs`; expected result is PASS. Commit the backend files with `feat: add paginated special author admin api`.

### Task 2: Add typed frontend API support

**Files:**
- Modify: `E:/KuranGameAI/funloom-kuran/Interactive-fiction-frontend/src/api/creatorBenefits/creatorBenefits.type.ts`
- Modify: `E:/KuranGameAI/funloom-kuran/Interactive-fiction-frontend/src/api/creatorBenefits/creatorBenefitsApi.ts`
- Modify: `E:/KuranGameAI/funloom-kuran/Interactive-fiction-frontend/src/i18n/locales/zh.json`
- Modify: `E:/KuranGameAI/funloom-kuran/Interactive-fiction-frontend/src/i18n/locales/en.json`

- [x] **Step 1: Add list and paginated lookup types**

  Define a reusable admin pagination type and `AdminCreatorBenefitUserResult`, then type `listAuthors` and update `searchUsers` to accept keyword/page/pageSize and return the result wrapper.

- [x] **Step 2: Add operator copy for list, add flow, filters, states, and details**

  Add matching Chinese and English keys for author list loading/empty/error states, author type filter, add-user modal, nickname search, duplicate special-author state, identity/detail labels, and pagination actions. Keep existing translations unchanged.

- [x] **Step 3: Run TypeScript before the component change**

  Run `npm run build` from the frontend. Expected failure is limited to the component still consuming the old `searchUsers` array response; use this as the red checkpoint before updating the component.

### Task 3: Replace the benefits view with author list and add flow

**Files:**
- Modify: `E:/KuranGameAI/funloom-kuran/Interactive-fiction-frontend/src/components/CreatorBenefitsAdminManager.tsx`
- Modify: `E:/KuranGameAI/funloom-kuran/Interactive-fiction-frontend/src/components/CreatorBenefitsAdminManager.module.css`

- [x] **Step 1: Add list state and loaders**

  Add author keyword/type/page state, an `AdminCreatorBenefitUserResult` empty value, a `loadAuthors` callback, and an effect that loads authors when `view === 'benefits'`. Keep games and appeals state unchanged.

- [x] **Step 2: Add the add-user modal state and search**

  Add modal state, lookup keyword/page/results/loading state, and a lookup callback that calls the paginated user endpoint with nickname-capable search. Selecting a result opens the existing author editor; regular users can be assigned contracted or special, while already special users are disabled in the add flow.

- [x] **Step 3: Make the existing editor work for add and edit**

  Track whether the editor was opened from add flow, use the selected user identity as read-only context, keep current ratio/note controls, and after save reload the author list. If a user is changed to regular and the current page becomes empty, clamp to the last available page before reloading.

- [x] **Step 4: Render the author list and details**

  Replace the benefits search-only section with toolbar search, type filter, refresh, and add buttons; render responsive rows containing identity, type, level/effective count, ratios, and special TXT/note details. Add previous/next pagination controls and loading/empty states.

- [x] **Step 5: Style the new controls and responsive rows**

  Extend the existing module CSS with author table/detail grid, add-user modal result rows, badges, and mobile stacking. Reuse existing button and modal primitives.

- [x] **Step 6: Run frontend tests and build**

  Run the existing creator level view check and `npm run build`; expected result is PASS with no TypeScript errors.

### Task 4: Final verification and repository checks

**Files:**
- No new production files.

- [x] **Step 1: Run focused backend verification**

  Run `node --test checks/creatorBenefits.check.mjs` from the backend and confirm authorization, filtering, nickname/phone/Kuran matching, empty pages, and route registration pass.

- [x] **Step 2: Run focused frontend verification**

  Run `node --experimental-strip-types --test checks/creatorLevelView.check.mjs` and `npm run build` from the frontend.

- [x] **Step 3: Review diffs and status**

  Run `git diff --check` in both repositories and `git status --short --untracked-files=all`. Remove any temporary validation output and confirm only feature files and the approved design/plan commits remain.

- [x] **Step 4: Commit frontend changes**

  Commit the frontend API, translations, component, and styles with `feat: add special author management list`.
