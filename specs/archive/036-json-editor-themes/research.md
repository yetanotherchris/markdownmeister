# Research: File-Based Editor Themes

Date: 2026-08-23. Every claim below was verified against the worktree source during planning; file paths and line numbers refer to the branch `phase-36-json-editor-themes` as of the planning commit.

## E1 — Today's theme data: six curated tokens, five presets, two typefaces

- The canonical six curated colour tokens are `background, foreground, accent, surface, outline, code` — `EditorColors` in src/shared/ipc-contract.ts:153-160, validated as a closed six-key record of `#rrggbb` hex by `isEditorColors`/`HEX_COLOR` at src/main/settingsFile.ts:91-108.
- Palette values (src/shared/editorThemePresets.ts): rustic `RUSTIC_COLORS` lines 25-32 (`#fdf6e3/#1f1b16/#805610/#fdf3d9/#817567/#ba1a1a`); scholarly lines 34-41 (`#ffffff/#1a1a1a/#00b0e9/#f7f7f7/#8a8a8a/#b50000`); monotone light 43-50 (`#ffffff/#000000/#000000/#ffffff/#808080/#000000`) and dark 52-59 (`#000000/#ffffff/#ffffff/#000000/#808080/#ffffff`), exported together as `MONOTONE_COLORS` 61-66.
- Legacy two-valued font choices per preset: static presets 70-74 (`rustic: sans-serif`, `rustic-serif: serif`, `scholarly: sans-serif`), monotone pair 76-79 (`sans-serif`, `serif`). Detection `resolveEditorTheme` 104-125 matches colours case-insensitively (`colorsMatch` 82-84) and accepts EITHER monotone variant (115-122) — migration must mirror exactly this.
- Typeface stacks: `SANS_STACK`/`SERIF_STACK` at 143-144, mapped by `fontStackFor` 147-149; `presetFontFor` 153-155.

## E2 — Rendered output today comes from themes.css blocks, not only the six tokens

src/renderer/editor/themes.css: each default has a full block keyed by `data-editor-theme` — rustic 24-44, rustic-serif 46-66, scholarly 79-99, monotone light/dark 114-134/137-157, monotone-serif 160-180/182-202. These define SEVENTEEN `--crepe-color-*` values; eleven of them are NOT among the six curated tokens (e.g. rustic `--crepe-color-on-surface:#201b13` vs foreground `#1f1b16`; hover `#f9ecdf`; selected `#ede0d4`; secondary `#fbdebc`; inverse `#362f27`; inline-area `#e4d8cc`; scholarly surface-low `#f2f2f2`, on-surface `#1a1a1a`, on-surface-variant `#4d4d4d`, secondary `#e5f4fb`, on-secondary `#00313f`, inverse `#1a1a1a`, on-inverse `#f5f5f5`, hover `#f0f8fb`, selected `#dff0f7`, inline-area `#e4ecf0`). Scholarly additionally colourises h1–h6 with its accent (101-109). Serif themes re-declare the Inter stack inside the Crepe top-bar scope to keep the toolbar readable (73-77); the custom block repeats this for custom serif themes (227-230).

Consequences pinned by plan D5: (a) the generic file-driven layer must map the six tokens onto Crepe variables exactly as the spec-023 custom block does (204-222: background→background, foreground→on-background, surface→surface and surface-low, foreground→on-surface, outline→on-surface-variant and outline, accent→primary, code→inline-code and error, plus both font vars); (b) the preset blocks must remain as a base layer or every default's derived tones change; (c) Scholarly's file typeface is its rendered stack `Arial, 'Helvetica Neue', Helvetica, sans-serif` (themes.css:97) even though its legacy two-value choice is `sans-serif`.

## E3 — The withdrawn mechanism (spec 023) and its seams

Custom plumbing today: App.tsx builds `--mm-custom-*` inline variables when resolution says custom (src/renderer/App.tsx:88-106) and sets `data-editor-theme` from `resolveEditorTheme` (93-94, 332); SettingsDialog renders the disabled display-only Custom radio (src/renderer/chrome/SettingsDialog.tsx:389-405) and skips Save while no preset is staged (109-111, 418-425); useSettingsState materialises preset colours+font on save (src/renderer/hooks/useSettingsState.ts:90-105); settings persist `editorTheme` (closed union, settingsFile.ts:61-78), `editorFont`, and `editorColors` (DEFAULTS 30-48; validation 110-157; merge 166-209). All of it is removed in task T007; legacy keys stay tolerated in raw config reads for migration only (plan D8/D9).

## E4 — IPC/preload pattern to copy

Handlers register per domain with authorization + typed results: src/main/ipc/handlers/settings.ts:14-46 uses `isAuthorizedRenderer` (context.ts:63-73), `ok`/`err` (52-61), and `sanitizeError` (75-90, scrubs absolute paths unconditionally). Channel teardown lists every channel explicitly in src/main/ipc/register.ts:15-41 before re-registering. Preload exposes named ops via `invokeResult` (src/preload/index.ts:47-51) on the single `api` object (53-154). New surface follows this verbatim; `validateShape`/`ensureString` (context.ts:117-177) are unused here because `themes:list` takes no arguments — the handler still gates on authorization first.

## E5 — Config directory and test seam

