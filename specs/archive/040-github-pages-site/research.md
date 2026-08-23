# Research: GitHub Pages Site

Date: 2026-08-23. Each decision states the choice, the evidence, and the rejected alternatives. Tool claims were verified by running the tools in this repository during planning.

## D1 — Pages deployment route: Actions workflow from `docs/site`

**Decision**: Deploy with a repository workflow (`actions/configure-pages` → `actions/upload-pages-artifact` (path `docs/site`) → `actions/deploy-pages`) triggered by pushes to `main` filtered to `docs/site/**` and the workflow file itself. Permissions: `pages: write`, `id-token: write`; concurrency group `github-pages`.

**Rationale**: GitHub Pages' native "deploy from branch: `/docs` folder" option is unusable here — this repo's `docs/` root already holds project documentation (`DESIGN_DECISIONS.md`, `codingstandards.md`, `domain-policies.md`), and publishing the whole folder would expose internal documents on the public site. The spec records exactly this constraint (Clarifications 2026-08-22). The artifact-based Actions route publishes only the chosen subdirectory, needs no build output branch polluting the tree, and reports failures in repository checks while the previous deployment keeps serving (SC-001).

**Alternatives considered**:

- *Branch-based Pages from a `gh-pages` branch* — adds a second long-lived branch and a manual-or-scripted publish step; contradicts US3's "no manual upload step" spirit and complicates rollback visibility. Rejected.
- *Publishing the whole `docs/` folder* — exposes internal docs publicly; rejected outright.
- *Jekyll/GitHub's default site processor* — a static single page gains nothing from a site generator and would add an implicit build layer to debug. Rejected (the workflow can disable Jekyll processing implicitly by shipping plain files; no `.nojekyll` is needed since no underscore-prefixed paths are used, but adding one is harmless if ever needed).

## D2 — Release-metadata endpoint: `api.github.com/repos/yetanotherchris/markdownmeister/releases/latest`

**Decision**: The page's inline script fetches `https://api.github.com/repos/yetanotherchris/markdownmeister/releases/latest` with header `Accept: application/vnd.github+json`, reads `tag_name`, strips a leading `v`, updates the `#version` span text only on success, and aborts after 4 seconds so visitors never wait on it.

**Rationale**: `releases/latest` returns only the latest non-prerelease, non-draft release — exactly the version the Download button lands on (`/releases/latest`) — so the two can never disagree. It is unauthenticated public data; the documented rate limit for unauthenticated requests applies per-IP, which is why the deploy-time fallback exists (FR-003) and why failure is silent. `application/vnd.github+json` is GitHub's documented current API version header.

**Alternatives considered**:

- *In-page query of the download redirect* — following `releases/latest` as a redirect to learn the tag requires CORS-exposed responses that navigation requests don't provide; not usable client-side. Rejected.
- *Atom feed `releases.atom`* — parseable but semantically "recent releases", not "latest release"; more parsing for the same answer. Rejected.
- *Server-side stamping only (no view-time refresh)* — would go stale between deploys whenever a release ships without touching `docs/site`, failing US3 scenario 2 ("without any manual edit to the page"). Rejected; the deploy-time value remains solely as fallback.

## D3 — Tailwind strategy: compile once at authoring time, commit the output

**Decision**: Tailwind CSS v4 compiled once at authoring time via the npm CLI (`@tailwindcss/cli@4`) with `tailwind.input.css` containing `@import "tailwindcss"; @source "./index.html";`. Because Tailwind is deliberately not a dependency of the app, the canonical regeneration procedure compiles from a scratch copy of the site sources with `tailwindcss@4` and `@tailwindcss/cli@4` installed beside them (docs/site/README.md). The compiled stylesheet is committed as `docs/site/styles.css`; neither CI nor the deployed page depends on Node or Tailwind at all.

**Evidence**: Verified locally during planning — `@tailwindcss/cli@4.x` runs via npx on Node 22, scans `index.html` through the `@source` directive, emits utilities plus preflight into a single self-contained stylesheet containing no external URLs. The `tailwindcss` import resolves relative to the input file's directory, which is why the scratch-copy install (not an in-repo compile) is the documented procedure. Dark mode defaults to the `prefers-color-scheme` media query in v4, matching FR-007's system-appearance requirement without configuration.

**Rationale**: The deployed artefact must make zero external requests (FR-009) and should never break because a CDN was down or a CDN script was compromised; committing the compiled CSS keeps the runtime dependency-free and makes the exact shipped bytes reviewable in PRs. Regeneration is documented and reproducible (docs/site/README.md).

**Alternatives considered**:

- *Tailwind Play CDN script* — a runtime JIT compiler fetched from a third-party host; violates FR-009 directly. Rejected.
- *Tailwind as a project devDependency + npm script* — works, but pins a heavy toolchain onto every contributor and every `npm install` for a one-file site authored rarely; the scratch-copy npx procedure achieves identical output on demand. Rejected for now (switching later is trivial and byte-compatible given the pinned major).
- *Hand-written utility CSS* — acceptable fallback if tooling were unavailable, but the CLI compiles cleanly here, so the generated path wins (single source of truth in the markup's class attributes). Documented as the fallback in docs/site/README.md regardless.

## D4 — Version stamping mechanics: placeholder token substituted at deploy time

**Decision**: `index.html` carries the literal token `__MM_DEPLOY_VERSION__` in both the `<meta name="deploy-version" content="…">` and the `#version` span text. The workflow checks out full history and tags (`fetch-depth: 0`, `fetch-tags: true`), computes `VERSION` as `git describe --tags --abbrev=0` (falling back to `npm pkg get version`, quote-stripped, when no tag exists), validates it against `^[0-9A-Za-z][0-9A-Za-z.+-]*$` before use (it is repository-controlled input reaching both a `sed` program and a `$GITHUB_OUTPUT` field), strips a leading `v`, substitutes the token with `sed`, then uploads the artifact. Both display paths show the bare version number (FR-003): the deploy-time value is v-stripped exactly like the fetched `tag_name`.

**Rationale**: A unique token makes the substitution idempotent, value-independent, and obvious to reviewers (nothing else in the file can collide); it also makes clear which text is generated versus authored. `git describe --tags --abbrev=0` resolves the most recent reachable tag, matching how `build-release.yml` cuts releases from tags; the checkout must fetch full history and tags for that command to succeed at all — under checkout's shallow default (depth 1, no tags) it can never resolve and the fallback would silently always win. The package.json fallback covers repositories with no tags yet. Verified locally: `git describe --tags --abbrev=0` → `v1.2.1`; `npm pkg get version` → `"1.2.1"` (quoted, hence the strip).

**Alternatives considered**:

- *Commit the live version number as initial text and regex-replace whatever is there* — nicer raw local rendering, but the substitution becomes pattern-matched against evolving markup and stale committed numbers mislead readers about provenance. Rejected (recorded in plan.md Complexity Tracking).
- *Build-time fetch of the same endpoint in CI* — duplicates the view-time lookup for no benefit; deploy-time value should be cheap and deterministic. Rejected.
