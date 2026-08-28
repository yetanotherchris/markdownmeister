# Feature Specification: Source View Scroll Wedge

**Feature Branch**: `spec-051-source-view-scroll-wedge`

**Created**: 2026-08-28

**Status**: Archived

**Input**: User bug report, verbatim: "Open a file that's about 1000-2000 words. Scroll down, click in the visual editor. Click on 'view source'. The visual editor freezes. It can also show half of the code editor at the top as a visual glitch. The work around is to close the tab, so it's only the frame that's frozen not the whole app. I think trying to sync the caret in the two editor modes might be contributing."

This document records a verified bug diagnosis (the Findings section) and the requirements that fix must satisfy. It exists so a reviewing agent can independently reproduce the defect, check every mechanism claim against the cited code, and verify the fix against the acceptance scenarios without re-deriving the analysis. One deliberate deviation from the "specs contain no technology" rule: the Findings section cites implementation files and lines, because the document's purpose is verification of a technical diagnosis; the Requirements section remains behavioural only.

## Findings (verification record)

### Symptom

After scrolling the visual editor and activating View source, the editor surface stops responding to clicks, typed input, and wheel scrolling. The tab bar and other chrome keep working, and closing the tab recovers. In some scroll states the top portion of the editor area shows raw monospace markdown source with the rendered visual editor visible below it, separated by a clean horizontal boundary; in others the editor shows only the frozen visual content.

### Reproduction (deterministic, automated)

`tests/e2e/source-scroll-wedge.spec.ts` reproduces the defect against the real built app (Electron, Playwright, headless Chromium). The scenario: open a 400-paragraph document, set the formatted editor's scroll container `.editor-host` to `scrollTop = 1000`, land a real mouse click in the visible prose, activate the toolbar View source button, then probe the resulting surface. Before the fix, exactly two of its three tests fail:

1. "entering source view resets the host scroll so the overlay covers the editor" fails: `.editor-host.has-source` reports `scrollTop === 1000` after the toggle.
2. "the source surface receives clicks and input after a scrolled toggle" fails: `document.elementFromPoint` at the editor area's centre returns an element with class `milkdown` (the locked ProseMirror wrapper), not the CodeMirror source surface (`.source-textarea`).
3. "returning to formatted editing restores the pre-toggle scroll position" passes, both before and after the fix: the return path is healthy.

The identical centre-click probe passes when the container was never scrolled, which matches the defect being scroll-dependent.

### Root cause

The formatted editor's scroll container is `.editor-host` (`position: absolute; overflow: auto`; `src/renderer/editor/editor.css:13-23`). It is resolved as the scroll element for cursor and scroll capture at `src/renderer/editor/CrepeHost.tsx:177`. When View source activates, `SET_VIEW` only flips `document.view` in the store (`src/renderer/state/documents.ts:491-502`); nothing resets the container's live scroll offset. The source overlay `.source-view` is rendered inside that same container (`src/renderer/editor/EditorPanel.tsx:111-124`) as `position: absolute; inset: 0; z-index: 20` (`editor.css:160-172`). Because `.editor-host` is positioned, it is the overlay's containing block, and an absolutely positioned box whose containing block is a scroll container scrolls with that container's content. The overlay is therefore anchored at the content origin, while the viewport shows the content range `[scrollTop, scrollTop + H]`.

Switching also adds the `has-source` class (`overflow: hidden`, `editor.css:33-35`). An `overflow: hidden` box remains a scroll container, so Chromium preserves the 1000px offset, and user scrolling is disabled. The visual result is exactly the reported glitch: the viewport shows the overlay's bottom slice (raw source) at the top, a boundary at content y = H where the overlay's box ends, and content below it. When `scrollTop` exceeds the host height the overlay is out of view entirely and the editor shows only frozen visual content.

That visible content is dead by design: while in source view the ProseMirror root carries the `inert` attribute (locked, `src/renderer/editor/CrepeHost.tsx:85-92`, applied at init and by the `locked` effect at `:219-221`). Inert subtrees are skipped by hit testing and cannot take focus, so clicks do nothing, wheel events do nothing (the container is `overflow: hidden`), and typed input goes nowhere visible. `elementFromPoint` skips the inert ProseMirror and hits its plain `.milkdown` wrapper, matching the repro. The CodeMirror surface and the "Back to visual editing" button are offscreen above the viewport; the mount-time `view.focus()` cannot rescue the position because CodeMirror focuses with `preventScroll` behaviour internally. The escape hatch is everything outside the editor host, which is why closing the tab works while the frame stays frozen.

