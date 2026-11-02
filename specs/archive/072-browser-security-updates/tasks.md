# Tasks: Browser Security Updates

- [x] T001: Record requirements, the user's stable-browser choice, technical evidence, and verification plan before implementation.
- [x] T002: Upgrade Electron, Playwright, the matching Docker image, and the image's patched Node.js pin. Select Chrome for documentation tests and document/install its test-image prerequisite. Add focused regression coverage.
- [ ] T003: Run required app and documentation checks, dependency audit, and supported packaging validation. Record results and platform gaps.
- [ ] T004: Archive the implemented spec, open a PR, obtain five distinct reviews, address findings, and verify GitHub checks. Leave merging to the user.
- [x] T005: Address the test review's minor finding by running documentation e2e in the Linux quality job, retaining its failure traces and cleaning up its container. Workflow validation passed; the resulting GitHub check is tracked under T004.
