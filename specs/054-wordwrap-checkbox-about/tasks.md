# Tasks: Word Wrap Checkbox and About Page Tweaks

## Phase 1: Word wrap control becomes a checkbox (FR-001..FR-005, US1)

- [ ] 1.1 Update `src/renderer/editor/SourceView.tsx`: replace the word wrap button with a labelled checkbox (`<label class="source-word-wrap">` wrapping an `input[type="checkbox"][data-testid="source-word-wrap"]`, checked bound to `wordWrap`, onChange flips it); drop `aria-pressed` and the button title
- [ ] 1.2 Update `src/renderer/editor/editor.css`: remove the `.source-word-wrap` button styling (shared rule half, grey off state, hover tint, `[aria-pressed='true']` accent from spec 053); add label styling keeping `margin-left: auto`, inline-flex alignment, 13px text
- [ ] 1.3 Migrate `tests/e2e/word-wrap.spec.ts` to the checkbox: `aria-pressed` assertions → `checked`; label text read from the label; grey/accent colour test → native-state test; keyboard test via Space; position test reads the label element; persistence and malformed-value tests read checked state
- [ ] 1.4 Verify: `npm run test:e2e -- word-wrap`

## Phase 2: About version prefix and label removal (FR-006..FR-009, US2)

- [ ] 2.1 Update `src/renderer/chrome/AboutArea.tsx`: the version value renders `v.` before the version; remove the "Repository URL" label span; the repository link and its constant fallback stay
- [ ] 2.2 Update `src/renderer/chrome/settings.css`: remove the now-unused `.settings-about-label` rule
- [ ] 2.3 Update `tests/renderer/settingsAbout.test.tsx`: version value is `v.9.9.9`; no label elements; the failure-path tests keep asserting the link fallback
- [ ] 2.4 Update `tests/e2e/about.spec.ts`: displayed version assertions expect the "v." prefix; row labels become an empty list with an explicit "Repository URL" absence check; link tests untouched
- [ ] 2.5 Verify: `npm run test -- settingsAbout` and `npm run test:e2e -- about`

## Phase 3: Full verification and archive

- [ ] 3.1 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`
- [ ] 3.2 `npx prettier --check` the touched files already listed in `format:check`
- [ ] 3.3 Archive: `git mv specs/054-wordwrap-checkbox-about specs/archive/054-wordwrap-checkbox-about`, set Status Archived