The healthy unscrolled path is unchanged by this analysis: at `scrollTop = 0` the overlay exactly covers the container, which is why short documents never exhibited the bug. The passing third repro test is explained by the existing capture-then-restore design: when `active` flips false, CrepeHost captures `{cursorOffset, scrollTop}` from the container (`CrepeHost.tsx:99-106`, effect `:223-233`) into the store via `CAPTURE_EDITOR_STATE` (`documents.ts:379-390`) before anything else happens, and on return `applyCursorRestore` reassigns the container's `scrollTop` (`src/renderer/editor/cursorRestore.ts:51-53`). Any fix must preserve that ordering.

### Verdict on the reporter's caret-sync hypothesis

Exonerated. The repro performs no edit and no caret movement; the wedge is fully determined by the first commit after `SET_VIEW` (stale container offset plus inert plus overlay geometry), before any selection sync could run. The sync paths are also structurally loop-free: `CAPTURE_EDITOR_STATE` fires only on `active` flips (`CrepeHost.tsx:223-233`); source-context capture is coalesced to one store dispatch per animation frame (`SourceView.tsx:70-76`); and the store-to-CodeMirror value effect no-ops when the document already matches (`SourceView.tsx:129-136`). No feedback loop exists in the caret sync, and none is needed to explain any part of the report.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View source from a scrolled editor shows a live source surface (Priority: P1)

A user who has scrolled the visual editor down a long document and activates View source sees the source view covering the editor pane, at the position they were reading in source terms, and can immediately click, type, and scroll in it. The frozen half-and-half presentation and the unresponsive frame are gone. Returning to the visual editor restores the caret and scroll position they had before the toggle, exactly as in the unscrolled case today.

**Why this priority**: This is the entire defect: a primary editing surface becomes unusable and visually corrupt through an ordinary action on an ordinary document.

**Independent Test**: Open a document several viewport-heights long, scroll the visual editor, click in the prose, activate View source, and confirm the source surface covers the pane, receives the centre click, and accepts typed input; return to the visual editor and confirm the pre-toggle caret and scroll are restored.

**Acceptance Scenarios**:

1. **Given** the visual editor is scrolled to any offset, **When** View source activates, **Then** the source view overlays the editor pane's visible area in full, with no sliver of the underlying visual content visible above or below it.
2. **Given** the source view open after a scrolled toggle, **When** the centre of the editor pane is clicked, **Then** the click lands on the source surface and typed input appears there, with the tab's dirty marker reflecting any edit.
3. **Given** the source view open after a scrolled toggle, **When** the user scrolls the pane with the wheel, **Then** the source content scrolls.
4. **Given** a scrolled toggle with no source edits, **When** the user returns to visual editing, **Then** the visual editor's caret and scroll position are what they were before the toggle.
5. **Given** an unscrolled toggle (the common short-document path), **When** the toggle completes, **Then** behaviour is byte-for-byte today's behaviour: same overlay position, same focus, same capture and restore.

---

### User Story 2 - The defect is independently reproducible and verifiable (Priority: P1)

A reviewing agent can reproduce the defect without the original reporter. The repro suite drives the real built app, names the observable values that distinguish broken from fixed (`scrollTop` of the host container, the `elementFromPoint` hit at the pane centre), and fails in exactly the two ways documented above before the fix, with all three tests passing after.

**Why this priority**: The spec's purpose is verifiability; without a mechanical repro the diagnosis could not be checked and regressions could not be guarded.

**Independent Test**: Run the repro suite against the built app on a tree without the fix and observe the two documented failures; apply the fix and observe all three pass.

**Acceptance Scenarios**:

1. **Given** the built app without the fix, **When** the repro suite runs, **Then** exactly the two tests named in Findings fail, with the values documented there (`scrollTop === 1000`; hit class `milkdown`).
2. **Given** the built app with the fix, **When** the repro suite runs, **Then** all three tests pass.
3. **Given** the fix applied, **When** the existing source-view regression suites run, **Then** they pass unchanged, including the FR-004 caret and scroll round-trip test and the mutual-exclusivity click-through test in `tests/e2e/source.spec.ts`.

---

### Edge Cases

