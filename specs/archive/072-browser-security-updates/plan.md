# Implementation Plan: Browser Security Updates

**Branch**: `spec-072-browser-security-updates` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Technical Decisions

- Upgrade Electron from 43.3.0 to 43.8.6. Its release metadata reports Chromium 150.0.7871.250, Node.js 24.22.1, and current browser security backports. The user selected this maintained patch line after compatibility review showed Electron 44+ drops macOS 12 and changes clipboard APIs. Keep the existing dependency range style and regenerate the lockfile without a broad dependency update. Do not claim that Chromium's version number proves coverage of each later Chrome CVE.
- Upgrade `@playwright/test`, `playwright`, and `playwright-core` together to 1.64.1. Match the Docker image tag and pin its registry-provided manifest digest.
- Set `channel: 'chrome'` in `playwright.docs.config.ts`. Install stable Chrome in the Linux x64 test image using the locked Playwright CLI after `npm ci`. Do not install or overwrite the user's local Chrome; verify and use the existing installation.
- Update the image's Node.js 22 pin from 22.23.3 to 22.23.4, the patched release for CVE-2026-111497. Use temporary Node.js 22.23.4 and npm 12.2.0 tools for local verification because the system tools are below the project's declared requirements.
- Add a runtime security e2e test checking the actual selected Electron, Chromium, and Node.js versions, the configured isolation preferences, unavailable renderer Node globals, and popup denial. The application version checks identify the patched release baseline, not per-CVE backport completeness. Add a unit configuration regression test for the documentation browser and matching image/lockfile versions.
- Add testing instructions, including the global-install warning for `playwright install chrome`. Copy documentation sources and their config into the test image so the documented container command can run the site suite.
- Run documentation e2e once in the quality workflow, on the first app shard's Linux runner, using the same built image. Preserve documentation failure traces and remove its container even on failure. This closes the test review's Linux Chrome execution gap without rebuilding an image or running the site suite twice.
- The first Linux CI run failed in the existing caret-sync test's `revealSourceLine` helper after filling source content. That helper only searches downward and can never find earlier text if filling leaves the viewport below it. Make the helper wrap at the document end, and explicitly start the edited-source scenario at the end to cover that case. Keep all caret mapping and edit preservation assertions. This is test setup correction, not an application behavior change.

## Constitution Check

No changes to renderer APIs, IPC, path validation, saving, permissions, or confirmation handling are planned. Runtime isolation is explicitly checked against the real built app. Full app e2e and documentation e2e are required because the runtime and test browser change.

## Verification

Run lint, typecheck, unit tests, maintainability, the full application e2e suite, and documentation e2e. When Docker's daemon is available, build the Linux image and run its two app shards sequentially, then documentation tests. Otherwise record the local Linux gap and use the PR's Linux CI results without describing them as a local Docker run. Check audit output for Electron and Playwright separately from unrelated advisories. Build an unpacked Windows application to check packaging compatibility with the Electron update when supported locally.

After opening the PR, obtain the five repository-required reviews (correctness, security, spec compliance, code quality, tests), address each finding, and check GitHub gates. Do not merge.

## Complexity Tracking

No constitutional deviations. A stable Chrome installation is an intentional test prerequisite approved by the user. The Playwright image retains its bundled browsers, but these suites select Electron or Chrome rather than launching its older bundled Chromium.
