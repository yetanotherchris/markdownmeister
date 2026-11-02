# Implementation Plan: Browser Security Updates

**Branch**: `spec-072-browser-security-updates` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Technical Decisions

- Upgrade Electron from 43.3.0 to 43.8.6. Its release metadata reports Chromium 150.0.7871.250, Node.js 24.22.1, and current browser security backports. The user selected this maintained patch line after compatibility review showed Electron 44+ drops macOS 12 and changes clipboard APIs. Keep the existing dependency range style and regenerate the lockfile without a broad dependency update. Do not claim that Chromium's version number proves coverage of each later Chrome CVE.
- Upgrade `@playwright/test`, `playwright`, and `playwright-core` together to 1.64.1. Match the Docker image tag and pin its registry-provided manifest digest.
- Set `channel: 'chrome'` in `playwright.docs.config.ts`, as approved by the user. Use the existing updated Chrome installation. No Chrome installation, documentation sources, or documentation test configuration is added to the Linux application-test image.
- Update the image's Node.js 22 pin from 22.23.3 to 22.23.4, the patched release for CVE-2026-111497. Use temporary Node.js 22.23.4 and npm 12.2.0 tools for local verification because the system tools are below the project's declared requirements.
- Remove the agent's scope expansion: added tests and their helper, testing documentation, CI documentation-test steps, extra image inputs, and unrelated caret-test changes. Restore existing tests and workflows exactly to the base revision. The correction uses `spec-072-browser-security-scope-correction` and updates the same PR without rewriting its history.

## Constitution Check

No changes to renderer APIs, IPC, path validation, saving, permissions, or confirmation handling. Verify the runtime upgrade with the existing application and documentation suites, not new product requirements or new tests.

## Verification

Run lint, typecheck, unit tests, maintainability, and existing application and documentation e2e. When Docker's daemon is available, build the Linux image and run its two app shards sequentially. Otherwise record the local Linux gap and use the PR's Linux CI results without describing them as a local Docker run. Check audit output for Electron and Playwright separately from unrelated advisories. Record current verification results and review dispositions in the PR.

After opening the PR, obtain the five repository-required reviews (correctness, security, spec compliance, code quality, tests), address each finding, and check GitHub gates. Do not merge.

## Complexity Tracking

No constitutional deviations. A stable Chrome installation is an intentional test prerequisite approved by the user. The Playwright image retains its bundled browsers, but these suites select Electron or Chrome rather than launching its older bundled Chromium.
