# Verification: Debian Package Distribution

## Automated checks

- `npm run lint`: passed on Windows.
- `npm run typecheck`: passed on Windows.
- `npm run test`: all 1,120 tests passed on Windows. An earlier concurrent run timed out in the existing maintainability test; the full isolated run passed.
- `npm run docs:test:e2e`: all five tests passed, including Debian download, installation, update, and removal instructions.
- `npm run test:e2e`: full Windows run pending. The first attempt reached 232 passing tests before the terminal's ten-minute timeout. The Linux-only Debian acceptance test is intentionally not run on Windows.
- Linux package build and packaged-app launch: pending PR CI. Docker is unavailable locally; WSL cannot mount its disk because the D: drive is BitLocker-locked.

## Manual release checks still required (T009)

These checks have not been performed in this implementation session. Run them on Linux Mint and Ubuntu with the first release containing the `.deb`:

1. Download `markdownmeister_<version>_amd64.deb` from the release.
2. Install by opening the file in the graphical software installer. Confirm installation completes, the application-menu entry launches the app, and the app reports the release version.
3. Open a folder, edit a Markdown file, save it, and reopen it.
4. Run `sudo apt remove markdownmeister`. Confirm package-owned application files and the menu entry are removed. User-created documents and user preferences are not application files and must be preserved.
5. Install using `sudo apt install ./markdownmeister_<version>_amd64.deb` and repeat the launch, version, edit, and removal checks.
6. Record the distribution/version, release tag, package filename, installation methods, and observed results here.

The automated Linux acceptance test inspects and extracts the package, then launches its payload. It does not claim to test a graphical installer, apt dependency resolution, menu activation, or system uninstall.
