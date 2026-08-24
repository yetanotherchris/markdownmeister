# Implementation Plan: Comment Writing Standards

**Branch**: `phase-42-comment-style` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/archive/042-comment-writing/spec.md`

## Summary

Add durable comment-writing rules to `AGENTS.md`, then audit and simplify in-scope authored comments. Preserve concrete maintenance information while removing rhetoric, history, and unsupported claims. Verify the result with targeted searches and the existing static checks.

## Technical Context

**Language/Version**: Markdown, TypeScript, JavaScript, PowerShell, YAML, C++, and configuration files already in the repository

**Primary Dependencies**: None

**Storage**: Repository files only

**Testing**: Targeted `rg` audits, `npm run lint`, `npm run typecheck`, and `npm run test`

**Target Platform**: Repository contributors and all supported application platforms

**Performance Goals**: No runtime behavior or performance changes

**Constraints**: Do not modify generated files, dependencies, fixtures, archived specifications, user-facing strings, or code behavior

**Scale/Scope**: `AGENTS.md` and in-scope comment-bearing files under `src/`, `tests/`, `scripts/`, `.github/`, `native/`, plus root configuration files

## Constitution Check

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | No code or IPC behavior changes. |
| II. Every Path Is Untrusted | Safety comments remain accurate and concise. |
| III. Never Lose The User's Words | Data-loss comments remain accurate and concise. |
| IV. Calm, Predictable Editing | No editing behavior changes. |
| V. Test What Can Corrupt Or Escape | Existing tests remain intact and are run after the cleanup. |

All gates pass. No violations to track.

## Project Structure

```text
AGENTS.md                           # Comment-writing rules
src/                                # Application comments
tests/                              # Test comments
scripts/                            # Automation comments
.github/                            # Workflow comments
native/                             # Native-code comments
specs/archive/042-comment-writing/
├── spec.md
├── plan.md
└── tasks.md
```

**Structure Decision**: No new source structure or runtime modules are needed. The change is a focused edit to existing commentary and repository guidance.

## Complexity Tracking

No constitution violations.
