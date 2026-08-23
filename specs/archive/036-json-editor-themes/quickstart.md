# Quickstart: File-Based Editor Themes

Manual verification for spec 036. The automated gates (unit suites + `tests/e2e/json-editor-themes.spec.ts`) cover the acceptance scenarios; the steps below verify behaviour that needs a real user profile, a real OS appearance switch, or an external editor.

Prerequisites: `npm install`, then run the dev app (`npm run dev`) or a built package.

## Fresh install / first launch (US1)

1. Launch with a clean profile (or temporarily rename your real config directory). Open `~/.config/markdownmeister/themes/` (`%USERPROFILE%\.config\markdownmeister\themes` on Windows): exactly `rustic.json`, `rustic-serif.json`, `scholarly.json`, `monotone.json`, `monotone-serif.json` exist.
2. Open each file in an external editor: two colour sets (`light`/`dark`), six tokens each, typeface matching today's rendering (research E2).
3. Settings → Theme: five entries labelled by file stem; selecting one and saving re-themes the canvas identically to the previous version (compare side-by-side against the previous release if in doubt — warm rustic canvas, blue scholarly headings, black/white monotone).

## Editing a theme file (US3)

1. With `rustic` selected, edit `rustic.json`'s `light.background` to a distinctive colour and save.
2. Reopen Settings → Theme (no restart): the canvas already shows the new colour after reopening settings (SC-003); the dialog lists the same names.
3. Break the file (delete the `dark` node) and reopen settings: the theme disappears from the list, the app keeps working, no error dialog; the editor falls back silently and the selection repairs to `rustic`. Fix the file and it returns.

## Appearance switching (US2)

1. Select `monotone`; toggle the OS between light and dark (or Settings → Light/Dark/System): canvas flips white-on-black ↔ black-on-white immediately, no restart or re-selection.
2. Select `rustic`; toggle again: nothing visibly changes (identical sets).

## Adding / removing themes (US4)

1. Copy `scholarly.json` to `midnight.json`, change a token, reopen settings: `midnight` appears alphabetically among the defaults, selectable and applied like any other.
2. Delete `midnight.json`: gone from the next dialog open.
3. While `midnight` is selected, delete its file and restart: the editor opens on the default appearance, no error, and the stored selection reads `rustic` afterwards.

## Upgrade migration (US3 S3/S4)

1. On the previous version, hand-edit `config.json`'s settings to colours that match no default (e.g. VS Code dark-ish palette) plus `"editorFont": "serif"`.
2. Run the new version once: `themes/migrated-custom.json` now exists containing those exact colours in BOTH sets and the serif stack; Settings lists `migrated-custom` selected; rendering matches the pre-upgrade look in both appearances.
3. Restart: no second migration artifact appears.
4. Separately: set colours + font to an exact default combo (e.g. scholarly values + `sans-serif`), run once: NO extra file is created and the selection becomes `scholarly`.

## Adversarial folder contents (US5)

Fill `themes/` with: syntactically invalid JSON; a file missing `dark`; a file with `background: "red"`; a 5 MB junk `.json`; a subdirectory named `x.json`; (Windows/macOS) a symlink/junction named `evil.json` pointing outside the config dir; a `notes.txt`. Expected: the app starts normally every time, valid themes keep working, none of the above is listed, no modal ever appears. An all-invalid folder leaves the editor on the default appearance.

## Automated gates

```bash
npm install
npm run lint
npm run typecheck
npm test          # tests/main/themes/* + renderer resolution suites
npm run check     # maintainability guardrails (size/complexity/cycles/unused exports)
npx prettier --check <new/edited files>   # via scripts.format:check list
npm run test:e2e  # includes tests/e2e/json-editor-themes.spec.ts
```
