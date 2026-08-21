# Quickstart: Fast Same-Tab Document Open

Feature: [spec.md](./spec.md) | Plan: [plan.md](./plan.md) | Date: 2026-08-20

Validation guide for the fast same-tab open. Run from the repository root on Windows (pwsh); adjust for other shells.

## Prerequisites

- Node 22, npm 10
- Dependencies installed (`npm install`)
- Playwright browsers installed for e2e (`npx playwright install`)

## Build and automated checks

```pwsh
npm run lint          # ESLint over ts/tsx/mjs
npm run typecheck     # tsc --noEmit for main, preload, renderer
npm run test          # Vitest unit/reducer tests
npm run test:e2e      # Builds the app, then runs Playwright against real Electron
```

All four must pass before the phase is complete.

## What proves the feature works

### 1. Unit tests (Vitest)

- **Reconfigure skip guard**: requesting default options on a freshly mounted editor skips the swap/`replaceAll`; an off→on toggle round-trip still reapplies. See contract C1.
- **Round-trip byte-equality**: fixtures parsed+serialized under Crepe's stock pipeline and under the swapped-with-defaults pipeline produce identical strings — the safety precondition for the skip.
- **Dirty fast path**: reference-identical document ⇒ clean with zero serialization; any edit since baseline falls back to the exact comparison; decoration-only activity does not false-positive. See contract C2.
- **Counter correctness**: parse/serialization counters increment exactly as specified. See contract C4.

```pwsh
npm run test -- tests/renderer
```

### 2. End-to-end timing and behaviour (Playwright)

`tests/e2e/open-performance.spec.ts` (new) drives the built app:

- Opens a generated document into a clean active tab and measures commit→ready duration; asserts p95 within the SC-001 target across repeated runs.
- Repeats against a 10× larger fixture and asserts near-linear scaling (SC-004).
- Reads instrumentation counters from the page to assert exactly one full parse when display settings are unchanged, and at most one incoming serialization per open (SC-002/SC-003).
- Re-runs the spec 032 acceptance scenarios (visible outgoing editor throughout, atomic swap, dirty-cancel protection) unchanged (SC-005).

```pwsh
npm run test:e2e -- --grep "open-performance"
```

### 3. Manual spot-check

1. `npm run dev`, open a folder with several markdown files.
2. Single-click different files in the explorer repeatedly: each replaces the clean active tab with no blank canvas and no perceptible stall.
3. Type immediately after an open: keystrokes land in the new document; undo starts empty (fresh history).
4. Spellcheck marks appear moments after presentation rather than blocking it.
5. Make a file dirty, single-click another file: it opens in a new tab (existing protection intact).

## Expected outcomes

- Same-tab opens feel effectively instant for typical documents; no empty-canvas interval (spec 032 behaviour preserved).
- Instrumented counts per open: parses 2 → 1; incoming serializations 1 (unchanged); outgoing serializations 3 → 0 for untouched tabs.
- All pre-existing suites remain green; no IPC/preload/filesystem surface changes.
