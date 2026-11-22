# Quickstart: One Tab Per File

This guide verifies F1 (file opened before its folder), S3 (Open File after the folder is open), F3 (case-variant path on a case-insensitive filesystem), H12 and H13 (folder and menu routes in either order), the H8 boundary (same name in different folders), and the Save As identity transition.

## Prerequisites

- Node.js 22 and npm 12, matching `package.json`.
- A built application: `npm run build`.
- For the Linux parity run, Docker and the repository's e2e image.
- Optional filler text: `npm install -g claudem-ipsum`, then `claudem-ipsum 3 --unit paragraphs --seed one-tab` for longer documents. The small fixtures below are deliberately exact.

## Fixtures

Create a temporary folder with this shape. The contents are exact and end with a newline.

| File | Content |
|------|---------|
| `dir/a.md` | `# A`, blank line, `alpha` |
| `dir/b.md` | `# B`, blank line, `beta` |
| `dir2/a.md` | `# A2`, blank line, `alpha two` |

Create `dir/sub/` as an empty folder for the `..` check. On macOS or Linux, create a symlink with `ln -s a.md dir/link.md` for the symlink check. On Windows, creating a symlink may require Developer Mode or an elevated shell; skip that check if the operating system refuses it.

## Automated verification

Run these from the repository root.

| Check | Command |
|-------|---------|
| Format | `npm run format:check` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Maintainability | `npm run check` |
| Unit tests, focused | `npm run test -- tests/renderer/fileIdentity.test.ts tests/renderer/documents.identity.test.ts tests/main/identity.test.ts tests/main/read.test.ts` |
| Unit tests, full | `npm run test` |
| E2E, focused | `npm run test:e2e -- tests/e2e/one-tab-per-file.spec.ts` |
| E2E, full | `npm run test:e2e` |

The focused e2e command builds the app before Playwright runs. The suite detects whether the temporary filesystem is case-insensitive with a probe file. On a case-sensitive filesystem it skips the case-insensitive F3 match and runs the separate-files control instead. This is expected in the Linux CI image.

### Linux parity run with Docker

Build the image after source or dependency changes:

```bash
docker build -f tests/e2e/Dockerfile -t markdownmeister-e2e .
```

Run the focused suite:

```bash
docker run --rm --shm-size=1g markdownmeister-e2e sh -lc 'xvfb-run -a env MM_E2E_HEADED=1 npm run test:e2e -- tests/e2e/one-tab-per-file.spec.ts'
```

For the full suite, run the image twice, one shard at a time, to avoid competing Electron processes:

```bash
docker run --rm --shm-size=1g markdownmeister-e2e sh -lc 'xvfb-run -a env MM_E2E_HEADED=1 npm run test:e2e -- --shard=1/2'
docker run --rm --shm-size=1g markdownmeister-e2e sh -lc 'xvfb-run -a env MM_E2E_HEADED=1 npm run test:e2e -- --shard=2/2'
```

## Manual verification on Windows and macOS or Linux

Use a fresh application launch for each numbered scenario. The menu labels are `Open File…`, `Open Folder…`, and `Save As…`, reached from the hamburger button.

### F1: file opened before its folder

1. Launch with no folder open.
2. From the menu, choose `Open File…` and open `dir/a.md`.
3. Click in the editor and type `FIRST ` so the tab becomes dirty.
4. From the menu, choose `Open Folder…` and open `dir`.
5. Click `a.md` in the explorer.

Expected: one tab, it becomes active, the editor still contains `FIRST`, and no native prompt appears. Save the tab and confirm `dir/a.md` contains the typed text. On Windows NTFS this must pass. On macOS APFS, confirm the same outcome; the native realpath case behaviour was verified on Windows in this environment and must be confirmed on the macOS host. On Linux the same steps still prove the null-path to relative-path match, because the file is inside the newly opened folder.

### S3: Open File after the folder is open

1. Launch with no folder open.
2. Open `dir/a.md` with `Open File…` from the menu and type `FIRST `.
3. Open the folder `dir`.
4. From the menu, choose `Open File…` again and open `dir/a.md`.

