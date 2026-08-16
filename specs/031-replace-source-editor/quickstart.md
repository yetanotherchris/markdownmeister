# Quickstart: Replace Source Editor

## Prerequisites

- Node.js 22 and npm 10
- Dependencies installed with `npm install`

## Validation Commands

Run these from the repository root after implementation:

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

All commands must pass. `npm run test:e2e` builds the application and validates the real Electron UI.

## Source Editor Scenarios

1. Open a Markdown file with leading YAML frontmatter, headings, links, emphasis, lists, block quotes, fenced-code delimiters, empty lines, and no trailing newline. Enter source view and verify Markdown and YAML decorations while the complete exact text remains editable.
2. Edit YAML, Markdown, and fenced-code text. Return to visual editing, save, reopen, and verify the raw saved text contains the edits without added formatting or newline changes.
3. Enter malformed or incomplete frontmatter and Markdown delimiters while typing. Verify source remains editable, unaltered, and saveable.
4. Open two source-view documents, make distinct edits and positions, switch tabs, and verify each restores its own text, selection, and scroll. Verify closing a dirty source document, closing the window, and quitting use existing explicit confirmation.
5. Enable source spellcheck in settings and verify ordinary prose in source receives native spellcheck behavior; disable it and verify the source editable element reflects the setting.

See [source editor contract](./contracts/source-editor.md) and [data model](./data-model.md).

## Visual Code Highlighting Scenarios

1. Open a visual-editor document containing a fenced code block. Verify syntax coloring is enabled by default.
2. In Markdown settings, toggle `Syntax highlight code blocks` off and on. Verify colors change immediately but code text, language label, active selection, undo history, and dirty state do not change.
3. Enter source view and verify its Markdown/YAML highlighting is unchanged by the visual-code setting.
4. Restart the application and verify the selected visual-code setting remains effective.

See [visual code highlighting contract](./contracts/visual-code-highlighting.md) and [data model](./data-model.md).
