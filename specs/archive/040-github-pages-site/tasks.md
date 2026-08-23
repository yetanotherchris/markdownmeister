# Tasks: GitHub Pages Site

**Input**: Design documents from `/specs/040-github-pages-site/`

**Prerequisites**: plan.md, research.md, quickstart.md, spec.md

**Tests**: `tests/main/siteContract.test.ts` fs-reads the site sources and the workflow (node-env Vitest project; no config change needed). Visual/appearance/responsive scenarios are manual per quickstart.md.

**Organization**: By user story. US1+US2 build the page itself; US3 publishes it. The site is additive — no application source changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 2 — Page skeleton with Tailwind styling (Priority: P2)

**Goal**: The page exists with its minimal light/dark responsive design system in place (FR-007/FR-008), ready to receive content.

### Implementation for User Story 2

- [x] T001 [P] [US2] Create docs/site/tailwind.input.css (`@import "tailwindcss"; @source "./index.html";`), compile docs/site/styles.css via `npx @tailwindcss/cli@4 -i tailwind.input.css -o styles.css --minify`, and author docs/site/index.html: semantic single-page structure (one `h1` "MarkdownMeister", header/main/footer), Tailwind utility classes only, white-anchored light palette + neutral dark via default `prefers-color-scheme` behaviour, generous whitespace, no decorative animation beyond hover/focus transitions, visible focus indicators, responsive phone→desktop. Zero external resources (no CDN scripts/webfonts/analytics); favicon wired to assets/icon.png.

**Checkpoint**: Page served locally reads as restrained white-on-light / dark-on-dark per system appearance at 320–1280 px.

---

## Phase 2: User Story 1 — Header, hero, features content (Priority: P1)

**Goal**: A first-time visitor gets name → download → repo → version → screenshot → features from one page (FR-002/004/005/006).

### Implementation for User Story 1

- [x] T002 [P] [US1] Copy resources/icons/256x256.png (spec 039 master-derived asset) to docs/site/assets/icon.png unchanged; create docs/site/assets/screenshot-placeholder.svg clearly labelled PLACEHOLDER artwork.
- [x] T003 [US1] Fill in docs/site/index.html content on top of T001's skeleton: header with icon mark + name, `<span id="version">__MM_DEPLOY_VERSION__</span>` mirrored by `<meta name="deploy-version" content="__MM_DEPLOY_VERSION__">`, Download `<a>` to exactly https://github.com/yetanotherchris/markdownmeister/releases/latest, inline-SVG GitHub icon linking exactly https://github.com/yetanotherchris/markdownmeister, hero `<img src="assets/screenshot-placeholder.svg">` with descriptive alt text, feature bullets drafted from README/docs voice (FR-004). All navigations same-tab (FR-010).
- [x] T004 [US1] Add the small inline script to docs/site/index.html: fetch https://api.github.com/repos/yetanotherchris/markdownmeister/releases/latest with Accept application/vnd.github+json, 4 s abort timeout, strip leading v from tag_name, update the span textContent on success only, silent failure otherwise (FR-003).
- [x] T005 [P] [US1] Create docs/site/README.md: exact style regeneration command (research D3), screenshot swap instructions incl. the FR-005 public-launch gate, how version stamping works (placeholder token → workflow sed → view-time refresh; research D4/D2).

**Checkpoint**: Local serve shows every US1 element; offline reload degrades to fallback version silently.

---

## Phase 3: User Story 3 — Publish automatically from main (Priority: P1)

**Goal**: Merges touching site sources deploy without manual steps; failures visible while prior page serves (SC-001).

### Implementation for User Story 3

- [x] T006 [US3] Create .github/workflows/pages-deploy.yml: push to main filtered to [`docs/site/**`, `.github/workflows/pages-deploy.yml`]; permissions pages:write + id-token:write; concurrency group github-pages; checkout → compute VERSION (`git describe --tags --abbrev=0` falling back to `npm pkg get version`, leading v stripped) → sed-substitute `__MM_DEPLOY_VERSION__` in index.html meta+span → configure-pages → upload-pages-artifact path docs/site → deploy-pages. Do not modify build-release.yml.

**Checkpoint**: Workflow YAML lints by inspection against the contract test assertions below.

---

## Phase 4: Tests & Gates

**Purpose**: Lock the contract; prove the app suite is untouched.

- [x] T007 [US1/US3] Create tests/main/siteContract.test.ts (node env project): h1 text; download href exact; GitHub link href exact; favicon link present; hero img alt non-empty; `#version` span present + `meta[name="deploy-version"]` present; inline script contains the releases/latest endpoint and a timeout mechanism; audit that index.html loads no external resources and styles.css contains no absolute URLs (api.github.com fetch exempted as the sole permitted request); workflow file triggers on push to main with both paths entries, required permissions, concurrency group github-pages, upload path docs/site. Assertions robust to formatting.
- [x] T008 Add tests/main/siteContract.test.ts to package.json format:check list (site html/css/svg stay excluded from prettier checks).
- [x] T009 Run gates until green, in order: npm install (once) → npm run lint → npm run typecheck → npm test → npm run check → npx prettier --check tests/main/siteContract.test.ts → last npm run test:e2e (retry contention failures up to 3×; proves the application suite passes untouched).
- [x] T010 As part of the implementation PR, archive the spec: `git mv specs/040-github-pages-site specs/archive/040-github-pages-site` and set its **Status** to `Archived`.
- [ ] T011 Manual (post-merge): run the quickstart visual matrix under light/dark × phone/tablet/desktop, and complete the deployment checklist's screenshot swap before treating the site as public-facing (FR-005).

---

## Dependencies & Execution Order

- Phase 1 (T001) precedes everything — the skeleton is edited in place afterwards.
- T002 can run any time before T003/T007 (assets referenced by markup/tests); T003 depends on T001+T002; T004 depends on T003; T005 independent of T003/T004.
- T006 is independent of Phases 1–2 content but tested by T007.
- T007 depends on all prior; T008–T010 are the gate sequence; T011 is post-merge/manual.

## Parallel Opportunities

T001 ∥ T002; T005 ∥ T003/T004; T006 ∥ Phase 2.
