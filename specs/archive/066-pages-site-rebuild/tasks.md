# Tasks: Project Site Rebuild

**Input**: Design documents from `/specs/066-pages-site-rebuild/`

**Prerequisites**: plan.md, research.md, spec.md

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Planning artifacts

- [x] T001 [docs] Write `specs/066-pages-site-rebuild/{spec.md,plan.md,research.md,tasks.md}`. Commit `docs(066)`.

## Phase 2: Site source (FR-001, FR-003, FR-005, FR-006, FR-007)

- [x] T002 [US1] Replace the hand-written page with a Vite entry (`docs/site/index.html`), config (`docs/site/vite.config.ts`, `base: './'`, `outDir: dist`), tsconfig, and `src/{main.tsx,site.tsx,content.ts,styles.css}` modelled on the `app-20-desktop` site. Commit `feat(066)`.
- [x] T003 [US3] Move the privacy policy to `docs/site/public/privacy.html` and the icon to `docs/site/public/assets/icon.png` so Vite copies them to the build root. Commit `feat(066)`.

## Phase 3: Build and deploy (FR-002, FR-004, FR-008, FR-009)

- [x] T004 [US3] Add `docs:dev`/`docs:build`/`docs:preview` scripts and the `vite` devDependency; add the site project to `typecheck` and the site sources to `format:check`. Commit `feat(066)`.
- [x] T005 [US3] Rewrite `.github/workflows/pages-deploy.yml` to install, build (`npm run docs:build`), and deploy `docs/site/dist`. Commit `feat(066)`.

## Phase 4: Tests

- [x] T006 [US1] Rewrite `tests/main/siteContract.test.ts` for the source/build contract and add `playwright.docs.config.ts` with `tests/docs/site.spec.ts` rendering the built site. Commit `test(066)`.

## Phase 5: Gates and lifecycle

- [x] T007 Run `npm run docs:build`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run check`, `npm test`, and the docs e2e.
- [x] T008 Add real screenshots (`docs/site/public/assets/screenshot-1.png`, `screenshot-2.png`) referenced by the built site.
