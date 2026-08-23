# Implementation Plan: GitHub Pages Site

**Branch**: `phase-40-github-pages-site` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/040-github-pages-site/spec.md`

## Summary

A one-page static website under `docs/site` introduces MarkdownMeister to visitors and moves them to download: header (product icon + name, live-updating version, Download button, GitHub mark), a screenshot hero, and a short feature list drawn from the repository's own documentation voice. Styling is Tailwind utility classes compiled once and committed as plain CSS; the page ships with the app's light/dark system-appearance behaviour and no external requests beyond the release-metadata lookup. A repository workflow publishes `docs/site` to GitHub Pages automatically on merges to main that touch the site sources, stamping the deploy-time version into the page at build time.

## Technical Context

**Language/Version**: Static HTML/CSS/SVG plus a small inline ES2017+ script (no build step for the page itself); GitHub Actions YAML

**Primary Dependencies**: Tailwind CSS CLI (dev-time only, output committed — no runtime dependency); `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`

**Storage**: None — static files only

**Testing**: `tests/main/siteContract.test.ts` (Vitest node project) fs-reads the site sources and workflow, asserting FR-002/003/004/005/006/008/009 shapes: required elements, exact navigation targets, the bulleted feature list, no externally loaded resources, workflow wiring. Visual/responsive/appearance checks are manual per [quickstart.md](quickstart.md).

**Target Platform**: Any modern browser served by GitHub Pages at the default github.io URL

**Performance Goals**: Single page load, one stylesheet, no blocking third-party requests

**Constraints**: FR-009 limits external requests to the release lookup; FR-010 same-tab navigation only; no application source changes (site-only change); spec 039's icon assets are consumed as-is (FR-006)

**Scale/Scope**: ~6 new site files/assets, 1 workflow, 1 test file, 1 package.json script-list edit (format:check), spec artifacts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after design: unchanged — this feature adds a documentation surface and a deployment workflow only; it touches no renderer, preload, IPC, or filesystem code.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | None — no application code changes |
| II. Every Path Is Untrusted | None — no path handling added; workflow copies fixed repo-relative paths |
| III. Never Lose The User's Words | None — no editor involvement |
| IV. Calm, Predictable Editing | Honoured in spirit — the page follows the product's minimal, calm design language (FR-007) |
| V. Test What Can Corrupt Or Escape | Honoured proportionately — the contract test locks the public-deployment gate inputs (exact links, absence of external resources, workflow paths) because a silently wrong link or an injected CDN script is a user-visible defect |

All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/040-github-pages-site/
├── plan.md              # This file
├── research.md          # D1–D4: Pages route, version endpoint, Tailwind strategy, stamping
├── quickstart.md        # Local serve matrix + pre-public-launch checklist
└── tasks.md             # Ordered work items
```

### Source Code (repository root)

```text
docs/site/
├── index.html                     # NEW: the single page
├── styles.css                     # NEW: compiled Tailwind output (committed)
├── tailwind.input.css             # NEW: Tailwind input (@import + @source) for regeneration
├── README.md                      # NEW: regeneration, screenshot swap, version stamping
└── assets/
    ├── icon.png                   # NEW: copy of resources/icons/256x256.png (spec 039 master artwork)
    └── screenshot-placeholder.svg # NEW: clearly labelled PLACEHOLDER hero art (FR-005 gate)
.github/workflows/pages-deploy.yml # NEW: push-to-main → stamp version → deploy docs/site
tests/main/siteContract.test.ts    # NEW: fs-based contract tests over the above
package.json                       # EDIT: add tests/main/siteContract.test.ts to format:check list
```

**Structure Decision**: The site is fully self-contained under `docs/site` so the workflow uploads exactly that directory; nothing about the Electron app's structure changes. The test lives in the existing node-env Vitest project (`tests/main/**`), which needs no config change.

## Complexity Tracking

> No constitution violations. Two deliberate simplifications versus the deliverable letter, both recorded here rather than improvised:

1. **Screenshot placeholder vs FR-005 public-deployment gate**: local development uses `assets/screenshot-placeholder.svg`, clearly labelled as placeholder artwork in both the file and the rendered page. FR-005 forbids *public deployment* until the maintainer commits a real screenshot; it is not violated by the placeholder existing in the tree. The gate is enforced procedurally: quickstart.md's deployment checklist requires the swap before treating the site as public-facing, and README.md documents the swap. The alternative — blocking all merges until the screenshot exists — would stall a purely additive site behind an asset only the maintainer can supply. Residual risk, recorded rather than hidden: enabling Pages arms this workflow against whatever sits on `main`, so merging the placeholder before the swap would publicly serve placeholder art if Pages activation precedes it. If the procedural gate proves too weak in practice, a non-blocking workflow guard (fail the deploy step while the placeholder exists) enforces FR-005 exactly without stalling merges; deliberately not implemented now to keep this phase site-only and reviewable.
2. **Version stamping via placeholder token**: `index.html` carries the literal token `__MM_DEPLOY_VERSION__` in the `<meta name="deploy-version">` content and the `#version` span text; the workflow substitutes it at deploy time (`sed`). Locally the token shows raw until stamped or until the view-time fetch replaces the span. The rejected alternative was committing the current package version as the initial text and regex-replacing whatever value is present at deploy time — it looks nicer locally but hides which text is authored vs generated and makes the CI substitution value-dependent. Documented in docs/site/README.md and quickstart.md.
