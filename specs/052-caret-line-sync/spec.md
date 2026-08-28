# Feature Specification: Caret Line Sync Between Editing Views

**Feature Branch**: `spec-052-caret-line-sync`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "is it possible to sync the carets between visual editor and source editor? ... it wouldn't need to be 100% accurate. just to the line level"

A writer who spots something in the visual editor and switches to the source view to fix the raw text currently lands wherever the source caret happened to live last, which can be a different part of the document entirely. This feature synchronises the two carets at switch time to line accuracy: the destination view opens at the text the writer was looking at, not at a stale position. Per the request, the sync does not need to be character-exact; landing on the right line (or within the same content block) is the contract.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switching to source lands where you were reading (Priority: P1)

A writer is working deep in a long document in the visual editor, spots a sentence, and activates the source view. The source caret opens on a line belonging to the same content block they were reading (a heading, paragraph, list, table, quote, or code block as one region), and the source view is scrolled so that line is on screen. Today the source view reopens at its own last position, which is frequently somewhere else entirely.

**Why this priority**: This is the core of the feature: without it, the source view's position is disconnected from where the writer is working, which is the entire problem being solved.

**Independent Test**: Place the caret in a specific block partway through a long document, switch to source view, and confirm the source caret sits on a line of that block with the line revealed on screen.

**Acceptance Scenarios**:

1. **Given** the caret is placed in a paragraph partway through a long document, **When** the user switches to source view, **Then** the source caret is on a line belonging to that same paragraph and the source view is scrolled so the line is visible.
2. **Given** the caret is in any kind of content block (heading, list, table, quote, code block), **When** the user switches to source view, **Then** the source caret lands on a line belonging to that block.
3. **Given** the caret is at the very start of the document, **When** the user switches to source view, **Then** the source caret is on the first line of the body (skipping any frontmatter lines).
4. **Given** a document with frontmatter, **When** the caret is anywhere in the body, **Then** the sync never places the source caret inside the frontmatter.
5. **Given** a short document that fits on screen, **When** the user switches to source view, **Then** the caret lands at the corresponding place as it would in a long document, with no special-casing visible.

---

### User Story 2 - Returning to visual respects where you worked (Priority: P1)

A writer returns from the source view to the visual editor. If they looked but never moved the source caret, everything behaves exactly as today: the visual caret and scroll are precisely where they left them. If they moved the source caret to a different part of the document, the visual caret lands in the content block containing that line, so the two views stay in step in the direction they actually worked.

**Why this priority**: A sync that only worked one way would strand the writer's source position on the way back. The untouched-caret case must keep the existing exact-restore guarantee, which writers rely on for quick view-source round trips.

**Independent Test**: Toggle to source, move the caret to a distant line, return, and confirm the visual caret sits in the block containing that line; separately, toggle and return without touching the caret and confirm the visual position is bit-for-bit what it was.

**Acceptance Scenarios**:

