# Quickstart: File Explorer Toggle Icon

Runnable checks for spec 068. The DOM contract is [contracts/renderer.md](./contracts/renderer.md).

## Prerequisites

Install dependencies with `npm ci` if `node_modules` is missing. The e2e command builds the app before it launches Electron.

## What to look at

1. Launch the app. In the header, the control next to the menu shows an outlined window with a narrow empty left pane and a wider empty right pane. It does not show four squares.
2. With no folder open, that control is disabled and still shows the same symbol.
3. Open a folder. Click the control: the explorer hides and the symbol stays. Click again: the explorer returns at its previous width and the symbol stays.
4. Hover the control and tab to it. The existing highlight and focus ring appear, and the tooltip and accessible name are "Toggle file explorer".
5. Open a file, type, and confirm the tab is dirty. Hide and restore the explorer. The typed text and the dirty marker are still there.
6. Switch the application between light and dark. The outline and the divider stay visible against the header, at the same size as the menu icon.

## Automated check

```sh
npx playwright test tests/e2e/explorer-toggle-icon.spec.ts
```

Run that after `npm run build`, or use `npm run test:e2e`, which builds and then runs the whole suite.

## Regression gates

```sh
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

`chrome.spec.ts` must still hide and restore the explorer, and `window-state.spec.ts` must still show the control disabled when no folder is open.
