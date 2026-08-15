# Quickstart: Markdown Syntax and Formatting Options

Manual verification script for spec 030. Run the automated suite first
(`npm run test`, `npm run lint`, `npm run typecheck`), then walk these scenarios
against the built app (`npm run dev` or the packaged binary) to confirm end-to-end
behaviour.

## Prerequisites

- `npm install` (already done for this repo).
- A workspace folder with a scratch markdown file, e.g. `syntax.md` containing:

  ```text
  ~~struck~~ and $E=mc^2$ and https://example.com

  | a | b |
  |---|---|
  | 1 | 2 |

  - [ ] todo
  - [x] done

  line one
  line two
  ```

## Scenarios

### 1. The Markdown area exists (US1 S1/S2, FR-001/002)

Open the hamburger → Settings. The sidebar lists **General**, **Theme**, **Markdown**.
Select **Markdown**; six pill switches appear (hard breaks, strikethrough, tables,
task lists, math, autolink).

### 2. Strikethrough toggle (US1 S3/S4, FR-004)

With the scratch file open and strikethrough **on**, `~~struck~~` renders with a
line-through. Toggle strikethrough **off**: the tildes render as literal `~~struck~~`
with no strike line, immediately, without closing the dialog.

### 3. Math toggle (US1 S5/S6, FR-007)

With math **on**, `$E=mc^2$` renders as a formatted formula. Toggle math **off**:
the dollar signs render as literal text.

### 4. Tables and task lists (US1 S7/S8, FR-005/006)

Toggle tables **off**: the pipe-delimited lines render as literal text lines (no grid).
Toggle task lists **off**: `- [ ] todo` renders as a standard list item with literal
brackets (no interactive checkbox).

### 5. Autolink (US1 S9, FR-008)

Toggle autolink **off**: `https://example.com` remains plain text (not a clickable link).

### 6. Hard line breaks (US2, FR-003)

With hard breaks **off**, "line one / line two" (single newline) displays as one
continuous paragraph with a space between the words. Toggle hard breaks **on**: the two
lines display on separate visual lines, immediately reflowing existing paragraphs.

### 7. Multi-tab immediate apply + no data loss (US3, FR-010/011)

Open the same file in two tabs; make an unsaved edit in one. Toggle any syntax option.
Both tabs re-render; the dirty dot, unsaved text, cursor position, and scroll position
are preserved. Undo/redo still works after the toggle.

### 8. Persistence (US4, FR-012)

Change several options from their defaults, close and reopen the app, reopen Settings →
Markdown: the toggles retain their chosen states. Delete the config file and relaunch:
all six revert to the FR-013 defaults (hard breaks off; the rest on).

### 9. Round-trip with disabled syntax (Edge Cases, SC-004)

With math and tables disabled, save the scratch file, then inspect it on disk: the
`$…$` characters and pipe lines are byte-for-byte unchanged (no escaping, no mangling).

### 10. Source view immunity (Edge Case)

With syntax options toggled, switch a tab to source view: the raw characters are always
verbatim regardless of toggle state.

### 11. Unclosed/partial delimiters (Edge Case)

A single `~` or an unmatched `$` stays literal text in both enabled and disabled states
and does not break the layout.

### 12. Rapid toggling (Edge Case)

Flip several toggles quickly in succession: the editor settles on the final state without
visual stutter or a stuck intermediate state.

### 13. Timing and usability (SC-002/SC-005)

Manual checks only (not automated): any toggle updates all open tabs within 300 ms, and a
writer can reach and toggle a Markdown option in under 10 seconds.
