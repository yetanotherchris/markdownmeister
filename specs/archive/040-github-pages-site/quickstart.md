# Quickstart: GitHub Pages Site

Validation for spec 040. The contract tests (`tests/main/siteContract.test.ts`) run in CI; the visual matrix below is manual because appearance, responsiveness, and no-JS behaviour need a real browser. The deployment checklist gates public launch (FR-005).

Prerequisites: `npm install` (for the test/lint toolchain). Serving needs nothing but a static file server.

## Local verification

```sh
cd docs/site
# optional: stamp the deploy-time version locally so the header shows a real number
npx replace-in-files-cli --string '__MM_DEPLOY_VERSION__' --replacement '1.2.1' index.html   # or edit by hand; do NOT commit a stamped file
python -m http.server 8080    # or: npx serve .
```

Open http://localhost:8080.

## US1 — One page tells a visitor everything

1. Header contains the product icon, the name **MarkdownMeister** (single `h1`), a version display, a **Download** button, and a GitHub mark.
2. Click Download → lands on `https://github.com/yetanotherchris/markdownmeister/releases/latest` in the same tab (FR-010).
3. Click the GitHub icon → lands on `https://github.com/yetanotherchris/markdownmeister`.
4. With network available, wait ≤ 4 s: the displayed version equals the repository's latest published release, bare number, no `v` prefix (FR-003).
5. Block/unplug network and reload (or serve offline): the page renders fully with the deploy-time fallback version and **no error UI** (US3 scenario 3). With the token unstamped it shows `__MM_DEPLOY_VERSION__`; stamped builds show the bare number.

## US2 — Looks like the app: minimal, light/dark, responsive (manual)

6. System light: page is white-anchored; system dark: calm neutral dark — no other change needed (FR-007).
7. Widths 320 / 768 / 1280 px: no horizontal scrolling, no overlap; the hero screenshot dominates below the header at every width.
8. Tab through the page: every link/button shows a visible focus indicator; order follows reading order (FR-008).
9. Nothing decorative animates beyond ordinary hover/focus transitions.

## US3 — Ships itself (post-merge)

10. After merge to main, the workflow run appears under Actions and completes; the published page reflects the merged change with no manual step (SC-001).
11. Compare displayed vs released version after the next release ships without touching `docs/site`: they match once the visitor's lookup succeeds (SC-002).

## Deployment checklist — before treating the site as public-facing (FR-005 gate)

- [ ] Replace `docs/site/assets/screenshot-placeholder.svg` with a genuine screenshot of the running app (e.g. `assets/screenshot.png`, same filename referenced in `index.html`, descriptive alt text kept).
- [ ] Confirm the placeholder artwork no longer exists anywhere under `docs/site/`.
- [ ] Serve locally once more (steps above) and re-check the visual matrix against the real screenshot.
- [ ] Merge; confirm the Pages deployment went green and the live page shows the real screenshot.

Until that swap lands, any deployed copy must be treated as internal preview only.

## Automated checks (CI)

```sh
npm run lint
npm run typecheck
npm run test          # includes tests/main/siteContract.test.ts:
                      #   required elements present (h1, download href exact, repo link exact,
                      #   favicon, alt text, feature bullets, version span + deploy-version meta)
                      #   inline script performs the releases/latest lookup with a timeout
                      #   audit: no externally loaded resources besides api.github.com fetch
                      #   workflow: push→main paths filter, permissions, concurrency, upload path
npm run check
npx prettier --check tests/main/siteContract.test.ts
npm run test:e2e      # application suite must stay green untouched (site-only change)
```

## Failure triage

- Version never updates on the live site → check browser console/network: the fetch to `api.github.com/repos/.../releases/latest` must return 200; rate-limited visitors see the fallback by design.
- Workflow runs on unrelated merges → paths filter missing or malformed; compare `.github/workflows/pages-deploy.yml` `on.push.paths`.
- Page deploys but styles are missing → `styles.css` not committed or `href="styles.css"` renamed; both must match.
