# Research: Double-Click Open in New Tab

## R1 — `e.detail` is the double-click detector; no custom timing

**Decision**: the tree row's click handler routes a file click by the native
`e.detail` counter (`1` = single click, `>= 2` = completing click of a
double-click), rather than installing its own double-click-timing logic.

**Rationale**: the browser already implements double-click detection using the OS
double-click time (Windows default 500 ms), and `e.detail` is that detector's
output on the second click. It is exact, cross-platform, and free. The deferral
window must equal or exceed the OS double-click time so a recognised double-click's
second click (`e.detail === 2`) always arrives before the deferred single-click open
commits (FR-003). 500 ms covers the Windows default (spec Clarification 2026-08-10).

**Alternatives considered**: a custom two-click timer in the hook (rejected —
reimplements OS behaviour and drifts from the platform's actual double-click
threshold); ignoring `e.detail` and relying on `onDoubleClick` only (rejected — the
first click of a double-click must not open, and `onDoubleClick` alone cannot
prevent the click events that precede it from acting).

## R2 — `node.handleClick` cannot host the gesture; the row must route clicks

**Decision**: replace the row's `onClick={node.handleClick}` for FILE nodes with a
gesture router that calls `node.select()` and then a new `onFileOpen(node, gesture)`
prop. `handleTreeSelect` stops opening files; `handleTreeActivate` is unchanged for
keyboard.

**Rationale**: react-arborist's `node.handleClick` calls `select()` + `activate()`
on every click (verified in `node-api.js`: the plain path is `select(); activate()`).
`select()` fires `onSelect` → `handleTreeSelect` (which opens) and `activate()`
fires `onActivate` → `handleTreeActivate` (which opens). A double-click today opens
the file three times, so "add deferral to handleTreeSelect/handleTreeActivate"
would defer three overlapping opens and the second/third would bypass the deferral
or double-open. A single gesture router that owns the open for files is the only
place where FR-003 can be guaranteed: the router decides single-vs-double, defers
or opens, and nothing else opens files on mouse click.

**Alternatives considered**: wrapping `node.handleClick` and branching on the event
(rejected — the handler has no reliable signal that the click is the second of a
double-click, and react-arborist does not pass `detail` through); deferring inside
`openFileFromExplorer` (rejected — that is the session gate used by menus and
context menus too; a 500 ms delay there would change File > Open and context-menu
Open for everyone).

## R3 — Deferral is a per-file pending timer in `useWorkspaceTree`, only when the click would replace

**Decision**: `handleFileOpen` keeps a map of `path → { timer, activeIdAtClick }`.
A single-click in same-tab mode is deferred only when it would REPLACE a clean
active tab; a double-click cancels the pending timer for that path and opens
explicitly new (`openFileFromExplorer(file, true)`). At fire time, if the active
tab changed since the click, the commit opens a new tab rather than replacing.

**Rationale**: keying by path lets two deliberate single-clicks on DIFFERENT files
each commit independently (spec Edge Case: "each follows the single-click preference
behaviour") while a double-click only cancels its own file's pending open. Reusing
`openFileFromExplorer(file, true)` gives FR-005 (already-open dedupe) for free —
it is the same path spec-024's middle-click uses. Deferring ONLY the replace case
is the minimal behaviour change: when there is no active tab, the active tab is
dirty, the file is already open, or the new-tab preference is on, a double-click on
the same file yields the same tab result anyway, so the single-click opens
immediately (verified against the existing e2e suite, which exercises all these
branches in sequence). The `activeIdAtClick` check prevents a deferred replace from
clobbering a tab the user opened or switched to during the window (spec Edge Cases;
this was the regression the first full e2e run caught — the deferred open replaced
a middle-clicked tab).

**Alternatives considered**: a single global pending timer (rejected — a second
single-click on a different file would cancel the first, contradicting the spec edge
case); deferring every same-tab single-click unconditionally (rejected — it broke
the existing click-then-middle-click e2e flows: the deferred first open replaced the
tab the middle-click had just created); deferring in the row component (rejected —
the row has no access to the session gate or the dirty check).

## R4 — Directory double-click: spec gap closed with a toggle

**Decision**: the row's click handler toggles directory nodes on the completing
click of a double-click (`e.detail >= 2` in `onClick`), the same detector the file
gesture uses. Today a directory double-click calls `node.activate()` which is a
no-op for directories (`handleTreeActivate` returns early), so directories do
nothing on double-click. US3/FR-006/SC-005 require expand/collapse, so this feature
adds the toggle. Recorded in spec.md Clarifications 2026-08-10.

**Rationale**: acceptance scenarios and SC-005 are authoritative; "as today" was
factually wrong and is corrected in the spec. A `dblclick` DOM event is not reliably
delivered in the Electron test runtime, so the completing click (`e.detail === 2`)
is used for directories too (R1).
