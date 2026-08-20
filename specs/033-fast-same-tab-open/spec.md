# Feature Specification: Fast Same-Tab Document Open

**Feature Branch**: `phase-33-fast-same-tab-open`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "When you open a document in the same tab, it is slow to load each time."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a file into the current tab without a long wait (Priority: P1)

A writer browsing a folder clicks another file to open it into the clean active tab. The new document appears, ready to read and edit, almost immediately. The staged transition (the outgoing document stays visible until the incoming one is ready) still protects against a blank canvas, but the wait for that transition shrinks from a noticeable stall to a brief flicker.

**Why this priority**: Opening files into the current tab is the primary browsing gesture of the editor; every user performs it constantly, and today each open costs roughly a second of dead time.

**Independent Test**: Open a clean document, open another file into the same tab, and measure the time from the open request until the incoming document is presented and interactive; verify it completes in roughly a quarter of a second for a typical document.

**Acceptance Scenarios**:

1. **Given** a clean active document, **When** the writer opens another file into the same tab, **Then** the incoming document is presented ready for interaction in roughly a quarter of a second or less.
2. **Given** the incoming document has been presented, **When** the writer starts typing immediately, **Then** keystrokes land in the new document with no perceptible lag and its undo history is fresh and empty.
3. **Given** the outgoing document stays visible during the transition, **When** the incoming document becomes ready, **Then** the swap happens atomically exactly as it does today (title, content, and editor change together).

---

### User Story 2 - Repeated browsing stays consistently fast (Priority: P2)

A writer hops between many files in a session. Each open into a tab does only the work strictly necessary to present that file: no redundant re-processing of the same content, no repeated whole-document bookkeeping passes. The tenth open of the morning is as fast as the first.

**Why this priority**: The complaint is not one slow open but *every* open being slow; eliminating per-open waste is what makes the fix durable rather than cosmetic.

**Independent Test**: Instrument one open operation and count how many times the full document text is processed end-to-end (interpreted for display and serialized for bookkeeping); verify each count is the minimum needed, with no duplicate passes when no settings changed.

**Acceptance Scenarios**:

1. **Given** syntax-related settings are unchanged from their defaults or previous values, **When** a document is opened, **Then** the incoming content is processed for display exactly once — no second full pass over the same text occurs.
2. **Given** a document is being opened, **When** baseline and dirty-state bookkeeping run, **Then** the incoming content is serialized at most once for those purposes, reusing work already done.
3. **Given** the outgoing document's dirty state must be checked before replacement commits, **When** that check runs, **Then** it completes without adding a noticeable delay to the open.

---

### User Story 3 - Large documents scale predictably (Priority: P3)

A writer opens progressively larger documents. Open time grows in proportion to document size: a document ten times larger takes about ten times as long, not disproportionately more, because no step processes the content twice.

**Why this priority**: Duplicate full-content passes are invisible on small notes but compound on long-form documents; proportionality is what keeps the editor usable on real books and reports.

**Independent Test**: Time opens of a small and a ten-times-larger document and verify the ratio of open times is close to the ratio of sizes (no super-linear blowup).

**Acceptance Scenarios**:

1. **Given** two documents where one is ten times larger than the other, **When** each is opened into a tab, **Then** the larger document takes no more than roughly ten times the open time of the smaller one.
2. **Given** background checking features (such as spellcheck marking) exist, **When** a large document is opened, **Then** the document is presented and interactive before such background passes complete, and those passes never block presentation.

### Edge Cases

- What happens when the incoming document is empty? Presentation must be immediate; no processing passes are needed and none should run.
- What happens when the writer opens a second file while a replacement is still staging? The existing supersede-and-cancel behaviour applies unchanged; only the latest request pays any cost.
- What happens when the outgoing document becomes dirty mid-transition? The replacement is cancelled and the writer's changes remain protected, exactly as today.
- What happens when a tab is revisited after its editor was released to free memory, or after the document was reloaded from source? It remounts through the same fast path and benefits from the same reductions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Opening a document into a clean active tab MUST present the incoming document ready for interaction within the time bounds defined by SC-001, without changing the staged-replacement transition model.
- **FR-002**: A single document open MUST NOT perform more than one full interpretation pass over the incoming content when display settings have not changed since the last use of the relevant configuration.
- **FR-003**: A single document open MUST NOT perform redundant whole-content serialization passes; at most one full serialization of the incoming content may occur per open, and no bookkeeping may require additional whole-content passes beyond it.
- **FR-004**: Non-essential whole-document work (for example, background language checking) MUST NOT block presentation of the incoming document and MAY complete shortly after it is shown.
- **FR-005**: All existing guarantees MUST be preserved: atomic staged commit, dirty-state cancellation and protection, source-view edit protection, fresh undo history per opened document, immediate activation of already-open files, and confirmation before discarding unsaved changes.
- **FR-006**: The feature MUST NOT change how documents are read from storage, the boundary through which document operations are requested, how file locations are validated, or how saving behaves.
- **FR-007**: Reductions in per-open work MUST apply to every path that presents a document in an editor (same-tab replacement, new tab, remount after release, reload from source), since they share one presentation path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A same-tab open of a document up to 10,000 lines presents the incoming document ready for interaction within 250 milliseconds on reference hardware, measured at the 95th percentile across automated runs (measured from the moment the open begins, excluding the intentional double-click recognition window).
- **SC-002**: When display settings are unchanged, automated instrumentation counts exactly one full interpretation pass over the incoming content per open (today there are two).
- **SC-003**: Automated instrumentation counts at most one whole-content serialization of the incoming content per open for baseline/dirty bookkeeping, while all dirty-state correctness tests continue to pass 100%.
- **SC-004**: Opening a document ten times larger than another takes no more than twelve times as long (linear scaling within 20% overhead), measured across automated runs.
- **SC-005**: All acceptance scenarios from the existing specifications governing tabs, gestures, and staged replacement continue to pass unchanged.

## Assumptions

- The staged-replacement UX remains exactly as shipped: this feature shortens the time until the incoming editor is ready; it does not remove staging, change the transition model, or reuse a single editor across different documents (fresh undo history per opened document remains mandatory).
- The fixed double-click recognition window before a single-click open begins is intentional prior behaviour and out of scope; all targets are measured from the moment the open actually starts.
- Deferring background marking (spellcheck-style underlines) until just after the document appears is acceptable under Calm, Predictable Editing; marks arriving a beat later is preferable to a slower open.
- Performance targets assume mid-range consumer hardware with local disk storage.
- File reading itself is not the bottleneck for typical documents and is not targeted beyond avoiding incidental repeats of work already in memory.

## Clarifications

### Session 2026-08-20

- Q: What speed target should opening a document into the same tab actually meet for documents up to 10,000 lines? → A: 250 milliseconds (95th percentile) — chosen at the edge of "feels instant" human-perception thresholds rather than the initially assumed 500 ms.

