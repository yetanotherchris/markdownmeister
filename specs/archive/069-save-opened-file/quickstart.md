# Quickstart: Save an Opened File in Place

**Feature**: `069-save-opened-file` | **Date**: 2026-10-13

Manual checks against a running build. The e2e suite in `tests/e2e/save-opened-file.spec.ts` is the automated form of the same steps. Dialog stubs belong in that suite. A manual pass uses the real dialogs and cancels them when the step says the dialog must appear.

## Setup

Build with `npm run build`, then start the app. Use a scratch folder with one markdown file inside it, and a second markdown file outside it. Do not open the folder until a step says to.

## 1. Open File with no folder

Open the outside file with Open File. Choose Save without editing. No location dialog appears, and the file bytes are unchanged.

Edit the document. Choose Save from the menu, then make another edit and use the save shortcut. Both writes reach the original file, the unsaved indicator clears, and no location dialog appears.

## 2. Folder boundaries

Open the scratch folder. Open the inside file from the explorer, edit, and save. The file updates and no location dialog appears.

With the folder still open, use Open File on the outside file, edit, and save. The outside file updates, the folder stays the scratch folder, and no location dialog appears.

Use Open File on the inside file as well. Edit and save. That file updates with no location dialog.

## 3. Save As and a never-saved document

Create a new document and choose Save. The location dialog appears. Cancel it. No file is created and the document stays unsaved.

On the outside file, choose Save As and pick a new file outside the folder. The next ordinary Save writes that new file and does not ask again. The original outside file is unchanged by the later save.

Choose Save As and cancel. The document is still the file from the completed Save As.

## 4. Failure

Make the opened file read-only, or lock it, then choose Save. The document stays unsaved, no location dialog appears, and the file is not truncated.

Delete the opened file on disk and choose Save directly, before using the removed-file confirmation. No file is recreated at the old location and no location dialog appears from Save. The removed-file confirmation, if it is shown, still offers a copy through the location dialog.

## Automated checks

From the repository root, after the implementation tasks are done:

- `npx vitest run tests/main tests/renderer/useDocumentSession.save.test.tsx tests/renderer/documents.save.test.ts` for the channel and the association rules. Narrow the main-test path to the new file if the suite is split out.
- `npx playwright test tests/e2e/save-opened-file.spec.ts` for the user-visible cases. The app must already be built, or use `npm run test:e2e` with a path filter if the script is extended. The repository script `npm run test:e2e` builds and runs the whole suite.
- The implementation change is a code change, so the finishing task runs `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e`.
