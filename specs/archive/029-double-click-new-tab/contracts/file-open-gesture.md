# Contract: File-Open Gesture (`onFileOpen`)

The tree-row → hook contract for spec 029.

## Tree row props

```ts
onFileOpen: (node: TreeNode, gesture: 'single-click' | 'double-click') => void
```

Fired by the file-node row's click handler. The row decides the gesture from the
native event:

```ts
onClick={(e) => {
  if (node.data.kind !== 'file') {
    if (e.detail >= 2) return node.toggle()   // dirs toggle on double-click
    return node.handleClick(e)
  }
  node.select()
  onFileOpen(node.data, e.detail >= 2 ? 'double-click' : 'single-click')
}}
```

- `node.handleClick` is NOT called for files — it would fire `select()` +
  `activate()` and bypass the deferral.
- Directory rows select on single click and toggle on `e.detail >= 2`.
  Detection uses `e.detail` for directories too: a `dblclick` DOM event is not
  reliably delivered in the Electron test runtime, so the completing click
  (`e.detail === 2`) is the toggle signal (research R1).

## Decision table (in `handleFileOpen`)

| Gesture | Setting | Active-tab state | Action |
|---------|---------|------------------|--------|
| `double-click` | either | any | cancel pending open for this file; `openFileFromExplorer(file, true)` (FR-001/005) |
| `single-click` | `new-tab` | any | `openFileFromExplorer(file)` now (US2, FR-007) |
| `single-click` | `same-tab` | no active tab | `openFileFromExplorer(file)` now (FR-008 — nothing to replace, deferral unnecessary) |
| `single-click` | `same-tab` | active dirty | `openFileFromExplorer(file)` now (FR-009 — a dirty tab already forces a new tab, deferral unnecessary) |
| `single-click` | `same-tab` | file already open | `openFileFromExplorer(file)` now (dedupe activates the existing tab, deferral unnecessary) |
| `single-click` | `same-tab` | clean active, file not open | defer `openFileFromExplorer(file)` by `DOUBLE_CLICK_WINDOW_MS` (FR-003 — replacement is exactly the harm the deferral prevents) |

`openFileFromExplorer` keeps its existing behaviour: already-open → activate (FR-005);
same-tab + clean active → replace; dirty/no active → new tab (FR-009).

The deferral exists ONLY to prevent a single click that would REPLACE a clean active
tab from committing before a double-click on the same file can be recognised. When a
single click cannot replace (no active tab, dirty active, already-open, new-tab
preference), a double-click on the same file produces the same tab result anyway, so
the click opens immediately.

A deferred commit is cancelled by a double-click on the same file, and never clobbers
a tab the user opened or switched to during the window: if the active tab changed
since the click, the commit opens a new tab instead (spec Edge Cases).

## Entry points

| Entry point | Routes through `handleFileOpen` | Notes |
|-------------|--------------------------------|-------|
| Explorer single-click on a file row | yes | gesture router is the sole mouse open path for files |
| Explorer double-click on a file row | yes | FR-001 |
| Explorer double-click on a directory | no | `node.toggle()`, never opens (FR-006) |
| Keyboard Space on a file (activate) | no | `handleTreeActivate` unchanged, immediate |
| Context menu **Open**, File > Open, Recent Items | no | `openFileFromExplorer` via their existing paths — no deferral |
| Middle-click on a file row | no | existing `onOpenNewTab` (spec 024) unchanged |

## Timing guarantees

- `DOUBLE_CLICK_WINDOW_MS === 500` (OS double-click time). The browser sets
  `e.detail === 2` on the second click of a recognised double-click within that
  window, so the deferred single-click open (scheduled for 500 ms) always fires
  after a real double-click has had its chance to cancel it (FR-003).
- Only single-clicks that would REPLACE a clean active tab are deferred; all other
  single-clicks open immediately, so single-click browsing is unaffected except in
  the exact replace case FR-003 protects.
- Two deliberate single-clicks on different files within the window each keep their
  own pending timer (pending-opens map keyed by path). A deferred commit checks the
  active tab at fire time: if it changed during the window, it opens a new tab
  rather than replacing a tab the user moved to (spec Edge Cases).

## Verification

- Unit (`tests/renderer/openGesture.test.ts`): the three-way decision table —
  double-click always new, single-click new-tab-mode immediate, single-click
  same-tab-mode deferred — plus window constant.
- e2e (`tests/e2e/double-click-new-tab.spec.ts`): acceptance scenarios for US1
  (clean/dirty/untitled/no-tab/already-open), US2 (new-tab mode, no change), US3
  (directory toggle, no tab), and FR-007 (single-click unchanged).
