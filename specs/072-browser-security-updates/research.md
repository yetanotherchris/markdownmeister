# Research: Browser Security Updates

## Runtime

- [Electron 45.2.1 release](https://releases.electronjs.org/release/v45.2.1), checked 2026-11-02: Chromium 156.0.8078.75, Node.js 24.22.1. Registry engine requirement: Node.js >=22.12.0.
- [CVE-2026-102677](https://github.com/advisories/GHSA-qmv3-fv6v-rmhq): preload-cache poisoning fixed in Electron 43.5.0 and later supported lines. Requires a compromised renderer and untrusted content.
- [CVE-2026-115570](https://github.com/advisories/GHSA-jr5w-w6x2-84p9): compromised certificate mitigation, fixed in Electron 43.8.1 and 45.0.0-beta.6, among other lines.
- [CVE-2026-113303](https://www.cve.org/CVERecord?id=CVE-2026-113303): critical Chromium WebRTC memory corruption fixed in Chrome 156.0.8078.47. Older Electron major lines were not selected solely from their Chromium version because they can backport fixes; the current stable line directly clears this version boundary.

## Automation and Browser Selection

- Registry latest `@playwright/test` is 1.64.1. Its [browser manifest](https://github.com/microsoft/playwright/blob/v1.64.1/packages/playwright-core/browsers.json) still specifies Chromium 156.0.8078.4. Upgrading this package alone does not clear the reviewed Chromium fix boundary.
- The user approved Chrome stable for documentation tests on 2026-11-02. [Playwright browser documentation](https://playwright.dev/docs/browsers) supports `channel: 'chrome'` and `npx playwright install chrome`. That installation command modifies the operating system's default Chrome installation, so local installation is documented rather than performed automatically.
- `docker buildx imagetools inspect mcr.microsoft.com/playwright:v1.64.1-noble` returned index digest `sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f`.
- Chrome stable on this Windows host is 156.0.8078.76. Docker's client is installed but its Linux daemon is unavailable. System Node.js 22.14.0 and npm 11.4.2 do not meet package.json; temporary tools provide Node.js 22.23.4 and npm 12.2.0 without changing the system installation.

## Scope

The original audit reported 42 affected packages, including unrelated editor and build-tool dependencies. This change is limited to the requested browser/runtime updates and the tooling required to exercise them. It does not assert that the entire dependency tree is vulnerability-free.