- Scroll offset larger than the pane height: the overlay is entirely out of view pre-fix (the "only frozen visual content" presentation). Post-fix the overlay covers the pane at any offset.
- Scrolling then toggling source twice in a row (toggle, return, toggle): capture and restore ordering must hold across repeated cycles; the stored visual scroll is captured on every leave, and the reset only affects the live container while the overlay covers it.
- Tab switching to another tab while one tab sits in source view: each document owns its own container, so the reset is per-tab; switching back re-runs the source surface's own selection and scroll restore.
- Eviction and reactivation of a source-view tab: evicted tabs render a bare host; reactivation remounts with the stored source context. The reset must be a no-op when the container is fresh.
- A document with frontmatter, unsaved formatted edits, or a mid-document caret: the content capture and dirty-state behaviour of the toggle is untouched by this fix; only the live container's scroll offset changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Activating View source MUST leave the editor pane showing the source view covering the pane's full visible area, regardless of the visual editor's scroll offset at toggle time.
- **FR-002**: The visual editor's caret offset and scroll position MUST be captured before the source view is presented, and MUST be restored on return to visual editing, matching today's behaviour for the unscrolled path (constitution Principle IV).
- **FR-003**: The fix MUST NOT alter stored per-document state shapes, the capture or restore semantics of source-view selection and scroll, dirty-state tracking, save behaviour, or the IPC surface; it is confined to the presentation layer of the view switch.
- **FR-004**: The fix MUST NOT change behaviour of the unscrolled toggle path in any observable way.
- **FR-005**: Process isolation, path handling, and save atomicity are untouched: no new channels, no filesystem work, no changes to the preload API (constitution Principles I, II, III).
- **FR-006**: All existing suites MUST pass after the fix: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`.

### Key Entities

- **Editor host container**: The per-document scroll container shared by the visual editor and, during source view, the source overlay. Its live scroll offset is the entire defect surface: preserved across the toggle pre-fix, reset on entering source view post-fix, and restored from captured state on return.
- **Source overlay**: The full-pane source surface. Its anchoring inside the scroll container is unchanged; the fix makes the container's offset zero whenever the overlay is the visible surface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of toggles from a scrolled visual editor, the source surface covers the pane and receives the pane-centre click (`elementFromPoint` resolves to the source surface, not the locked visual editor).
- **SC-002**: In 100% of no-edit round trips from a scrolled visual editor, the caret offset and scroll position after return equal the values before the toggle.
- **SC-003**: The repro suite's three tests fail in exactly the two documented ways pre-fix and all pass post-fix, and the full gate suite (FR-006) is green post-fix.

## Verification procedure for a reviewing agent

1. Check out this branch. Build: `npm run build` (or `npm run test:e2e`, which builds first).
2. Pre-fix check (skip if the fix is already present): `npx playwright test tests/e2e/source-scroll-wedge.spec.ts` and confirm the two failures with the documented received values, and that the return-restore test passes.
3. Apply or review the fix against the Findings: the remedy is to zero the live container's scroll offset when the document enters source view, implemented in the per-document host component, ordered after the child editor's leave-capture effect (React flushes child passive effects before parent effects, so the stored scroll is the pre-reset value; this ordering is what keeps FR-002 and the FR-004 round-trip test intact).
4. Post-fix: run the repro suite (all three pass), then `npx playwright test tests/e2e/source.spec.ts` (the FR-004 restore and mutual-exclusivity tests must pass unchanged), then the full gates in FR-006.
5. To re-verify the mechanism by hand rather than by test: in the running app, evaluate `document.querySelector('.editor-host').scrollTop` after a scrolled toggle (pre-fix: non-zero; post-fix: 0) and `document.elementFromPoint` at the pane's centre (pre-fix: `.milkdown`; post-fix: the source surface).

## Assumptions

- **Scope**: This spec covers only the scroll-wedge defect and its verification. The investigation surfaced four adjacent observations that are recorded but out of scope: the partial-freeze presentation varies with scroll depth (same root cause, fixed by the same change); the scroll restore on return runs in a passive effect and can paint one frame at the wrong offset (pre-existing, cosmetic); `CrepeHost`'s scroll-element resolution falls back to `parentElement` if the host class is ever renamed (latent); and `applyInert` finds top-bar elements by class query, which would miss any future floating feature rendered outside the editor root (latent).
- **Remedy recorded, not mandated**: The Requirements are behavioural; the Findings record the minimal remedy and the rejected alternative (moving the overlay outside the scroll container), which would change DOM structure for no observable gain.
- **Repro suite lifecycle**: `tests/e2e/source-scroll-wedge.spec.ts` is committed alongside this spec and is expected to fail until the fix lands in the same change; the PR is not green until all three of its tests pass.
