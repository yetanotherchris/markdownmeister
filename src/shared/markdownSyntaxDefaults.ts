/**
 * Spec 030 FR-013: the single source of truth for the six markdown syntax
 * option defaults — hard breaks OFF (strict CommonMark soft breaks), the five
 * syntax extensions ON. Shared by the main-process config `DEFAULTS`, the
 * renderer's settings cache, and the editor composer so no two sites can drift.
 */
export const MARKDOWN_SYNTAX_DEFAULTS = {
  hardBreaks: false,
  strikethrough: true,
  tables: true,
  taskLists: true,
  math: true,
  autolink: true
} as const