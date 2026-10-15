# Implementation Plan: File Explorer Toggle Icon

**Branch**: `spec-068-explorer-toggle-icon` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/068-explorer-toggle-icon/spec.md`

## Summary

The header control that shows and hides the file explorer currently draws Heroicons `Squares2X2`, four equal squares. The control keeps its button, placement, labels, disabled rule, and toggle behaviour. Only the glyph changes, to an outlined window with one vertical divider left of center: a narrow empty left pane and a wider empty right pane. The installed `lucide-react` `PanelLeft` icon is that shape. It is drawn with the same 1.5 stroke weight as the neighbouring Heroicons outline glyphs, and the existing `.chrome-icon` rule keeps it at the same rendered size.

## Technical Context

**Language/Version**: TypeScript (strict) in the renderer. No main or preload change.

**Primary Dependencies**: `lucide-react` (already installed, `PanelLeft`) and the existing header button in `src/renderer/App.tsx`. No new package. Heroicons stays the source of the hamburger and the other chrome glyphs.

**Storage**: N/A. The glyph is static. Explorer visibility, sidebar width, and document state stay on their current paths.

**Testing**: Playwright e2e against the built app. The suite reads the SVG geometry, the rendered bounds next to the hamburger, both themes, the preserved name, keyboard activation, the disabled state, and an unsaved document. Existing chrome, window-state, and native suites keep covering toggle behaviour.

**Target Platform**: Windows, macOS, and Linux desktop.

**Project Type**: Desktop application (Electron renderer only).

**Performance Goals**: None. One static SVG in the header. Nothing runs on the typing path.

**Constraints**: The button's class, size, tooltip, accessible name, disabled rule, and click handler stay as they are. No CSS change. The same glyph is shown when the explorer is visible, hidden, or unavailable. Renderer isolation is unchanged.

**Scale/Scope**: One icon in `src/renderer/App.tsx`, a comment in an existing e2e file that names the old glyph, the new file added to the Prettier check list, and one new e2e file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Process Isolation**: Renderer-only swap of a presentational SVG. No Node, `fs`, Electron, IPC, or preload change. PASS
- **II. Every Path Is Untrusted**: No path is read or written. PASS
- **III. Never Lose The User's Words**: The toggle handler, documents, and save path are untouched. Hiding the explorer must leave an unsaved document's text and dirty marker alone, and the e2e suite asserts that. PASS
- **IV. Calm, Predictable Editing**: No keystroke work, no focus steal, no dialog, no layout change beyond the existing collapse. The button keeps its current hover, focus, and disabled treatment. PASS
- **V. Test What Can Corrupt Or Escape**: No path, IPC, or save surface. The user-visible change gets a Playwright suite, which is what this repository requires for that kind of change. PASS

**Post-design re-check**: No principle is violated. Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/068-explorer-toggle-icon/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── renderer.md
└── tasks.md
```

### Source Code (repository root)

```text
src/renderer/App.tsx                         # PanelLeft replaces Squares2X2Icon
tests/e2e/explorer-toggle-icon.spec.ts       # glyph, themes, labels, keyboard, dirty state
tests/e2e/native.spec.ts                     # comment that named Squares2X2
package.json                                 # format:check lists the new e2e file
```

**Structure Decision**: The header button already lives in `App.tsx` and is sized by `.chrome-icon` in `src/renderer/chrome/chrome.css`. The stylesheet and `useSidebarLayout` stay untouched. Verification is one e2e file next to the existing chrome suite.

## Phase status

- Phase 0: Research recorded in `research.md` (glyph, stroke, unchanged behaviour).
- Phase 1: Design recorded in `data-model.md`, `contracts/renderer.md`, and `quickstart.md`.
- Implementation follows `tasks.md`.

## Complexity Tracking

None. No principle is violated.
