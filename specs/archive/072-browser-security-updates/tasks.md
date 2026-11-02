# Tasks: Browser Security Updates

- [x] T001: Record requirements, the user's stable-browser choice, technical evidence, and verification plan before implementation.
- [x] T002: Upgrade Electron, Playwright, the matching Docker image, and the image's patched Node.js pin. Select Chrome for existing documentation tests.
- [x] T003: Run required app and documentation checks, dependency audit, and supported packaging validation. Record results and platform gaps.
- [x] T004: Archive the implemented spec, open a PR, obtain five distinct reviews, address findings, and check GitHub results. Leave merging to the user. Current-head readiness remains subject to the gate below.
- [x] T005: Remove the agent's unrequested tests, CI steps, testing guide, extra image inputs, and unrelated caret-test changes. Existing tests and workflows must match the base revision.
- [ ] T006: Recheck the narrowed diff, run applicable checks, refresh required reviews, and update the same PR's description and readiness status.

## Readiness Gate

The current PR head's GitHub checks must all pass before the PR is declared ready. Current results and review dispositions are maintained in the PR so recording CI completion does not itself require another code-touching PR run. No merge is authorized.
