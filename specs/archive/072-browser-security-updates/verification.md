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
- `npm run test:e2e`: full Windows application suite in progress.
- `node node_modules/electron-builder/cli.js --win --x64 --dir --publish never --config.electronDist=node_modules/electron/dist --config.directories.output=C:/Users/chris/AppData/Local/Temp/opencode/browser-security-package`: passed. Built an unsigned unpacked Windows x64 application using Electron 43.8.6. This is not a signed installer or Store submission test.
- `npm audit --json`, using system Node.js/npm for registry access: no advisory reported for Electron, Playwright, playwright-core, or @playwright/test. Overall audit still reports 41 affected packages (one critical, eight high, 28 moderate, four low), outside the requested browser update scope.
- `npm run format:check`: reports 149 files on this Windows checkout, including unchanged files. Do not reformat unrelated code. Confirm formatting against the Linux GitHub gate.
- `git diff --check`: passed.

## Gaps

- Local Linux Docker build and execution are unavailable because the Docker Desktop Linux daemon is not running. The client successfully resolved the new image's digest from the registry. PR CI must validate the Linux image and app shards.
- macOS execution, signing, and installation were not tested on this Windows host. The chosen Electron 43 patch line preserves the prior macOS support boundary.
- Individual newer Chromium CVEs were not exhaustively mapped to Electron's backported commits. A clean npm result does not prove exhaustive Chromium coverage.
