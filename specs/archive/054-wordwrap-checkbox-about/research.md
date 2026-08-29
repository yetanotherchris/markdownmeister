# Research: Word Wrap Checkbox and About Page Tweaks

**Feature**: specs/054-wordwrap-checkbox-about | **Date**: 2026-08-29

Findings that resolve the plan's open questions, with the evidence and the rejected alternatives. Line references are against the tree at the time of writing.

## R1. The word wrap control becomes a native checkbox wrapped in a label

**Decision**: Replace the press-style button with `<label class="source-word-wrap"><input type="checkbox" data-testid="source-word-wrap" checked={wordWrap} ... /> Word Wrap</label>`.

**Evidence**: The current control is a button reporting state through `aria-pressed` (src/renderer/editor/SourceView.tsx:189-198). The user asked for "a checkbox, or toggle button", and the control is already a toggle button in every meaningful sense, so the change they are asking for is the checkbox: a control whose on/off state is unmistakable at a glance. A native checkbox gives this for free:

- The checked state is the state report (FR-002); no ARIA state plumbing, no colour semantics.
- Keyboard operability is native: focus with Tab, toggle with Space (FR-002/FR-010 lineage from spec 048).
- The wrapping `<label>` makes the visible text "Word Wrap" the input's accessible name and makes the text itself clickable.

The existing `data-testid="source-word-wrap"` moves to the input so `getByTestId('source-word-wrap')` helpers in the e2e suite keep resolving. The `source-word-wrap` class stays on the label so the far-right toolbar position (`margin-left: auto`, from spec 048 FR-009) and the position test's `.source-word-wrap` query keep working.

**Alternatives rejected**:

- _Keep the button and restyle it as a switch_: that is the state the user is asking to leave; a switch still needs custom state styling to be legible.
- _ARIA `role="switch"` on the checkbox_: redundant; a native checkbox already conveys on/off, and the spec asks for a checkbox first.

## R2. The spec 053 grey/accent pressed styling is removed with the button

**Decision**: Delete the `.source-word-wrap` button styling (grey background, hover tint, `[aria-pressed='true']` accent) and style the label minimally; the shared `.source-return` rule drops its `.source-word-wrap` half.

**Evidence**: Spec 053 R5 styled the button's off state grey and its pressed state accent (src/renderer/editor/editor.css:185-220). That presentation exists to make a *button's* pressed state legible; the checkbox replaces that mechanism with a native one, so the rules have no remaining subject. The label keeps `margin-left: auto` (position), `display: inline-flex; align-items: center; gap: 6px` (checkbox-to-text spacing), `font-size: 13px` and `color: inherit` (matching the toolbar's other control). The e2e test that pinned the grey/accent colours (word-wrap.spec.ts FR-005) is migrated to pin the new state mechanism instead: the control is an `input[type="checkbox"]` whose checked state tracks the wrapping behaviour.

## R3. The version renders as "v." immediately followed by the version number

**Decision**: The About version value renders `v.{buildInfo.version}`, so version 1.5.1 displays "v.1.5.1". The value still comes from the build-info IPC read; nothing is hardcoded (spec FR-009).

**Evidence**: The user wrote "displays v.1.2.3" while the running application version is 1.5.1 (package.json), so "1.2.3" describes the format, not a value to pin. The existing row is the right place: it already shows the bare version with no "Version" label (spec 050 FR-001), and it already hides itself when the build info is unavailable (`{buildInfo && ...}`, src/renderer/chrome/AboutArea.tsx:15-21), which covers the spec's edge case (no bare "v." ever renders).

## R4. Removing the "Repository URL" label keeps the link and its no-build-info fallback

**Decision**: Delete the `.settings-about-label` span from the repository row; the clickable URL button stays, along with the `REPOSITORY_URL` constant fallback for the `getBuildInfo` failure paths. The now-unused `.settings-about-label` CSS rule is removed with it.

**Evidence**: The user asked to remove the label, not the URL; the link is the functional part (it hands the exact URL to the OS, FR-008) and the URL text is self-describing, so the label is pure duplication. The constant-fallback behaviour was deliberately established by the review on 2026-08-23 (tests/renderer/settingsAbout.test.tsx:186-211: "the link is a constant needing no fetched data, it must stay usable"), and spec 054 does not ask to change it, so it stands. With the span gone, `.settings-about-label` (src/renderer/chrome/settings.css:242) has no remaining user and its rule goes too.

## R5. Test migration map

**Decision**: Update the existing suites in place rather than creating new files; the word wrap and About suites already own these surfaces, and spec 050 set the precedent of migrating them in place.

**Evidence**:

- tests/e2e/word-wrap.spec.ts: every `aria-pressed` assertion becomes a `checked` assertion (`toBeChecked()`); the "Word Wrap" text assertion moves from the input (which has no text) to its label; the FR-005 grey/accent test becomes a native-state test (`input[type="checkbox"]`, checked follows clicks); the keyboard test toggles with Space (native checkbox behaviour) instead of Enter and Space; the FR-009 position test's `.source-word-wrap` query now returns the label element; persistence and malformed-value tests read the checkbox state.
- tests/e2e/about.spec.ts: the displayed version assertions gain the "v." prefix; the row-labels assertion becomes an empty list plus an explicit "Repository URL" absence check; the repository-link tests are untouched.
- tests/renderer/settingsAbout.test.tsx: same two changes at unit level; the failure-path tests keep asserting the link's constant fallback.
