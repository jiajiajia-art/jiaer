# Admin and Operations Compact Spacing Design

## Goal

Reduce wasted vertical space in the Funloom admin panel and operations center, especially where a page renders a tall card containing only a count, a lone refresh button, or an empty heading marker. Keep the existing information and actions available while moving compact controls beside their related filters or section headings.

## Scope

- Review the operations pages shown in the supplied screenshots: promoter management, content report review, moderation history, appeals, AI model center, and withdrawal management.
- Review admin panel pages for the same structural pattern and compact only matching empty or single-control top regions.
- Preserve cards that contain meaningful summaries, help text, filters, or task-specific controls.
- Preserve routes, permissions, request behavior, API contracts, and existing Chinese copy.

## Design

Remove or collapse page-level top containers that carry no useful content. Move counts into an adjacent filter or section toolbar when they help operators understand the current result set. Move refresh actions beside the relevant filters or model-section heading. Keep context-specific guidance in a compact inline location when removing its oversized container. Shared shell CSS may normalize common spacing, but must not broadly hide or remove manager content based on generic class names.

## Behavior and Edge Cases

Loading, error, empty, and populated states continue to use existing data and actions. Counts continue to reflect the same query results. Refresh remains disabled or available under the same conditions and invokes the same request. Narrow layouts may wrap toolbar content without clipping controls. No new asynchronous behavior is introduced.

## Validation

Run the frontend build and focused existing checks for the affected admin/operations views. Review the final diff and run `git status --short --untracked-files=all`; do not include temporary verification artifacts or commit changes.
