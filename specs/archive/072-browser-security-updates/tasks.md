# Tasks: Browser Security Updates

- [x] T001: Record requirements, the user's stable-browser choice, technical evidence, and verification plan before implementation.
- [x] T002: Upgrade Electron, Playwright, the matching Docker image, and the image's patched Node.js pin. Select Chrome for documentation tests and document/install its test-image prerequisite. Add focused regression coverage.
- [x] T003: Run required app and documentation checks, dependency audit, and supported packaging validation. Record results and platform gaps.
- [x] T004: Archive the implemented spec, open a PR, obtain five distinct reviews, address findings, and check GitHub results. Leave merging to the user. Current-head readiness remains subject to the gate below.
- [x] T005: Address the test review's minor finding by running documentation e2e in the Linux quality job, retaining its failure traces and cleaning up its container. Workflow validation passed; the resulting GitHub check is tracked under T004.
- [x] T006: Correct the caret-sync test helper's downward-only search discovered during Linux CI. Cover finding an earlier edited line from an end-of-document starting viewport without weakening edit-preservation or caret-mapping assertions, then rerun the affected suite. All 15 tests and ten consecutive runs of the expanded scenario pass locally.

## Readiness Gate

The current PR head's GitHub checks must all pass before the PR is declared ready. Current results and review dispositions are maintained in the PR so recording CI completion does not itself require another code-touching PR run. No merge is authorized.
