# Research: Replace Source Editor

## R1: Editable Markdown and YAML source highlighting

**Decision**: Replace the controlled source textarea with a small imperative CodeMirror 6 wrapper using `EditorState`, `EditorView`, Markdown language support, `yamlFrontmatter({ content: markdown() })`, and default syntax highlighting. Declare the CodeMirror packages directly in runtime dependencies.

**Rationale**: CodeMirror preserves arbitrary raw text while incrementally rendering syntax decorations, including a leading `---` YAML block. Its editor APIs provide selection, scroll, focus, and native content attributes needed to retain the current source-view workflow. The implementation stays entirely in the sandboxed renderer and uses the existing `onContentChange` document flow. Direct dependencies avoid relying on packages transitive to Crepe.

**Alternatives considered**: A highlighted `<pre>` behind a textarea cannot reliably align scroll, selection, IME, accessibility, and spellcheck. Reusing Milkdown/ProseMirror risks source normalization. Monaco adds an unnecessary worker and dependency surface. Importing CodeMirror only through Crepe internals couples the feature to unsupported transitive implementation details.

## R2: Source context and raw text authority

**Decision**: Add `sourceSelectionAnchor`, `sourceSelectionHead`, and `sourceScrollTop` to each open document and a source-context reducer action. Keep formatted-editor `cursorOffset` and `scrollTop` separate.

**Rationale**: Existing formatted cursor/scroll values are captured from and restored to Crepe, and are reset during source-to-formatted refresh. Reusing them would overwrite source state or restore it to the wrong editing engine. CodeMirror can report primary selection and scroll without changing the raw document; content changes continue through the existing full-source `UPDATE_CONTENT` path, which splits frontmatter and compares exact raw text against `baseline`.

**Alternatives considered**: Holding context only in component refs loses it when a tab's source surface unmounts or is evicted. Sharing formatted-editor context violates per-surface ownership and can cause inaccurate restoration.

## R3: Native source spellcheck

**Decision**: Set CodeMirror's editable content `spellcheck` attribute from the existing `spellcheckEnabled` setting and retain the source editor's current test id and accessible label.

**Rationale**: Chromium/Electron owns native spellchecking and the existing renderer setting already controls the textarea this replaces. The attribute preserves ordinary-prose spellcheck without introducing a second source spellchecker or an IPC change.

**Alternatives considered**: Reusing the visual editor's JavaScript spellchecker would add parsing and correction-menu behavior to the source surface, beyond feature scope and inconsistent with the current source workflow.

## R4: Visual-editor code highlighting setting

**Decision**: Add a persisted `visualCodeHighlighting: boolean` setting with default `true`. Configure Crepe's existing CodeMirror feature and language list when each visual editor is created, then use a root presentation data attribute and scoped CSS to neutralize code token colors when the setting is off.

**Rationale**: Crepe configures features at construction. Recreating or reconfiguring code-block editors would risk selection, undo history, dirty state, and document transactions. CSS changes only paint, so toggling is immediate and does not modify source text, language labels, source-view highlighting, editor state, or the document model.

**Alternatives considered**: Toggling `CrepeFeature.CodeMirror` requires remounting. Reusing Markdown syntax reconfiguration dispatches document transactions. Directly reaching embedded CodeMirror node views relies on unsupported private state. Parsing or rewriting fences changes content.

## R5: Settings persistence and validation

**Decision**: Extend the existing typed `Settings` contract, renderer defaults/cache, main default settings, tolerant on-disk settings normalization, strict settings IPC patch validation, and atomic settings-file persistence with the new boolean.

**Rationale**: This follows the established settings flow and ensures fresh installs default on, hand-edited or legacy invalid values safely fall back, and renderer-supplied values are explicitly validated in main.

**Alternatives considered**: Local renderer storage would bypass the existing application settings model and make restart behavior inconsistent. A new settings IPC channel is unnecessary because the existing named operation supports typed patches.

## R6: Test strategy

**Decision**: Add reducer and settings tests plus Playwright Electron workflows for source syntax, raw saving, malformed content, tab-local selection/scroll, spellcheck, unsaved-change protection, visual-code toggling, and restart persistence.

**Rationale**: Source editing and visual code blocks rely on browser/editor integration that jsdom cannot prove. Existing Electron e2e infrastructure launches the built app and already covers source and Markdown settings patterns; unit tests retain fast coverage of pure state and main-process validation.

**Alternatives considered**: Unit-only tests cannot validate native spellcheck, focus, CodeMirror rendering, or persistence across actual app restart.