1. **Given** the user switched to source and back without moving the source caret and without editing, **When** they return, **Then** the visual caret and scroll position are exactly what they were before the switch (today's behaviour, unchanged).
2. **Given** the user moved the source caret to a line in a different part of the document, **When** they return without editing, **Then** the visual caret sits in the content block that contains that line, revealed on screen.
3. **Given** the user edited in the source view and left the caret somewhere new, **When** they return, **Then** the edit is preserved exactly as today and the caret lands in the block containing the source caret's line, clamped to a valid location.
4. **Given** the source caret's final line is not part of any content block (a blank separator line), **When** they return, **Then** the visual caret lands on the nearest content block.

---

### User Story 3 - Positions without a counterpart degrade quietly (Priority: P2)

Some source positions have no exact visual counterpart: the frontmatter, markup punctuation itself, constructs the visual editor renders as nothing, or blank separator lines. The sync clamps these to the nearest sensible location rather than erroring, blocking the switch, or dropping the writer anywhere surprising like the top of the document.

**Why this priority**: Pure robustness around the two primary stories, but it is what keeps the feature from ever making the switch feel broken.

**Independent Test**: Place the source caret in frontmatter or inside markup punctuation, return to visual editing, and confirm the caret clamps to a nearby valid location with no error; do the same from the visual side into a hidden construct.

**Acceptance Scenarios**:

1. **Given** the source caret is inside markup punctuation or a markup-only region, **When** the user returns to visual editing, **Then** the caret clamps to the nearest valid visual location and no error appears.
2. **Given** the source caret is in the frontmatter, **When** the user returns to visual editing, **Then** the caret goes to the start of the body, the closest visual counterpart.
3. **Given** content the visual editor cannot fully represent, **When** the user switches in either direction, **Then** the mapping degrades to the nearest representable location and the switch always completes.

---

### Edge Cases

- A caret in visually hidden content (a construct that renders as nothing): maps to the nearest following visible block rather than vanishing.
- Empty or single-paragraph documents: every position maps to the document start; no special behaviour is visible.
- Very long paragraphs spanning many source lines: the exact line inside the block is approximate; landing within the block's lines satisfies the contract (line-level accuracy, per the request).
- Deeply nested list items: the top-level block is the mapping unit, so positions inside a long nested list resolve within that list's lines, not to an individual item.
- Rapid toggling back and forth: every switch re-syncs from the current origin caret, so repeated toggles do not drift.
- Tables and other multi-line blocks: the caret in any cell maps to lines of that table's block.
- A document whose source text cannot be fully represented in the visual editor: mapping degrades to the nearest representable location and the switch completes with today's content guarantees intact.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the user switches from the visual editor to the source view, the source caret MUST start on a line belonging to the content block that contained the visual caret, and the source view MUST be positioned so that line is visible.
- **FR-002**: The mapping unit MUST be the content block (a heading, paragraph, list, table, quote, or code block treated as one region); placement on an exact line within a multi-line block is best-effort and approximate.
- **FR-003**: When the user returns to visual editing having neither moved the source caret nor edited, the visual caret and scroll position MUST restore exactly as they were before the switch, preserving the existing round-trip guarantee.
- **FR-004**: When the user has moved the source caret or edited in the source view, returning to visual editing MUST place the visual caret in the content block containing the source caret's final line, clamped to a valid caret location and revealed on screen.
- **FR-005**: Source positions without a visual counterpart (frontmatter, markup-only text, visually hidden constructs, blank separator lines) MUST clamp to the nearest representable location; the switch MUST NOT fail, surface an error, or reset to the document start as a side effect of clamping.
- **FR-006**: Caret synchronisation MUST NOT alter document text, dirty state, saved bytes, undo history, or any stored per-tab content; it governs positioning only.
- **FR-007**: Each tab MUST map independently, and switching between tabs MUST continue to restore each surface's own stored position without cross-tab interference.
- **FR-008**: View switching MUST NOT become perceptibly slower for documents up to 10,000 lines as a result of the synchronisation.
- **FR-009**: Every existing switching behaviour not named above MUST be unchanged, including capture and restore of content, dirty tracking, and save behaviour.

### Key Entities *(include if feature involves data)*

- **Visual caret context**: the per-tab stored position in the visual editor (caret location and scroll), as it exists today. Unchanged in shape; sometimes superseded at restore time by FR-004's mapped position.
- **Source caret context**: the per-tab stored position in the source view (selection and scroll), as it exists today. Its stored value becomes the starting point for the mapped caret when the origin caret provides a better answer.
- **Block-to-line correspondence**: the association between the document's content blocks and the source lines each block occupies. Derived at switch time from the displayed text and the current document structure; never persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of switches to source view from any caret position and scroll depth, the source caret lands on a line belonging to the content block that contained the visual caret.
- **SC-002**: In 100% of round trips where the source caret was untouched and no edit was made, the visual caret and scroll restore exactly, matching today's behaviour.
- **SC-003**: In 100% of returns after moving or editing in source view, the visual caret lands within the corresponding content block or its nearest neighbour, with zero errors surfaced.
- **SC-004**: In 100% of clamping cases (frontmatter, markup-only, hidden, or blank-line positions), the switch completes silently with a nearby valid caret and never resets to the document start merely because a clamp occurred.
- **SC-005**: Switch timing for a 10,000-line document shows no perceptible regression against the current switch timing.
- **SC-006**: In 100% of switches, document bytes and dirty state are unchanged by the synchronisation itself.

## Assumptions

- **Accuracy contract**: The user explicitly scoped accuracy to the line level ("wouldn't need to be 100% accurate, just to the line level"). Character-exact caret mapping is out of scope, and approximate placement within a multi-line block is acceptable and expected.
- **Mapping unit**: A content block (top-level region) is the unit of correspondence. Positions nested deeply inside a long block (for example deep in a nested list) resolve within that block's lines rather than to an individual nested item. Finer granularity can be added later without changing the requirements above.
- **Return-path rule**: "Sync" is interpreted as two-way but asymmetric. Entering the source view always maps from the visual caret (FR-001). Returning maps only when the writer actually moved the source caret or edited (FR-004); otherwise the existing exact restore applies (FR-003). The alternative reading, always mapping in both directions, was rejected because it would break the exact unedited round trip writers rely on today. This is the main behavioural choice to confirm at the clarify step.
- **Scroll follows the caret**: When a mapped caret is applied, the destination view reveals it, superseding a stale stored scroll for that switch. When FR-003's exact restore applies, today's scroll behaviour is unchanged.
- **Switch-time only**: Synchronisation happens when switching views. No continuous live sync exists in the product today (only one view is visible at a time), and none is added by this feature.
- **Supersession**: This feature partially supersedes the stored-context restore of the archived source-view specifications (002, 044, and 051) in exactly the cases FR-003 and FR-004 describe: 002 and 044's round-trip caret restore yields to the mapped restore when the source caret was moved or edited, and 051's unscrolled-path guarantee yields in the same caret-position respect. Every other guarantee of those specifications is restated here or left intact (FR-003, FR-006, FR-009).
- **No persistence**: The block-to-line correspondence is computed at switch time and never stored; there are no new saved settings, files, or channels.
