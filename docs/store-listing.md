# Microsoft Store listing content

Spec 062 FR-004, FR-005, FR-019. Everything Partner Center asks for during a submission, ready to paste. The Store listing lives in Partner Center, not in this repository; this file is the reviewed source the maintainer copies from, so the wording can be checked in a pull request.

## Identity and discoverability

- **Product name**: MarkdownMeister (must match the reserved Partner Center product and the package display name).
- **Store search**: users find the app by searching "MarkdownMeister".

## Descriptions

- **Short description** (Store limit 256 characters):

  A calm WYSIWYG markdown editor with a folder explorer, tabbed documents and plain markdown files on disk.

- **Full description**:

  MarkdownMeister is a desktop markdown editor that stays out of the way. Write in a WYSIWYG view or drop into the raw source, browse a folder of notes in the sidebar, and keep several documents open in tabs.

  Highlights:

  - WYSIWYG editing with a source view when you want the raw markdown.
  - Folder explorer: open a folder and browse, rename, move, create or delete its files.
  - Tabs that preserve undo history, cursor position and scroll position.
  - Light and dark appearance that follows your system.
  - Plain markdown files on disk. No lock-in and no proprietary format.
  - Free and open source under the MIT licence.

  On Windows 11 you can right-click any folder in File Explorer and choose "Open in MarkdownMeister" to open it as your workspace.

## Category, rating and requirements

- **Category**: Developer tools (alternative: Productivity). Choose one and keep it consistent across submissions.
- **Age rating**: complete the IARC questionnaire. The app displays user-authored text files and collects no personal data, so the expected outcome is the lowest rating (Everyone / 3+). Do not guess the questionnaire answers; answer them against the app's real behaviour.
- **System requirements**: Windows 10 version 2004 (build 19041) or later.
- **Folder action**: the "Open in MarkdownMeister" File Explorer folder action requires Windows 11. On Windows 10 the app installs and runs normally and folders are opened from the app's own Open Folder command. State this in the listing's system requirements or description so a Windows 10 user is not surprised.

## Links (must be reachable before you submit)

- **Support**: https://github.com/yetanotherchris/markdownmeister/issues
- **Privacy policy**: https://yetanotherchris.github.io/markdownmeister/privacy.html

The privacy policy is required by the Store even though the app collects no personal data. It is served from `docs/site/privacy.html` by the GitHub Pages deployment in `.github/workflows/pages-deploy.yml`. Confirm the Pages deployment is green and both links resolve before submitting.

## Screenshots and images

Partner Center requires at least one screenshot and recommends up to nine. Provide real captures, not placeholder art (the site's `docs/site/assets/screenshot-placeholder.svg` is a known placeholder, see `docs/site/README.md`).

- **Format**: PNG, at least 1366 x 768.
- **Recommended set (Windows desktop)**:
  1. The main window with the folder explorer and the WYSIWYG editor showing a real document.
  2. The source view of the same document, to show raw markdown editing.
  3. Several tabs open, one marked dirty, to show tabbed documents.
  4. The Settings dialog showing the light/dark appearance choice.
- **Store logos and tiles**: upload the branded logos from `store-assets/` in Partner Center's Store logos section (the 1:1 tiles at 44, 50, 71, 150, 300 and 310 px and the wide `wide-310x150.png`). Do not leave any Store logo field at its Partner Center default: a listing tile that is a default image is rejected exactly like a default package tile (spec 067). The package itself now ships branded tile assets (`resources/appx/`); launching the listing with a package that still substituted a default tile was the rejection this checklist is intended to catch.

  To confirm the package is branded before submitting, unpack the `.appx` and check that `assets\StoreLogo.png`, `assets\Square44x44Logo.png`, `assets\Square150x150Logo.png`, `assets\LargeTile.png`, `assets\SmallTile.png` and `assets\Wide310x150Logo.png` are the files from `resources/appx/` and not `SampleAppx`-style placeholder art.

## Capabilities justification (certification notes)

The package declares exactly one restricted capability, `runFullTrust`, because it is a full-trust desktop application distributed through the Store. Suggested certification note, alongside the spec 038 note about the shell extension:

> MarkdownMeister is a full-trust desktop application. The packaged COM shell extension only launches the app's own execution alias with the selected folder path; it performs no filesystem access, shows no UI and starts no background work of its own.

## Pre-submission checklist

Taken from spec 062 SC-006 and the spec 038 quickstart.

- [ ] Product reserved in Partner Center; `STORE_IDENTITY_NAME` and `STORE_PUBLISHER` repository variables set from Product setup.
- [ ] Package built by `.github/workflows/build-store.yml` from the release tag, with identity and version gates green.
- [ ] Package version is strictly greater than the currently published Store version.
- [ ] Spec 038 quickstart US1 to US5 (including the F1 to F5 fault matrix) run against the built artifact with no Explorer crash or hang.
- [ ] Listing name, short and full description reviewed against this file.
- [ ] Support and privacy links resolve.
- [ ] Screenshots uploaded and show real content.
- [ ] Store logos uploaded from `store-assets/`, including the wide tile, with no Partner Center default left in place.
- [ ] Packaged tile assets confirmed branded (unpack the `.appx`; no `SampleAppx` placeholder under `assets\`).
- [ ] Category and age rating set.
- [ ] The Windows 11 folder-action requirement is stated in the listing.
