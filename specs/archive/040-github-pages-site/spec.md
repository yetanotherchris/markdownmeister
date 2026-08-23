# Feature Specification: GitHub Pages Site

**Feature Branch**: `040-github-pages-site`

**Created**: 2026-08-22

**Status**: Archived

**Input**: User description: "I want a github page website for the editor. A simple 1 page website, inside the docs/site folder (or whatever the convention is with github pages). It should preferably use tailwind CSS and be simplistic, not overly styled but minimal like the app itself, e.g. white page (or system theme) and a screenshot I'll provide, with features of the app as a bullet point list. The header should have the name, and a download button, and a github icon to point to the github repo, and current version. The screenshot will act as the 'jumbotron' for the page. It should use the icon that was created in the previous spec."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor can understand and get the app from one page (Priority: P1)

A person who has never heard of MarkdownMeister visits the project's GitHub Pages URL. One page tells them what they need: a header with the product name, a download button that takes them to the latest release, a GitHub icon linking to the source repository, and the currently released version number; below it, a real screenshot of the application as the visual centrepiece, followed by a concise bulleted list of the editor's features. Nothing more is required to decide whether to try it.

**Why this priority**: This is the entire page — every element named in the request exists to move a visitor from curiosity to download.

**Independent Test**: Open the published URL and verify each required element: name, working download link landing on the latest release, repository link with a recognisable GitHub mark, displayed version equal to the latest published release, screenshot hero, feature bullets.

**Acceptance Scenarios**:

1. **Given** the published site URL, **When** a visitor loads the page, **Then** they see a header containing the product name, a download button, a GitHub icon linking to `https://github.com/yetanotherchris/markdownmeister`, and the current released version.
2. **Given** the download button, **When** activated by any visitor on any platform, **Then** it opens the repository's latest-release location, where the current installers are listed.
3. **Given** the page body, **When** a visitor scrolls past the header, **Then** a large application screenshot forms the dominant hero region, followed by a bulleted list of the product's features.
4. **Given** a new version is released to the repository, **When** a visitor loads the page afterwards and the release lookup succeeds, **Then** the displayed version reflects that release without any manual edit to the page; if the lookup cannot complete, **Then** the deploy-time version is shown instead with no error.

---

### User Story 2 - The page looks like the app: minimal, light or dark (Priority: P2)

The page's design language mirrors the product: predominantly white under a light system appearance and an equivalent calm dark treatment when the operating system requests dark — following the visitor's own appearance preference exactly as the editor does. Styling uses Tailwind CSS utility classes with restraint: generous whitespace, no decorative excess, no animation beyond ordinary hover/focus affordances.

**Why this priority**: The user explicitly asked for "minimal like the app itself"; visual discipline is a stated requirement of the deliverable, not a nicety.

**Independent Test**: Load the page under light and dark system appearances and at phone through desktop widths; confirm the palette switches with the system preference, layout stays intact, and nothing decorative distracts from content.

**Acceptance Scenarios**:

1. **Given** a system set to light appearance, **When** the page loads, **Then** the page presents the light palette anchored on white.
2. **Given** a system set to dark appearance, **When** the page loads, **Then** the page presents the equivalent dark treatment without requiring any visitor action.
3. **Given** viewports from small-phone width to wide desktop, **When** the page is loaded at each, **Then** all elements remain readable and usable with no horizontal scrolling or overlapping content.
4. **Given** the rendered page, **When** its styling is reviewed against the product's design language, **Then** it reads as restrained and consistent with the editor's minimal character.

---

### User Story 3 - The page ships itself: publishing and freshness are automatic (Priority: P1)

The site lives as static sources inside the repository (under `docs/site`), and merges to the main branch publish it automatically through the repository's deployment workflow — no manual upload step. Version accuracy comes from the same source of truth as releases themselves rather than a hand-edited number: the page reads the latest published release when rendering and falls back to the value captured at deploy time if that lookup fails.

**Why this priority**: A landing page whose version or download button goes stale actively misleads visitors; automation is what keeps the page trustworthy after the initial excitement fades.

**Independent Test**: Merge a trivial change to the site sources, confirm the published page updates without manual steps; then compare the displayed version against the repository's latest release and simulate lookup failure to confirm the fallback value appears.

**Acceptance Scenarios**:

1. **Given** a change merged to the site sources on the main branch, **When** the deployment workflow completes, **Then** the live page reflects the change with no manual publishing step.
2. **Given** the deployed page, **When** the version shown is compared against the repository's latest published release, **Then** they match.
3. **Given** the release-metadata lookup failing (network restriction or rate limiting at view time), **When** the page loads, **Then** it still displays the deploy-time version rather than an error or blank.
4. **Given** a deployment attempt that fails, **When** the workflow finishes, **Then** the failure is visible in the repository's checks while the previously deployed page remains serving.

---

### Edge Cases

