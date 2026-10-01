# Implementation Plan: Project Site Rebuild

**Branch**: `spec-066-pages-site-rebuild` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

Replace the zero-build hand-written page under `docs/site/` with a single-page site built by Vite and React, mirroring the `app-20-desktop` documentation site: an `index.html` entry, `src/` with the shell and content, a build to `docs/site/dist`, and a GitHub Pages workflow that installs, builds, and deploys the output. The privacy policy moves to a static `docs/site/public/privacy.html` so the Store URL keeps resolving as a plain file. Spec 040's "no build step at deploy time" decision is superseded.

## Technical Context

**Language/Version**: TypeScript 5.8 strict, React 19, Vite 7 (already installed transitively by electron-vite), `@vitejs/plugin-react` 4.7 (already a devDependency for the renderer). Node 22.

**Primary Dependencies**: No new runtime dependency. `vite` is added as an explicit devDependency (it is already installed via electron-vite) because the site config imports it directly.

**Storage**: None. The site reads the release version from `version.json` stamped at deploy time, with a runtime refresh from the GitHub releases API.

**Testing**: The existing `tests/main/siteContract.test.ts` is rewritten to assert the source and build contract (Vite entry, `base: './'`, build output path, static privacy page, workflow builds and deploys `dist`, no remote resources in source). A Playwright docs suite serves `docs/site/dist` and checks the rendered page, matching `app-20-desktop`'s `tests/docs` pattern.

**Target Platform**: GitHub Pages project site at `https://yetanotherchris.github.io/markdownmeister/`.

**Constraints**: The privacy URL is stable and identical before and after the rebuild. No third-party resources load at runtime. The site must not import Node or Electron modules (the renderer-isolation rule applies to the site as ordinary web code).

**Scale/Scope**: One rewritten `index.html`, one Vite config, one tsconfig, four `src` files, one static privacy page, one moved icon, one workflow change, one test rewrite, one docs e2e suite, package.json script and dependency edits.

## Constitution Check

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | Not engaged for the shipped app; the site is separate web code and imports no Node, `fs`, or Electron module. |
| II. Every Path Is Untrusted | Not engaged; no application path handling changes. |
| III. Never Lose The User's Words | Not engaged. |
| IV. Calm, Predictable Editing | Not engaged; no editor runtime change. |
| V. Test What Can Corrupt Or Escape | The site contract test and docs e2e replace the removed static-page assertions; the privacy URL is asserted to remain a static file. |

No deviations.

## Project Structure

```text
docs/site/
├── index.html              # Vite entry (module script to /src/main.tsx)
├── vite.config.ts          # base './', outDir dist
├── tsconfig.json           # site TypeScript project
├── README.md               # rewritten authoring/deploy notes
├── public/
│   ├── privacy.html        # static privacy policy (Store URL)
│   ├── version.json        # deploy-time stamped version
│   └── assets/icon.png     # moved from docs/site/assets
└── src/
    ├── main.tsx
    ├── site.tsx
    ├── content.ts
    └── styles.css
.github/workflows/pages-deploy.yml   # build then deploy docs/site/dist
tests/main/siteContract.test.ts      # rewritten source/build contract
tests/docs/site.spec.ts              # rendered-site e2e
playwright.docs.config.ts            # serves docs/site/dist
```

## Complexity Tracking

1. **Supersedes spec 040's no-build decision.** Chosen deliberately by the user to match `app-20-desktop`; the simpler alternative (keep the static page) was rejected because it cannot provide the requested structure. Recorded in `research.md` D1.
2. **`vite` becomes an explicit devDependency.** It is already installed transitively by electron-vite 5; declaring it makes the site config's direct import honest. Justified under the constitution's dependency rule.
