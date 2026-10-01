# Research: Project Site Rebuild

Date: 2026-09-30. Decisions with evidence, verified against the installed toolchain and the `app-20-desktop` repository.

## D1: Supersede spec 040's no-build decision with a Vite build

**Decision**: Build `docs/site` with Vite into `docs/site/dist` and deploy the output, replacing the committed compiled Tailwind stylesheet and verbatim static deploy.

**Evidence**: Spec 040 research D3 chose "compiled once at authoring time and committed, so the deployed page loads zero build tooling". The user has asked for the `app-20-desktop` approach, which is a Vite site (`.github/workflows/docs.yml` runs `npm run docs:build` and uploads `docs/site/dist`). Vite 7.3.6 is already installed in this repository via `electron-vite` 5 (peer `vite: ^5 || ^6 || ^7`), so the toolchain is already present.

**Alternatives considered**: Keep the static page and only restyle it (rejected: the user asked for the built-site structure); add a separate workspace package (rejected: overkill for one page in a single-package repo).

## D2: Keep the privacy policy a static file

**Decision**: Put the privacy policy at `docs/site/public/privacy.html`; Vite copies `public/` to the build root, so it deploys as `privacy.html` rather than a client route.

**Evidence**: The Microsoft Store listing references `https://yetanotherchris.github.io/markdownmeister/privacy.html` (spec 062). A single-page build would otherwise 404 that path because the app only renders client-side routes. A file in `public/` is served verbatim by GitHub Pages.

**Alternatives considered**: A hash route (`#/privacy`) or a server rewrite (rejected: GitHub Pages has no rewrites, and the Store URL is fixed).

## D3: Reuse the renderer's React toolchain; no new runtime dependency

**Decision**: Use React 19 (already a dependency), `@vitejs/plugin-react` 4.7 and `vite` 7 (already installed), and add `vite` as an explicit devDependency.

**Evidence**: `package.json` already lists `react`, `react-dom`, and `@vitejs/plugin-react`; `electron.vite.config.ts` uses the same plugin for the renderer. The docs config imports `vite` directly, so declaring it avoids relying on a transitive dependency.

**Alternatives considered**: A vanilla-TS Vite site (rejected: the user asked for the React structure used by `app-20-desktop`).

## D4: Version shown from a deploy-time file with a runtime refresh

**Decision**: Stamp the release version into `docs/site/public/version.json` before the build, and refresh from `https://api.github.com/repos/yetanotherchris/markdownmeister/releases/latest` at runtime on success only.

**Evidence**: Spec 040's page (FR-003) already shows a deploy-time version and refreshes from the releases API with a timeout and success-only update. Keeping both preserves the behaviour through the rebuild.

**Alternatives considered**: Runtime-only or deploy-time-only (rejected: each loses behaviour the current site has).

## D5: Site covered by lint, typecheck, format, and a docs e2e

**Decision**: Add the site TypeScript project to `npm run typecheck`, the site sources to the `format:check` list, and a Playwright config plus `tests/docs/site.spec.ts` that serves the built output.

**Evidence**: `app-20-desktop` has `playwright.docs.config.ts` and `tests/docs/`, serves `docs/site/dist` with `npx serve`, and runs the docs build before the docs e2e. This repository's quality gate runs lint/typecheck/format/unit for anything that changes `package.json` or `tests/`, so the site must be covered.

**Alternatives considered**: Leave the site out of the gates (rejected: it would rot).
