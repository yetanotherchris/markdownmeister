# Feature Specification: Comment Writing Standards

**Feature Branch**: `phase-42-comment-style`

**Created**: 2026-08-24

**Status**: Archived

**Input**: User description: "Can you fix these issues, firstly creating AGENTS.md instructions to avoid this problem in the future, including the em instruction. In the agents.md file include the forbidding the descriptions of words you identified (e.g. slogans, performative, AI filler)"

## User Scenarios & Testing

### User Story 1: Future comments are concise and factual (Priority: P1)

A maintainer or agent can consult the repository guidance before writing a comment and understand which comments belong in code and which writing patterns are not permitted. The guidance prevents AI filler, unsupported claims, rhetorical labels, and em dashes in authored prose and comments.

**Why this priority**: Clear guidance prevents the same maintenance problem from returning after the existing comments are cleaned up.

**Independent Test**: Read `AGENTS.md` and confirm it states the permitted purpose of comments and the prohibited writing patterns.

**Acceptance Scenarios**:

1. **Given** a contributor writing a non-obvious code comment, **When** they read `AGENTS.md`, **Then** they can determine that the comment should explain a local behavior, constraint, or safety reason.
2. **Given** a contributor considering rhetorical prose, **When** they read `AGENTS.md`, **Then** they are told not to use AI filler, slogans, performative certainty, self-grandiosity, ceremonial all-caps emphasis, or attempts to sound like an expert.
3. **Given** a contributor writing authored prose or a comment, **When** they read `AGENTS.md`, **Then** they are told not to use em dashes and are given ordinary punctuation alternatives.

---

### User Story 2: Existing comments communicate only maintenance-relevant facts (Priority: P1)

A maintainer reading source, tests, scripts, workflows, or native code finds comments that describe local behavior and constraints without release history, review narratives, all-caps emphasis, or speculative implementation details.

**Why this priority**: Existing comments are read more often than the guidance and currently make maintenance harder.

**Independent Test**: Search the authored code comments for prohibited patterns, then inspect representative safety and behavior comments to confirm that their local meaning remains intact.

**Acceptance Scenarios**:

1. **Given** an authored code comment, **When** it is reviewed, **Then** it does not contain AI filler, slogans, performative certainty, self-grandiosity, ceremonial all-caps emphasis, or attempts to sound like an expert.
2. **Given** a comment that previously contained release or review history, **When** it is revised, **Then** it states only the local reason needed to maintain the code or is removed.
3. **Given** a comment describing a safety invariant, **When** it is revised, **Then** it preserves the concrete behavior without rhetorical labels or unsupported claims.

---

### Edge Cases

- Comments needed to explain path validation, data-loss prevention, platform behavior, or binary formats remain when they state a concrete local constraint.
- Generated files, third-party dependencies, lockfiles, fixtures, and archived specifications are not rewritten by this feature.
- User-facing strings and identifiers are not changed solely because they contain a word that the writing guidance prohibits in comments.

## Requirements

### Functional Requirements

- **FR-001**: `AGENTS.md` MUST define that comments explain a local, non-obvious behavior, constraint, or safety reason and that redundant comments are removed.
- **FR-002**: `AGENTS.md` MUST prohibit AI filler, slogans, performative certainty, self-grandiosity, ceremonial all-caps emphasis, and attempts to sound like an expert in authored prose and comments.
- **FR-003**: `AGENTS.md` MUST prohibit em dashes in authored prose and comments and name acceptable punctuation alternatives.
- **FR-004**: `AGENTS.md` MUST prohibit rhetorical labels and unsupported claims about external implementation details.
- **FR-005**: Authored comments in application source, tests, scripts, workflows, configuration, and native code MUST be revised or removed when they violate FR-002 through FR-004.
- **FR-006**: Revised comments MUST preserve concrete information necessary to maintain local behavior, security boundaries, data-loss protections, platform differences, or file-format handling.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `AGENTS.md` contains all of the writing rules in FR-001 through FR-004.
- **SC-002**: Searches of the in-scope authored comments find zero em dashes and zero ceremonial all-caps emphasis.
- **SC-003**: Every revised comment is either removed or reduced to a local, falsifiable explanation of the adjacent code.
- **SC-004**: Existing automated checks continue to pass without behavior changes.

## Assumptions

- This feature changes comments and contributor guidance only. It does not change application behavior, public interfaces, or user-facing copy.
- In-scope files are authored application source, tests, scripts, workflows, configuration, native code, and `AGENTS.md`. Generated files, dependency metadata, test fixtures, and archived specifications are excluded.
- Existing documentation outside `AGENTS.md` is not rewritten unless it is necessary to keep a comment-writing rule consistent.
