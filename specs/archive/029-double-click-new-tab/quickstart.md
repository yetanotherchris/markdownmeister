# Quickstart: Double-Click Open in New Tab

Runnable verification for spec 029. Contract: [contracts/file-open-gesture.md](./contracts/file-open-gesture.md).

## Prerequisites

- `npm ci`; build with `npm run build`.

## Verify the double-click new-tab behaviour (US1)

1. Open a workspace with several markdown files; open one file (it becomes a clean
   active tab).
2. **Double-click** a different file in the explorer: the file opens in a NEW tab,
   the previous tab stays open with its original content — **no tab replaced**
   (FR-001/002).
3. Make the active tab dirty (type a character), then double-click another file: it
   opens in a new tab and the dirty tab is untouched (FR-009).
4. With no tabs open, double-click a file: a single new tab opens (FR-008).
5. Create an untitled tab (New File) and leave it empty; double-click a file: the
   file opens in a new tab and the untitled tab remains (acceptance scenario 4).
6. Double-click a file that is already open in another tab: its existing tab is
   activated, no duplicate (FR-005).
7. Single-click still behaves as before: with the setting disabled, a single click
   replaces a clean active tab (FR-007).

## Verify no change for new-tab users (US2)

1. Enable "Open explorer files in a new tab", then double-click a file: one new tab,
   same as a single click, no duplicate (US2 acceptance scenario 1).
2. Double-click an already-open file: its existing tab is activated (US2 scenario 2).

## Verify directories (US3)

1. Collapse a directory, double-click it: it expands and no tab opens (FR-006).
2. Double-click the expanded directory: it collapses, no tab opens.

## Automated checks

```sh
npx vitest run tests/renderer/openGesture.test.ts
npx playwright test tests/e2e/double-click-new-tab.spec.ts
```

## Regression gates

```sh
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```
