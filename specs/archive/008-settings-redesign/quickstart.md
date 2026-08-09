# Quickstart: Settings Redesign Validation

## Prerequisites

Run from the repository root with Node 22 and npm 10 installed:

```powershell
npm install
npm run build
npm run preview
```

Use a temporary configuration directory when manually checking persistence:

```powershell
$env:MM_CONFIG_DIR = Join-Path $env:TEMP "mm-settings-redesign-manual"
```

## Settings Areas

1. Open Settings from the hamburger menu.
2. Confirm General is initially selected and only General controls are visible.
3. Select Theme and confirm only application and editor theme controls are visible, then select General again.
4. Close and reopen the dialog; confirm General is selected again.
5. Resize the application narrowly and confirm the sidebar and content panel remain usable without overlap.

## File Preference

1. In General, enable `Open explorer files in a new tab`.
2. Open two distinct files from the explorer with an ordinary click; confirm both tabs remain.
3. Open the first file again; confirm its existing tab activates rather than duplicating.
4. Disable the control, ensure the active tab is clean, and open another explorer file; confirm the active tab is replaced.
5. Edit the active document, then open an explorer file with same-tab selected; confirm the dirty tab remains and the file opens in a new tab.
6. Use the explorer context-menu Open action with new-tab selected; confirm it opens a new tab.

## Developer Tools

1. Confirm Toggle Developer Tools is absent from the hamburger menu.
2. Press F12 and Ctrl/Cmd+Shift+I; confirm developer tools toggle on and off.
3. Confirm the Settings dialog has no developer-tools control.

## Editor Presentation

1. Open a one-line document with the Rustic editor theme. Confirm the complete formatted editor viewport, including below the line, is warm cream.
2. Select Dark application theme and Monotone editor theme, save the editor-theme choice, and confirm the complete formatted canvas is black.
3. Save a different editor theme while the short document remains open and confirm the lower canvas updates immediately.
4. Confirm the View source button is last in the formatting toolbar, has the code-bracket-square outline glyph, and is a legible dark blue in both application themes.

## Automated Gates

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

## Usability Measurement

SC-005 requires an external usability session. Give each participant a request such as "change the application theme" or "open the file-opening preference", start timing when the Settings dialog opens, and record whether the target control is found within 10 seconds. Ten or more representative participants are required to measure the specified 90% success rate; automated tests cannot establish that outcome.
