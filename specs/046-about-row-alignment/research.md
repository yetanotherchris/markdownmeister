# Research: About Section Alignment

Date: 2026-08-24. Claims verified against this worktree during planning.

## R1 - The misalignment and its single cause

**Decision**: Remove the horizontal component of the row padding in the About stylesheet rule. One declaration changes.

**Evidence**: The heading is a `legend.settings-legend` with no horizontal padding (`AboutArea.tsx:19`, `settings.css:112-118` includes `padding: 0`), inside a fieldset that also contributes none (`settings.css:102-106`). Each row div `.settings-about-row` carries `padding: 6px 8px` (`settings.css:229-235`; the 8 px horizontal component at :233), indenting the Version, Repository URL, and Revision labels exactly 8 px right of the heading. The rows are built at `AboutArea.tsx:21-55`. Changing the horizontal component to 0 aligns label and value columns with the legend.

## R2 - Scope isolation

**Decision**: Change only `.settings-about-row`. Do not touch the shared padding pattern used by interactive controls.

**Evidence**: The same `padding: 6px 8px` appears on `.settings-radio` (`settings.css:120-133`), `.settings-select-label` (:141-150), and `.settings-switch` (:165-175). Those are focus/click targets where the padding serves hit-area comfort; the About rows are static text, so removing it there has no interaction cost. A blanket change would alter unrelated areas against FR-002.

## R3 - Verification approach

**Decision**: Keep automated coverage behavioural (existing suite stays green) and assert alignment with a computed-style check rather than pixel screenshots.

**Evidence**: The About e2e suite already navigates by accessible names and asserts testids (`tests/e2e/about.spec.ts:40-141`), so it survives a CSS-only change untouched; adding one assertion that the row's computed left padding is 0 px pins FR-001 cheaply without brittle image comparison.

## References

- Row markup: `src/renderer/chrome/AboutArea.tsx:19-55`
- Styles: `src/renderer/chrome/settings.css:102-106, 112-118, 229-235`
- Existing suite: `tests/e2e/about.spec.ts`
