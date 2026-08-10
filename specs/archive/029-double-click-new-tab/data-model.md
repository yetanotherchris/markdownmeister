# Data Model: Double-Click Open in New Tab

## Entity: File-Open Gesture

The single decision that turns a row click on a file node into an open action.
Computed by the row's click handler (`e.detail`) and executed by the hook's
`handleFileOpen`, which routes into the existing session open gate.

| Input | Value |
|-------|-------|
| `e.detail >= 2` (completing click of a double-click) | cancel pending single-click open for that file → open explicitly NEW tab (FR-001/005) |
| `e.detail === 1` AND `fileOpenBehavior === 'new-tab'` | open now, per setting (US2 — no deferral) |
| `e.detail === 1` AND `fileOpenBehavior === 'same-tab'` | defer single-click open by `DOUBLE_CLICK_WINDOW_MS` (500 ms), then `openFileFromExplorer` (FR-003/007) |

The deferred commit and the double-click open both go through
`openFileFromExplorer`, so the spec-024 replace-clean-live decision table still
applies at commit time: a dirty active tab is never replaced (FR-009, Principle III).

## Pending-open state

```
pendingOpens: Map<filePath, timer>
```

- Single-click (same-tab): `pendingOpens.set(path, setTimeout(open, 500))`.
- Double-click for a path: `clearTimeout` its timer, `delete` from map, open NEW.
- The timer callback removes its own entry before opening.
- Timers are cleared on hook unmount (app teardown).

## Reducer interaction

No new reducer transition. The hook reuses `openFileFromExplorer`:

```
openFileFromExplorer(file, explicitNew = gesture === 'double-click')
```

Existing dedupe (already-open → activate) and the replace-clean-live gate apply
unchanged; FR-005 (no duplicate on already-open) and FR-009 (dirty never replaced)
fall out of that gate.

## Validation rules

- Only file nodes open documents. Directory double-click toggles expand/collapse
  (FR-006); it never calls `openFileFromExplorer`.
- A single click in same-tab mode commits exactly one open (replace-clean or
  new-tab-if-dirty) after the window — never zero (browsing must still work) and
  never more than one (the router is the only mouse open path).
- The deferred open is cancelled only by a double-click on the SAME file
  (spec Edge Case: two deliberate single-clicks on different files each commit).

## State transitions

None new — the documents reducer is untouched. Only the tree row (gesture source),
the hook (deferral), and the new pure module (decision) change.
