# Contract: `themes:list` (preload operation `getEditorThemes`)

Date: 2026-08-23. The only new IPC surface in spec 036. Constitution I: this is a named operation on the fixed preload API — no generic invoke, no parameters, no renderer-supplied paths. Constitution II: the themes directory is derived entirely in main from the centralised config-dir resolver; nothing the renderer sends can influence what is read.

## Channel

- Preload op: `window.api.getEditorThemes(): Promise<Result<EditorThemesList>>`
- Channel: `themes:list`
- Arguments: none
- Registered in: src/main/ipc/handlers/themes.ts (`registerThemesHandlers`), added to the teardown list in src/main/ipc/register.ts

## Response

```ts
interface EditorThemeDefinition {
  name: string      // file stem, verbatim display label (e.g. "rustic-serif")
  typeface: string  // css font-family string from the file
  light: EditorColors
  dark: EditorColors
}
interface EditorThemesList { themes: EditorThemeDefinition[]; invalidNames: string[] }
```

- `themes` is sorted by `name` ascending (code-unit comparison) and contains only files that passed validation (data-model §Validation rules).
- `invalidNames` lists rejected candidates by FILE NAME (with extension): malformed content, oversized, case-collision losers, and symlinks/links pointing out of the folder. It is a quiet indication for diagnostics; the UI renders nothing from it.
- Failure result: `{ ok: false, code: 'IO', message }` with absolute paths scrubbed (`sanitizeError`) — only when the directory itself cannot be read/created.

## Handler obligations (in order)

1. `isAuthorizedRenderer(event, window)` → else `err('IO', 'Unauthorized renderer')`.
2. Discover + validate the folder (never throws per-file).
3. Silent selection repair: if `loadSettings().editorTheme` matches no discovered name, persist `editorTheme: 'rustic'` via the authoritative settings store (`updateSettings`) — atomic debounced write, no dialog, response unaffected (FR-013).
4. Return `ok(list)`.

## Callers / refresh timing (FR-012)

- Renderer preload before first render (src/renderer/main.tsx), alongside settings.
- Every settings-dialog mount (the dialog unmounts on close, so each open refreshes).
- No push events; there is no file watcher (spec Assumptions).

## Guarantees

- No modal error path exists for invalid theme files; rejection is data-only.
- The handler never rewrites or deletes theme files; seeding/migration happen once at startup in main, outside this channel.
