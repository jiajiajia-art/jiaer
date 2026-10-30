# Special Author Management Design

## Problem

The operator center's author management view currently requires searching for a user before it can show creator benefits. Operators cannot review all contracted and invited authors in one paginated list or quickly add an existing platform user as a special author.

## Goals

- List every contracted author and invited author without requiring an initial keyword.
- Search the list by Kuran account, nickname, or phone number, filter by author type, and paginate results.
- Show existing account identity and creator benefit details for each author.
- Add an existing platform user by searching for the account and assigning an author type.
- Edit an author's type and benefits using the existing author update behavior.
- Keep the current database schema.

## Non-goals

- Create platform user accounts from the operator center.
- Store contract documents, contract dates, or invitation dates.
- Add or alter database tables, columns, or indexes.
- Change the existing benefit calculations.

## Operator experience

The author management view loads all contracted and invited authors on entry. Its search field matches Kuran account, nickname, and phone number. A type filter distinguishes contracted and invited authors, and the list uses 20 rows per page by default.

Each row shows nickname, Kuran account, phone number, author type, current and permanent level, current-quarter effective count, and editor/custom work share. Invited authors also show whether TXT creation is free and the operations note. A compact responsive layout preserves these details on narrow screens.

The Add Author action opens a user search flow. The operator searches by Kuran account, nickname, or phone number, chooses a platform account, and assigns the contracted or invited type and related benefits. Search results that already have a special author type show that type and cannot be added a second time; the operator edits them from the author list instead.

Editing keeps the selected account identity read-only and reuses the existing author fields. Changing the type to regular removes the user from this list and clears the signed level according to current update behavior; no hard deletion is performed. While loading or saving, repeated submissions are disabled. Errors keep the current query and list visible for retry. A successful save reloads the current page; if the last row on the last page was changed to regular, the view moves to the preceding valid page.

## API and data flow

### List special authors

Add `GET /api/admin/creator-benefits/authors` with administrator authentication.

Query parameters:

- `keyword`: optional text matched against Kuran account, nickname, or phone number.
- `authorType`: optional `contracted` or `special` filter.
- `page`: optional positive page number, default `1`.
- `pageSize`: optional page size, default `20`, maximum `100`.

Return `{ list, pagination }`, where each list item contains the existing admin user identity fields and `CreatorBenefitSummary`; pagination contains `page`, `pageSize`, `total`, and `totalPages`. Results are restricted to rows whose author type is contracted or special. Benefit summaries are read without works to avoid loading unrelated work lists.

### Search platform users for adding

Extend the existing authenticated `GET /api/admin/creator-benefits/users` query to match nickname as well as Kuran account and phone number. Keep `keyword` required. Add optional `page` and `pageSize` parameters using the same defaults and maximum as the author list. Preserve the existing `list` field and add `pagination` to its response. Each result continues to include its current benefits so the UI can identify and disable accounts already assigned a special author type.

### Update author

Reuse `PUT /api/admin/creator-benefits/users/:userId/author` with the current request body fields: `authorType`, `editorShareRatio`, `customShareRatio`, `freeTxtCreation`, and `note`. No existing update semantics change.

### Database

No database schema changes. The author list reads from `creator_benefit_overrides` joined to `user`; the current author type and benefit summary continue to come from the existing creator benefit services.

## Error handling and consistency

- Both read endpoints validate and clamp pagination input and return an empty list with valid pagination when no rows match.
- Admin authentication remains mandatory for listing, user search, and updates.
- Failed loads show an error while preserving the search/filter state and offer a retry action.
- Failed saves keep the editor open with its current values. Successful saves refresh the list from the server so type changes and calculated benefit fields remain authoritative.
- The UI prevents repeat submissions while a request is in flight.

## Verification

- Backend checks cover administrator authorization, type filtering, keyword matching across all three identity fields, page boundaries, empty results, and the existing update route.
- Frontend type/build checks cover the paginated list and add-user search flow.
- No database migration or manual environment configuration is required.
