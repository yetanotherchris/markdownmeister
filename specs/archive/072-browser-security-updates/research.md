# Research: Browser Security Updates

## Runtime

- Selected [Electron 43.8.6](https://releases.electronjs.org/release/v43.8.6), checked 2026-11-02: Chromium 150.0.7871.250, Node.js 24.22.1. Its [security backport PR](https://github.com/electron/electron/pull/55517) includes 41 changes across Chromium, WebRTC, and other libraries. Its version number does not establish whether each specific newer Chrome CVE is fixed; no exhaustive commit-to-CVE mapping was verified.
- Rejected [Electron 45.2.1](https://releases.electronjs.org/release/v45.2.1) after user clarification: it includes Chromium 156.0.8078.75 and Node.js 24.22.1, but [Electron's breaking changes](https://www.electronjs.org/docs/latest/breaking-changes) document macOS 12 removal and asynchronous clipboard APIs in 44, plus removal of sandboxed preload polyfills in 45. The user chose compatibility-preserving 43.8.6 rather than dropping platform support or adapting APIs in this security update.
- [CVE-2026-102677](https://github.com/advisories/GHSA-qmv3-fv6v-rmhq): preload-cache poisoning fixed in Electron 43.5.0 and later supported lines. Requires a compromised renderer and untrusted content.
- [CVE-2026-115570](https://github.com/advisories/GHSA-jr5w-w6x2-84p9): compromised certificate mitigation, fixed in Electron 43.8.1 and 45.0.0-beta.6, among other lines.
- [CVE-2026-113303](https://www.cve.org/CVERecord?id=CVE-2026-113303): critical Chromium WebRTC memory corruption fixed in Chrome 156.0.8078.47. Stable Chrome clears this boundary for documentation tests. The selected Electron backport line requires per-CVE mapping rather than a comparison against this upstream version, and that mapping remains unverified.

## Automation and Browser Selection

- Registry latest `@playwright/test` is 1.64.1. Its [browser manifest](https://github.com/microsoft/playwright/blob/v1.64.1/packages/playwright-core/browsers.json) still specifies Chromium 156.0.8078.4. Upgrading this package alone does not clear the reviewed Chromium fix boundary.
- The user approved Chrome stable for documentation tests on 2026-11-02. [Playwright browser documentation](https://playwright.dev/docs/browsers) supports `channel: 'chrome'` and `npx playwright install chrome`. That installation command modifies the operating system's default Chrome installation, so local installation is documented rather than performed automatically.
- `docker buildx imagetools inspect mcr.microsoft.com/playwright:v1.64.1-noble` returned index digest `sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f`.
- Chrome stable on this Windows host is 156.0.8078.76. Docker's client is installed but its Linux daemon is unavailable. System Node.js 22.14.0 and npm 11.4.2 do not meet package.json; temporary tools provide Node.js 22.23.4 and npm 12.2.0 without changing the system installation.
- Windows denied registry network connections from the temporary Node.js executable with `EACCES`. Package downloads used the existing system Node.js/npm with scripts disabled, followed by `node node_modules/electron/install.js`. Verification runs use the patched temporary Node.js 22.23.4 and npm 12.2.0. The lockfile diff is limited to the four targeted packages, Playwright's removed optional `fsevents` dependency, and npm's synchronization of the existing root package version.
- The user requested no README change. Testing instructions live only in `docs/testing.md`; the README diff is empty.

## Scope

The original audit reported 42 affected packages, including unrelated editor and build-tool dependencies. This change is limited to the requested browser/runtime updates and the tooling required to exercise them. It does not assert that the entire dependency tree is vulnerability-free.