Expected: one tab, active, with `FIRST` unchanged and no prompt. This is the route the exploratory report's accuracy review found failing.

### F3: case-variant path

Perform this scenario on a case-insensitive filesystem, which includes Windows NTFS and default macOS APFS.

1. Open the folder `dir`.
2. Click `a.md` in the explorer and type `LOWER `.
3. From the menu, choose `Open File…` and type the path with a different case, for example `dir/A.md`.

Expected: one tab, active, with `LOWER` unchanged and no prompt. The tab title may keep its original spelling. The filesystem, not a fixed rule, decides that `a.md` and `A.md` are one file. On Windows NTFS this must pass. On default macOS APFS, confirm the same outcome; macOS native realpath behaviour must be verified on that host because it was not available in this environment.

To confirm the case-sensitive control on Linux ext4 or a case-sensitive APFS volume:

1. Create `dir/a.md` and `dir/A.md` with different contents.
2. Open both files, using the explorer or `Open File…` from the menu in either order.
3. Type a different marker into each tab and save each tab.

Expected: two tabs. Each save writes only its own file. This guards against over-deduping.

### H12: explorer first, then Open File

1. Open the folder `dir`.
2. Click `a.md` and type `H12 `.
3. From the menu, choose `Open File…` and open `dir/a.md`.

Expected: one tab, active, with `H12` unchanged and no prompt. This is an existing passing case that must not regress.

### H13: Open File first, then explorer

1. Open the folder `dir`.
2. From the menu, choose `Open File…` and open `dir/a.md`. Type `H13 `.
3. Click `a.md` in the explorer.

Expected: one tab, active, with `H13` unchanged and no prompt. This is the other existing passing case that must not regress.

### H8 boundary: same name in different folders

1. Open the folder `dir`.
2. Click `a.md` and type `DIR1 `.
3. From the menu, choose `Open File…` and open `dir2/a.md`. Type `DIR2 `.
4. Save each tab in turn.

Expected: two tabs. Both may be titled `a.md`, so use the tab position or the visible content to tell them apart. `dir/a.md` contains `DIR1` and not `DIR2`. `dir2/a.md` contains `DIR2` and not `DIR1`. Saving one tab never writes the other file. This is the FR-004 guard against a relative-path-only match.

### Save As identity

1. Open the folder `dir` and click `a.md`. Type `SAVED `.
2. From the menu, choose `Save As…` and save as `dir/b.md`.
3. From the menu, choose `Open File…` and open `dir/b.md`.

Expected: the saved tab is activated, there is one tab, and its content still contains `SAVED`. The tab now represents `b.md`, not `a.md`.

4. Type another marker to make the `b.md` tab dirty.
5. From the menu, choose `Open File…` and open `dir/a.md`.
6. Save each tab and inspect both files.

Expected: `a.md` is a separate file and opens separately because the active `b.md` tab is dirty. Each save writes only its own file. Opening `a.md` does not activate or overwrite the `b.md` tab.

### Path variants: `..` and a symlink

1. Open `dir/a.md` and type `VAR `.
2. From the menu, choose `Open File…` and open `dir/sub/../a.md`.

Expected: one tab with `VAR` unchanged. The resolved real path is the same identity.

3. On macOS or Linux, open `dir/link.md` through `Open File…` from the menu while `a.md` is open.

Expected: one tab with the typed text unchanged. The symlink resolves to the same identity. On Windows, skip this step if symlink creation is unavailable; the `..` check still exercises real-path resolution.

### No new prompts

During every repeated open above, no native dialog may appear. A new confirmation, warning, or message is a failure for FR-007 and SC-006. The only dialogs that may appear are the existing ones triggered by a dirty close, quit, folder switch, or Save As location choice, and none of those are part of the repeated-open steps.

## What to record

- The platform and filesystem case sensitivity for each run. Windows NTFS and default macOS APFS are expected to be case-insensitive; Linux ext4 is expected to be case-sensitive.
- Whether the case-insensitive F3 scenario ran or was skipped.
- Whether the symlink scenario was run or skipped because the operating system refused symlink creation.
- Any prompt that appeared during a repeated open, with its exact text.
