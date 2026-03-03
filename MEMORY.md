

## 2026-03-02 15:44 - sop:codex

- Confirm write sandbox: ensure `allowedPaths` includes every directory you need to modify (broaden if edits span more than one folder).
- Pre-read target files to verify they exist and to reference exact selectors/blocks to change.
- Keep the task atomic: name specific files, selectors, and exact CSS/logic changes; avoid bundling unrelated edits.
- If a run fails, retry with a fresh `sessionLabel` and a slightly more explicit diff-style instruction set.
- After applying, re-open the edited file(s) to verify changes landed as intended and no formatting/regressions occurred.


## 2026-03-02 16:04 - sop:codex

- Verify the sandbox: include all needed directories in `allowedPaths` before running (avoid partial write permissions).
- Pre-check CSS stacking: locate competing `z-index` values and stacking contexts so the change is correctly targeted.
- Make instructions patch-like: specify exact selector + old value + new value; explicitly say “no other changes”.
- Keep the session focused: one file, one change, and include the reason (e.g., must exceed known `z-index`).
- Post-verify by re-reading the file to confirm only the intended line changed and the selector still matches.


## 2026-03-02 21:32 - sop:bash

- Confirm prerequisites before build: correct Node/npm versions, dependencies installed, and required env vars present.
- Run the fastest failure signal first (e.g., lint/typecheck) before a full build when time is tight.
- Use a clean install when builds act flaky: remove lockfile mismatches and reinstall deterministically.
- Increase timeout for CI-like builds and rerun once; if it still fails, capture the first error and stop.
- If the command writes outside the workspace (cache/tmp), adjust sandbox/permissions or redirect to a workspace-local cache.
