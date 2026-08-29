# Implementation Plan: Word Wrap Checkbox and About Page Tweaks

**Branch**: `spec-054-wordwrap-checkbox-about` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/054-wordwrap-checkbox-about/spec.md`

## Summary

Two small renderer-only changes. First, the word wrap control in the source view toolbar becomes a labelled checkbox: the native checked state reports wrapping on or off, replacing the press-style button whose state was easy to miss (and the spec 053 grey/accent presentation, which dies with the button). Second, the settings About area shows the version with a "v." prefix (for example "v.1.5.1") and drops the "Repository URL" text label while keeping the clickable repository link.

## Technical Context

**Language/Version**: TypeScript (strict) on Electron, renderer process

**Primary Dependencies**: React; CodeMirror 6 (source view); no new dependencies

**Storage**: None new. The word wrap preference keeps its existing persisted home in the settings file; the About area remains read-only

**Testing**: Vitest (unit, About area) + Playwright e2e against the real built app (word wrap suite, About suite)

**Target Platform**: Windows/Linux/macOS desktop (renderer)

**Performance Goals**: No change; the checkbox applies wrapping through the same CodeMirror compartment the button used

**Constraints**: Renderer-only change; no new IPC channels; no change to saved bytes, dirty tracking, undo, or the preload API

**Scale/Scope**: One control swap in the source toolbar, one display tweak plus one label removal in the About area, and the test migrations that pin them

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Process Isolation**: Renderer-only DOM work; no new channels, no preload or main changes. The About area keeps its existing build-info IPC read. PASS
- **II. Every Path Is Untrusted**: No filesystem or path work involved. PASS
- **III. Never Lose The User's Words**: The control swap does not touch content capture, dirty tracking, or saves; the About change is read-only display. PASS
- **IV. Calm, Predictable Editing**: Wrapping still applies immediately through the existing wrap compartment; the checkbox reports state natively without stealing focus or reflowing the editor. PASS
- **V. Test What Can Corrupt Or Escape**: Nothing here corrupts or escapes, but the state-reporting surface changes, so the e2e suite is migrated to pin the checkbox's checked semantics, persistence, keyboard operability, and toolbar position rather than the old pressed-button signals. PASS

## Project Structure

### Documentation (this feature)

```text
specs/054-wordwrap-checkbox-about/
├── spec.md                 # Complete ( WHAT and WHY )
├── plan.md                 # This file
├── research.md             # Phase 0 output
├── checklists/
│   └── requirements.md     # Specify-phase quality checklist
└── tasks.md                # Phase 2 output
```

data-model.md, contracts/, and quickstart.md are not generated: the feature adds no persisted entities (the word wrap setting already exists), no IPC surface, and no install/run flow. The choices are documented in research.md.

### Source Code (repository root)

```text
src/renderer/
├── chrome/
│   ├── AboutArea.tsx        # version renders with "v." prefix; label span removed
│   └── settings.css         # .settings-about-label rule removed (dead)
└── editor/
    ├── SourceView.tsx       # button → labelled checkbox (same testid)
    └── editor.css           # .source-word-wrap button styles → checkbox label styles

tests/
├── renderer/
│   └── settingsAbout.test.tsx   # version prefix, no label, link intact
└── e2e/
    ├── word-wrap.spec.ts        # aria-pressed/button assertions → checked/checkbox
    └── about.spec.ts            # version prefix, no label, link intact
```

**Structure Decision**: The changes land in the two existing components and their existing suites. No new modules: the checkbox replaces the button in place, keeping the `source-word-wrap` test id so every helper that finds the control keeps working, and the About rows keep their structure with one span removed.

## Complexity Tracking

> No constitution violations; table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| | | |
