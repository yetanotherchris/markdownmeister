# Verification: Browser Security Updates

## Local Checks

Checks run on Windows with temporary Node.js 22.23.4 and npm 12.2.0 unless noted.

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run check`: passed with no new maintainability violations.
- `npm test`: 1,173 passed, two existing Mac App Store tests exceeded the five-second timeout under the default parallel run.
- `npm run test -- --maxWorkers=2`, invoked through npm's CLI entry point to avoid wrapper argument parsing: all 97 files and 1,175 tests passed.
- `npm run test:e2e -- tests/e2e/browser-security.spec.ts`: two passed. Actual selected runtime versions meet the recorded release baseline; renderer Node globals remain unavailable, isolation preferences remain enabled, and popups are denied.
- `npm run docs:test:e2e`: six passed against installed Chrome stable 156.0.8078.76.
- `npm run test:e2e`: 447 passed, one existing Linux-only Debian packaging test skipped on Windows.
- `npm run test:e2e -- tests/e2e/caret-sync.spec.ts`: all 15 passed after correcting the helper's downward-only search. The expanded edited-source scenario passed ten consecutive runs with `node node_modules/playwright/cli.js test tests/e2e/caret-sync.spec.ts --grep "editing in source preserves the edit" --repeat-each=10`. With the old helper temporarily restored, that same expanded scenario failed at the original `revealSourceLine` assertion, demonstrating the regression coverage.
- `npx eslint tests/e2e/caret-sync.spec.ts` and Prettier with checkout line endings accepted: passed after the helper correction.
- `node node_modules/electron-builder/cli.js --win --x64 --dir --publish never --config.electronDist=node_modules/electron/dist --config.directories.output=C:/Users/chris/AppData/Local/Temp/opencode/browser-security-package`: passed. Built an unsigned unpacked Windows x64 application using Electron 43.8.6. This is not a signed installer or Store submission test.
- The unpacked Windows executable, run with `ELECTRON_RUN_AS_NODE=1`, reported Electron 43.8.6, Chromium 150.0.7871.250, and Node.js 24.22.1. These values were checked with runtime assertions.
- `npm audit --json`, using system Node.js/npm for registry access: no advisory reported for Electron, Playwright, playwright-core, or @playwright/test. Overall audit still reports 41 affected packages (one critical, eight high, 28 moderate, four low), outside the requested browser update scope.
- `npm run format:check`: reports 149 files on this Windows checkout, including unchanged files. Do not reformat unrelated code. The Linux GitHub formatting gate passed in run 41523561006.
- `git diff --check`: passed.
- `actionlint .github/workflows/quality.yml`: passed using the checksum-verified actionlint 1.7.12 Windows release. The quality workflow now runs documentation tests once inside the Chrome-enabled Linux image, retains failure traces, and removes the documentation container.

## GitHub Verification

- [Run 41523561006](https://github.com/yetanotherchris/markdownmeister/actions/runs/41523561006), on the CI documentation-coverage fix: validate and both Linux app shards passed. Shard 1 passed 224 app tests and all six documentation tests in stable Chrome; shard 2 passed 221 app tests. This also exercised Debian packaging on Linux. The earlier run's caret-sync failure and its subsequent setup correction are recorded in research.md.
- The test-helper correction is later than that run and triggers another quality run. Check the current PR head before readiness. Current results are kept in the PR Testing section rather than requiring a new commit solely to record each CI completion.
- All five required reviews posted. The test review's minor Linux documentation-execution finding was fixed and the reviewer confirmed resolution. The later caret helper correction receives a focused test-review follow-up.

## Gaps

- Local Linux Docker build and execution are unavailable because the Docker Desktop Linux daemon is not running. The client successfully resolved the new image's digest from the registry. Linux image execution was instead verified by the GitHub run above and remains required on the final PR head.
- macOS execution, signing, and installation were not tested on this Windows host. The chosen Electron 43 patch line preserves the prior macOS support boundary.
- Individual newer Chromium CVEs were not exhaustively mapped to Electron's backported commits. A clean npm result does not prove exhaustive Chromium coverage.
