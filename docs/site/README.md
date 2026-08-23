# MarkdownMeister website sources

The single-page marketing site served by GitHub Pages. Everything under `docs/site/` is published verbatim by `.github/workflows/pages-deploy.yml`; there is no build step at deploy time.

**Before treating this site as public-facing:** `assets/screenshot-placeholder.svg` is stand-in artwork. Replace it with a real screenshot first (see below) — public deployment with placeholder art violates spec 040 FR-005.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The page: markup, Tailwind utility classes in `class` attributes, and one inline script |
| `styles.css` | Compiled Tailwind output — committed; regenerate after editing classes in `index.html` |
| `tailwind.input.css` | Tailwind entry point (`@import 'tailwindcss'; @source './index.html';`) |
| `assets/icon.png` | Product icon, copied unchanged from `resources/icons/256x256.png` (spec 039 master artwork) |
| `assets/screenshot-placeholder.svg` | Placeholder hero artwork pending the maintainer's screenshot |

## Regenerating styles.css

This is the canonical procedure (recorded in spec 040 research D3). The stylesheet is compiled once at authoring time and committed, so the deployed page loads zero build tooling and zero external resources. Tailwind is deliberately not a dependency of the app itself and the compiler resolves the `tailwindcss` import relative to the input file's directory, so compile from a scratch copy of these files with both packages installed beside it.

POSIX shell:

```sh
scratch=$(mktemp -d)
cp index.html tailwind.input.css "$scratch/"
cd "$scratch"
npm install --no-save tailwindcss@4 @tailwindcss/cli@4
npx @tailwindcss/cli -i tailwind.input.css -o styles.css --minify
cp styles.css "$OLDPWD/styles.css"
```

PowerShell (Windows):

```powershell
$orig = $PWD.Path
$scratch = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $scratch | Out-Null
Copy-Item index.html, tailwind.input.css -Destination $scratch
Set-Location $scratch
npm install --no-save tailwindcss@4 @tailwindcss/cli@4
npx @tailwindcss/cli -i tailwind.input.css -o styles.css --minify
Copy-Item styles.css -Destination $orig
Set-Location $orig
Remove-Item -Recurse -Force $scratch
```

If the CLI is unavailable, hand-write equivalent CSS for exactly the class names present in `index.html` and note it here.

## Swapping in the real screenshot

1. Add the screenshot to `assets/` (e.g. `assets/screenshot.png`) and update the hero `<img>` in `index.html`: change `src`, keep or improve the descriptive alt text, and set the `width`/`height` attributes to the new image's intrinsic size (they currently carry the placeholder's 1440×900).
2. Delete `assets/screenshot-placeholder.svg`.
3. Serve locally (`python3 -m http.server` in this directory) and re-check light/dark × phone/desktop.
4. Merge; confirm the Pages deployment goes green before sharing the URL publicly.

## How version stamping works

`index.html` ships with the literal token `__MM_DEPLOY_VERSION__` in two places: `<meta name="deploy-version">` (for tooling/verification) and the header's `#version` span (the visible text). At deploy time the workflow checks out full history and tags (`fetch-depth: 0`, `fetch-tags: true`) so the tag can actually resolve — under checkout's shallow default it never would — then computes the version as the latest git tag via `git describe --tags --abbrev=0`, falling back to `package.json`'s version when no tag exists. The value is validated against `^[0-9A-Za-z][0-9A-Za-z.+-]*$` before use (it is repository-controlled input), stripped of any leading `v`, substituted into both occurrences, and the artifact is uploaded. Locally the token shows raw until you stamp it yourself or the live lookup succeeds.

At view time a small inline script fetches `https://api.github.com/repos/yetanotherchris/markdownmeister/releases/latest` (`Accept: application/vnd.github+json`, 4-second timeout), strips the leading `v` from `tag_name`, and updates the span only on success. If the request fails or is rate-limited, the deploy-time value stays and nothing errors — visitors never wait on it.

## Possible follow-ups (documented, not implemented)

- Meta Content-Security-Policy: GitHub Pages cannot send custom headers, so a `<meta http-equiv="Content-Security-Policy">` (e.g. `default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self' 'sha256-<inline-script-hash>'; connect-src https://api.github.com`) would neutralise any future external-resource regression. Pure defense-in-depth today — deferred until there is something beyond that to justify maintaining a script hash.
- The upload ships authoring files (`tailwind.input.css`, this README) verbatim; a staging step excluding them would trim the public artifact if that ever matters.
