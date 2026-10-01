# MarkdownMeister project site

The single-page site served by GitHub Pages. It is built by Vite from the sources here and deployed from the build output by `.github/workflows/pages-deploy.yml`, matching the structure used by the `app-20-desktop` documentation site.

## Files

| Path | Purpose |
|------|---------|
| `index.html` | Vite entry; mounts the React app from `src/main.tsx` |
| `vite.config.ts` | Build config: `base: './'`, output to `dist/` |
| `tsconfig.json` | The site's TypeScript project (checked by `npm run typecheck`) |
| `src/main.tsx` | React entry point |
| `src/site.tsx` | The page: header, sidebar, sections, footer |
| `src/content.ts` | Content: features, install commands, shortcuts, settings reference, folder actions |
| `src/styles.css` | Plain CSS with light/dark via `prefers-color-scheme` |
| `public/privacy.html` | The privacy policy, copied verbatim to the build root so the Microsoft Store URL resolves |
| `public/version.json` | Release version, stamped by the Pages workflow before the build |
| `public/assets/logo.png` | 512px product logo (byte copy of the 512 ladder entry), used as the header mark, hero logo, and favicon |
| `public/assets/screenshot-1.png` | Main window screenshot |
| `public/assets/screenshot-2.png` | File menu and find-and-replace screenshot |

## Authoring

```sh
npm run docs:dev      # dev server with hot reload
npm run docs:build    # production build into docs/site/dist
npm run docs:preview  # serve the built output
```

The docs are covered by `npm run lint`, `npm run typecheck`, and the `tests/docs` Playwright suite (`npm run docs:test:e2e`, which builds first and serves `docs/site/dist`).

## Content accuracy

The shortcuts in `src/content.ts` must match `src/main/shortcuts.ts`, and the settings reference must match `src/shared/ipc-contract.ts`. `tests/main/siteContract.test.ts` asserts the source and deploy contract; update it alongside any structural change here.

## Version stamping and privacy URL

`pages-deploy.yml` substitutes the release tag into `public/version.json` before `npm run docs:build`, so the sidebar and footer show the release version. The page also refreshes the version from the repository's latest release at runtime, on success only.

The privacy policy is a static file because the Microsoft Store listing links to `https://yetanotherchris.github.io/markdownmeister/privacy.html`; a client-side route would 404 on GitHub Pages.