`recentItemsConfigPath()` resolves `<configDir>/config.json` honouring the `MM_CONFIG_DIR` seam before anything else (src/main/recentItemsPath.ts:25-39); settings resolve through the same function (src/main/settings.ts:23-35). The themes folder therefore derives as `path.dirname(recentItemsConfigPath()) + '/themes'`, which under e2e isolation lands inside the per-test temp dir automatically (tests/e2e/launch.ts:253-278 sets `MM_CONFIG_DIR`). Startup ordering lives in `bootApp` (src/main/index.ts:135-183): config migration → explorer reconcile → theme/spellcheck application → window creation; seeding+migration slot in before the first `loadSettings()` so a repaired selection is what the renderer preloads.

## E6 — Atomicity and write hygiene

All app writes go through `atomicWrite` (temp file `'wx'` in destination dir + fsync + rename; src/main/fs/atomicWrite.ts:15-46); settings writes already use it read-modify-write preserving sibling sections (settingsFile.ts:316-322). Theme seeding and migrated-custom.json creation reuse `atomicWrite`. Its temp names start with `.` — consistent with discovery ignoring hidden files, so an interrupted seed can never be discovered as a half-written theme.

## E7 — Appearance switching is already live and renderer-side

`useEffectiveTheme` (src/renderer/hooks/useEffectiveTheme.ts:46-60) tracks `(prefers-color-scheme)` changes and returns the effective mode; e2e simulates OS switches via `emulateMedia` (tests/e2e/editor-theme.spec.ts:89-92, 221-246 prove live monotone switching). Extending resolution to pick `light|dark` from delivered data (plan D6) keeps that path untouched — no IPC on toggle.

## E8 — Gates, limits, and suite layout

- `npm run check` enforces: files ≤500 lines (orchestration ≤300, css ≤400), function complexity ≤15, no import cycles, and NO unused exports across src (test references count) — scripts/check-maintainability.mjs:22-37, 307-320. This forces deleting (not merely abandoning) the spec-023 exports once unreferenced.
- Prettier printWidth 100 (.prettierrc); repo hard limit 120 cols; `format:check` is an explicit list in package.json:21 — new files must be appended.
- Vitest projects `main` (node env, tests/main/**) and `renderer` (jsdom, tests/renderer/**) — vitest.config.ts:5-20. Playwright runs single-worker (playwright.config.ts:6-10); e2e launches built output with stubbed dialogs (launch.ts:137-231) and exposes `messageBoxCallCount` (199-201) to assert "no error dialog".
- Existing suites touching this feature that must move with it: tests/renderer/editorThemes.test.ts (pins the registry), tests/renderer/editorThemePresets.test.ts (pins detection/materialisation), editorColors/editorFont cases in tests/main/settings.test.ts:295-420, and tests/e2e/editor-theme-custom.spec.ts (whole file withdrawn with FR-008).

## E9 — Platform behaviour relied on by the adversarial tests

- Node's `fs.readdirSync(..., {withFileTypes:true})` reports entry types without following links: a symlink/reparse-point entry fails `dirent.isFile()`, so "regular files directly inside the folder" excludes links of any flavour; junction/symlink directories fail it too. Discovery additionally refuses entry names containing path separators or `..` segments (defence in depth; readdir names cannot contain them).
- Windows symlink creation for files requires privilege/Developer Mode, so the automated escape tests create a directory junction pointing outside the folder (no elevation needed) and, when the OS allows it, a file symlink; either way the assertion is exclusion-without-following. Recorded here because it shapes how the FR-011 test is written, not as a relaxation.
- Case-insensitive collisions (`Rustic.json` vs `rustic.json`) exist on Windows/macOS default filesystems; grouping by lowercased stem with the lexicographically smallest full file name winning is deterministic everywhere (code-unit comparison, not locale-aware).

## E10 — Review correction: the single overlay was neither specificity-safe nor pixel-identical

Post-implementation review found two defects in D5 as originally shipped; both are fixed in place and recorded here as evidence for the revision:

- **Specificity.** The four `[data-theme]`-qualified monotone preset blocks score (0,4,0) against the generic layer's (0,3,0) `.app-container[data-editor-theme] .milkdown`, so editing `monotone.json` / `monotone-serif.json` changed nothing — contradicting FR-008's "editing a theme's colours MUST be possible only by editing its file".
- **Pixel identity.** Mapping surface→surface-low, foreground→on-surface, and outline→on-surface-variant overrode dedicated base values on every static default: rustic `#fcefce`→`#fdf3d9`, `#201b13`→`#1f1b16`, `#4f4539`→`#817567`; scholarly `#f2f2f2`→`#f7f7f7`, `#4d4d4d`→`#8a8a8a`; monotone light `#f2f2f2`→`#ffffff`, `#404040`→`#808080`; dark `#1a1a1a`→`#000000`, `#bfbfbf`→`#808080`. Research E2(b) had listed these divergences without noticing the overlay overrides them — violating US2-S4 despite the clarification's "pixel-identical" wording.

Revision (plan D5): split the overlay in two — derived tones map in a rule placed BEFORE the preset blocks (they lose for the five default names, apply for user themes and the emergency appearance); the six curated tokens + typeface map in a `[data-theme]`-qualified rule AFTER them (ties with the monotone blocks at (0,4,0), wins by source order). A cascade unit test (`tests/renderer/themesCssCascade.test.ts`) pins the exact resolved values per theme/mode so neither defect can recur silently.

## References

- Fixed decisions issued with the implementation order (theme-file schema, reserved filename, payload shape, strictness matrix, migration rule, fallback exception, dialog behaviour) — recorded in plan.md D1–D9 and data-model.md; not re-litigated there.
- specs/archive/023-custom-editor-theme/spec.md — withdrawn mechanism; detection semantics mirrored by migration (FR-009).
- docs/DESIGN_DECISIONS.md, .specify/memory/constitution.md — fixed stack and principles.