- The maintainer has not yet supplied the final screenshot: development may use a placeholder locally, but public deployment MUST NOT occur until the real screenshot is committed (see FR-005).
- The release-metadata request is slow: the page renders immediately with the fallback version and updates in place if the lookup lands; the visitor never waits on it.
- Very long version strings or future version-format changes: the header accommodates them without breaking layout.
- Visitors arriving from search engines directly to deep anchors: single-page structure means every path lands on the same complete experience.
- JavaScript unavailable or blocked: all essential content — name, links, screenshot, features, fallback version — remains present and readable; only the live version refresh degrades.
- Screen readers and keyboard-only visitors: semantic headings, meaningful alt text for the screenshot, visible focus states, and a download button reachable as ordinary keyboard focus order.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The site MUST be a single static page with no server-side components, with sources committed under `docs/site`, deployed to GitHub Pages by a repository workflow triggered by changes to those sources on the main branch.
- **FR-002**: The header MUST contain: the product name ("MarkdownMeister"), a download button navigating to the repository's latest-release location (`https://github.com/yetanotherchris/markdownmeister/releases/latest`), a GitHub icon linking to the repository root, and the currently released version number.
- **FR-003**: The displayed version MUST be sourced from the repository's published release metadata at view time, falling back to the latest version captured at deployment time when the lookup cannot complete; both paths MUST display the same format (the bare version number).
- **FR-004**: The product's features MUST be presented as a concise bullet list, maintained as part of the site sources alongside the rest of the page content.
- **FR-005**: The hero region MUST be dominated by a genuine screenshot of the application supplied by the maintainer; public deployment MUST NOT happen until that screenshot is committed, though local development MAY use a placeholder before then.
- **FR-006**: The page MUST use the product icon delivered by spec 039 — in the header as the product mark and as the browser tab favicon — derived from the same master artwork, never a redrawn variant.
- **FR-007**: Styling MUST use Tailwind CSS utility classes (user-mandated) within a deliberately minimal palette: white-anchored light presentation and a neutral equivalent dark presentation selected by the visitor's system appearance preference, matching the restraint of the product itself; no decorative animation.
- **FR-008**: The page MUST be responsive across phone through desktop widths and MUST follow semantic HTML practices: one top-level heading, descriptive alt text for the screenshot, keyboard-operable links and button, visible focus indicators.
- **FR-009**: The page MUST NOT load third-party analytics, tracking, advertising scripts, or external fonts; external requests are limited to the release-metadata lookup and assets served with the page itself.
- **FR-010**: All navigation targets (download, repository) MUST open as standard same-tab navigations; nothing on the page performs actions beyond navigation and the version lookup.

### Key Entities *(include if feature involves data)*

- **Site sources**: The static page files under `docs/site` — markup, styles, copy, screenshot, and icon assets — the single editable home of the page's content.
- **Pages deployment**: The automated publication of the built page to GitHub Pages on changes merged to main; the only path to production.
- **Release metadata lookup**: The view-time query against the repository's published release information that supplies the current version, with the deploy-time capture acting as fallback.
- **Hero screenshot**: The maintainer-supplied image of the running application forming the page's visual centrepiece.
- **Product icon reference**: The usage of spec 039's master-derived icon as header mark and favicon, keeping brand identity consistent across surfaces.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After 100% of merges touching `docs/site`, the live page reflects those changes with zero manual publishing steps, and failed deployments are visible in repository checks while the prior page keeps serving.
- **SC-002**: In 100% of post-release checks where the view-time release lookup succeeds, the version displayed equals the repository's latest published release version; in 100% of checks where the lookup fails, the page displays its deploy-time version with no error shown.
- **SC-003**: In 100% of tested combinations of light/dark appearance and phone/tablet/desktop widths, all required elements render correctly with no overlap, clipping, or unreadable contrast.
- **SC-004**: Network inspection shows zero third-party tracking/analytics/advertising/font requests across 100% of page loads.
- **SC-005**: Every required element from FR-002/FR-004/FR-005/FR-006 is present and functional on the first public deployment (verified once against the checklist).

## Clarifications

### 2026-08-22 (during specification)

- **Tailwind CSS is user-mandated**: House rules keep technology out of specifications, but the user explicitly directed Tailwind CSS for this artefact; recorded here as a binding constraint rather than silently normalised away.
- **Publishing route**: GitHub Pages' native "serve the `/docs` folder" option is unusable because this repository's `docs/` already holds project documentation (design decisions, coding standards). Deployment therefore runs through a repository Actions workflow building/serving from `docs/site`, which also matches the user's "whatever the convention is" latitude.
- **Icon dependency**: The page consumes spec 039's master artwork; if that spec has not landed when this one implements, the site blocks on the icon existing first (FR-006 makes it a hard dependency).

## Assumptions

- **Download target**: The button links to the releases-latest page covering every distribution channel; per-platform direct-download detection is deferred unless later requested.
- **Version lookup mechanism**: Client-side fetch of the repository's public release metadata with deploy-time fallback satisfies FR-003; the exact endpoint choice is planning detail.
- **Screenshot provisioning**: The maintainer supplies the screenshot file; content decisions about which app state it depicts are theirs.
- **No custom domain**: Served at the default github.io address for the repository; adding a custom domain would be a separate change.
- **Copy tone**: Feature-bullet wording follows the product's existing documentation voice; final wording approved by the maintainer during implementation.
