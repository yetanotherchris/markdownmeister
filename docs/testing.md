# Running tests

Use Node.js 22 satisfying `package.json` and npm 12. Install dependencies with `npm ci`.

## Application

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

The application tests build and launch the project's Electron runtime. They do not use Playwright's bundled Chromium. The browser-security suite checks runtime versions, isolation preferences, renderer globals, and popup denial. Linux headless app tests use the existing `--no-sandbox` launch flag, so their preference checks do not prove that Chromium's operating-system sandbox is active.

## Documentation

Keep Google Chrome stable updated, then run:

```sh
npm run docs:test:e2e
```

The documentation configuration selects `channel: 'chrome'`. Missing Chrome is an error, not a reason to fall back to Playwright's bundled Chromium. The suite also rejects browser versions older than the reviewed security fix boundary, 156.0.8078.47. This boundary is a regression check for the reviewed fixes, not a guarantee against future vulnerabilities.

If Chrome is not installed, install it through your operating system or run `npx playwright install chrome`. That command installs Chrome globally and can replace an existing browser installation. Do not run it on a managed machine without approval.

## Linux test image

The image installs stable Chrome at build time and pins its Playwright base image by digest. Chrome's package is intentionally resolved from the stable channel rather than frozen to the older browser in that base image. The Chrome installation requires Linux x64. Rebuild the image to pick up browser security updates.

```sh
docker build -f tests/e2e/Dockerfile -t markdownmeister-e2e .
docker run --rm --shm-size=1g markdownmeister-e2e sh -lc 'xvfb-run -a env MM_E2E_HEADED=1 npm run test:e2e -- --shard=1/2'
docker run --rm --shm-size=1g markdownmeister-e2e sh -lc 'xvfb-run -a env MM_E2E_HEADED=1 npm run test:e2e -- --shard=2/2'
docker run --rm --shm-size=1g markdownmeister-e2e sh -lc 'npm run docs:test:e2e'
```

Run the two app shards sequentially so Electron processes do not compete for resources. The bundled browsers remain in the base image, but these test commands launch Electron or stable Chrome instead.
