# Verification: Debian Package Distribution

## Automated checks

- `npm run lint`: passed on Windows.
- `npm run typecheck`: passed on Windows.
- `npm run test`: all 1,120 tests passed on Windows. An earlier concurrent run timed out in the existing maintainability test; the full isolated run passed.
- `npm run docs:test:e2e`: all five tests passed, including Debian download, installation, update, and removal instructions.
- `npm run test:e2e`: passed on Windows, 445 tests and one Linux-only test skipped. The first attempt exceeded the terminal timeout. A subsequent run hit an existing recent-items teardown timeout; the complete post-review run passed without changing that test.
- Linux package build and packaged-app launch: passed in [PR CI run 39125061311](https://github.com/yetanotherchris/markdownmeister/actions/runs/39125061311). The test built `markdownmeister_9.8.7_amd64.deb`, inspected its metadata and desktop entry, extracted it, launched the packaged app, and confirmed `app.getVersion()` was `9.8.7`.
- GitHub quality gates: validation (format, lint, typecheck, maintainability, unit tests) and both Linux e2e shards passed after review fix `c903364`. The shards passed 233 and 213 tests respectively.
- Local Linux verification used CI instead: Docker is unavailable locally, and WSL cannot mount its disk because the D: drive is BitLocker-locked.

## Review dispositions

Five reviews were posted to [PR 126](https://github.com/yetanotherchris/markdownmeister/pull/126). Correctness, security, and spec-compliance reviews reported no findings. The major tests finding was fixed in `c903364` by installing FPM's host archive tools in the Linux image and exposing packaging diagnostics. The minor code-quality finding about formatting-sensitive configuration guards was deferred: they follow existing packaging-test practice, and the real package acceptance test independently checks the important assumptions. All five reviews received a disposition reply.

## Manual release checks still required (T009)

These checks have not been performed in this implementation session. Run them on Linux Mint and Ubuntu with the first release containing the `.deb`:

1. Download `markdownmeister_<version>_amd64.deb` from the release.
2. Install by opening the file in the graphical software installer. Confirm installation completes, the application-menu entry launches the app, and the app reports the release version.
3. Open a folder, edit a Markdown file, save it, and reopen it.
4. Run `sudo apt remove markdownmeister`. Confirm package-owned application files and the menu entry are removed. User-created documents and user preferences are not application files and must be preserved.
5. Install using `sudo apt install ./markdownmeister_<version>_amd64.deb` and repeat the launch, version, edit, and removal checks.
6. Record the distribution/version, release tag, package filename, installation methods, and observed results here.

The automated Linux acceptance test inspects and extracts the package, then launches its payload. It does not claim to test a graphical installer, apt dependency resolution, menu activation, or system uninstall.
