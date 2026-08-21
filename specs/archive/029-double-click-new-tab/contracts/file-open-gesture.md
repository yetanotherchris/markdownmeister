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
| `double-click` | either | any | `openFileFromExplorer(file, true)` (FR-001/005); the reducer's already-open dedupe lands it on the tab the first click just presented (2026-08-21 amendment) |
| `single-click` | either | any | `openFileFromExplorer(file)` now — the deferral window was removed on 2026-08-21; replacement vs new-tab is decided by the existing open gate |

`openFileFromExplorer` keeps its existing behaviour: already-open → activate (FR-005);
same-tab + clean active → replace; dirty/no active → new tab (FR-009).

Historical note: before the 2026-08-21 amendment a single-click that would replace
a clean active tab was deferred by `DOUBLE_CLICK_WINDOW_MS` (500 ms) so a
double-click could cancel it. The deferral was removed because, once spec 033 made
mounts fast, it was the entire perceived cost of a same-tab open; the double-click's
explicit-new request now dedupes onto the tab the first click opened instead.

## Entry points

| Entry point | Routes through `handleFileOpen` | Notes |
|-------------|--------------------------------|-------|
| Explorer single-click on a file row | yes | gesture router is the sole mouse open path for files |
| Explorer double-click on a file row | yes | FR-001 |
| Explorer double-click on a directory | no | `node.toggle()`, never opens (FR-006) |
| Keyboard Space on a file (activate) | no | `handleTreeActivate` unchanged, immediate |
| Context menu **Open**, File > Open, Recent Items | no | `openFileFromExplorer` via their existing paths |
| Middle-click on a file row | no | existing `onOpenNewTab` (spec 024) unchanged |

## Verification

- Unit (`tests/renderer/openGesture.test.ts`): the pure routing helpers
  (`isOpenableFile`); the deferral decision was removed with the 2026-08-21
  amendment.
- e2e (`tests/e2e/double-click-new-tab.spec.ts`): acceptance scenarios for US1
  (clean/dirty/untitled/no-tab/already-open), US2 (new-tab mode, no change), US3
  (directory toggle, no tab), and FR-007 (single-click unchanged).
