# Quickstart: Settings About Section

Validation scenarios for spec 037. The automated checks run in CI; the manual matrix covers the OS-level behaviours the Playwright suite stubs.

Prerequisites: `npm install`, then `npm run build` (or `npm run dev` for a live check). For release-artifact checks, `npm run dist` and install the built installer.

## US1 — seeing what build you are running

1. Launch the app, open the hamburger menu → `Settings…`.
2. The sidebar lists `General`, `Theme`, `Markdown`, and — last — `About`. Click `About`.
3. Three read-only values are visible: **Version** (matches the installed release's version exactly), **Repository URL** (`https://github.com/yetanotherchris/markdownmeister`), and **Revision** (the full commit hash of the running build).
4. **Manual** — In a packaged release install: compare the About version against the release tag you installed; they must be identical (SC-001). Rebuilding from the tagged revision must reproduce the displayed hash (SC-002).

## US2 — actionable values

1. With About open, activate the repository URL. **Manual** — the system default browser opens at the repository page; the application window is unchanged behind it (no navigation, no new in-app view, SC-003).
2. Select the revision text; it selects in full. Press Copy (or Ctrl+C after selecting), paste into another application: **Manual** — the pasted value equals the full displayed hash with no truncation or whitespace surprises (SC-004, FR-006).
3. **Manual** — Disconnect from the network and activate the repository link again: the OS still attempts the hand-off (browser shows its own offline error) and the application shows no error dialog of its own (FR-004 edge case).
4. Activate the link repeatedly: each activation hands off once; nothing inside the app duplicates (edge case).

## Development / unpackaged runs

1. Run from a checkout (`npm run dev`, or launch `out/main/index.js` directly): About shows the real local revision when git metadata was available at build time — never an invented value.
2. Launch with `MM_BUILD_COMMIT=''` (unpackaged): the Revision row reads `development build` and no Copy button appears for a fabricated hash; Version still shows the true runtime version (FR-007, SC-005).
3. **Manual** — In an unpackaged dev run there is no published release to contradict: confirm the placeholder path never displays a stale or wrong-looking hash.

## FR-008 — no staged state, other areas untouched

1. Open Settings → General/Markdown/Theme: all controls behave exactly as before spec 037 (staged editor theme still requires Save; General still applies immediately).
2. Open Settings → About → close the dialog via Close/Escape/backdrop: **no unsaved-changes prompt ever appears**, with or without dirty documents open.
3. Stage an editor theme in Theme, visit About, return, press Save: the theme commits as before — visiting About neither discards nor auto-commits the staged draft.

## Narrow windows & accessibility

1. Resize the window very narrow (below ~480px): all three values remain readable, wrapping within the dialog flow rather than clipping (edge case).
2. Keyboard-only: Tab reaches the About nav entry, the repository-link button, and the Copy button; focus stays trapped inside the dialog; focus indicators are visible.

## Automated checks (CI)

```bash
npm run lint
npm run typecheck
npm test        # includes:
                #   tests/main/buildInfo.test.ts       (env override / empty env → null /
                #                                       guarded git fallback / composition)
                #   tests/main/buildHandlers.test.ts   (authorization rejection + handler
                #                                       behaviour incl. exact-URL hand-off)
                #   tests/renderer/settingsAbout.test.tsx (area order + stateless draft)
npm run test:e2e  # includes tests/e2e/about.spec.ts against the real built app
```

## Failure triage

- Revision shows `development build` in an installed release → the define did not reach the main bundle; check `electron.vite.config.ts` `main.define` and rebuild.
- Repository link does nothing → check the `build:openRepository` registration and that the renderer call goes through `window.api.openRepositoryUrl()` (never `window.open`).
- Copy silently fails everywhere → environment denies clipboard write; selection remains possible by design, but report if the Copy button itself is missing.
