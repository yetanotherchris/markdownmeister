# Tasks: About Section Alignment

**Branch**: `spec-046-about-row-alignment` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

- [ ] T001 Remove the horizontal padding component from `.settings-about-row` in `src/renderer/chrome/settings.css`: `padding: 6px 8px` becomes `padding: 6px 0`; no other declaration or selector changes.
- [ ] T002 Pin the alignment contract in `tests/e2e/about.spec.ts`: every About row computes `padding-left` and `padding-right` of `0px`.
- [ ] T003 Run the gates: lint, typecheck, unit tests, and the scoped About e2e suite against a fresh build.
- [ ] T004 Archive the implemented spec: `git mv specs/046-about-row-alignment specs/archive/046-about-row-alignment` and set **Status** to `Archived`, included in the final commit.
