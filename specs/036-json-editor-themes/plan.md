# Implementation Plan: File-Based Editor Themes

**Branch**: `phase-36-json-editor-themes` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/036-json-editor-themes/spec.md`, plus the fixed technical decisions issued with the implementation order (recorded here and in research.md; not re-litigated).

## Summary

Editor theme definitions move out of application code into ordinary JSON files in `<configDir>/themes/`, one file per theme, each carrying a typeface and explicit light and dark colour sets built from the six curated colour tokens the editor already uses. The main process seeds the five default theme files at startup (restoring missing ones, never rewriting existing ones), discovers and strictly validates every `*.json` file directly inside the folder, exposes them over one new named preload operation (`themes:list`), migrates spec 023's stored custom colours into a reserved `migrated-custom.json` on first run, and silently repairs a selection whose file disappeared by falling back to the default theme. The renderer resolves the effective palette per appearance from the delivered definitions, so light/dark switching stays immediate and renderer-side; the settings dialog's theme area becomes a data-driven list of discovered file stems with the spec 023 Custom state and config-colour mechanism withdrawn entirely.

## Technical Context

**Language/Version**: TypeScript 5.8 strict across Electron 43 main, sandboxed preload, and React 19 renderer (fixed stack, `docs/DESIGN_DECISIONS.md`)

**Primary Dependencies**: None new. Reuses `node:fs`, the shared IPC contract + preload `contextBridge` pattern, `atomicWrite` (src/main/fs/atomicWrite.ts), the settings store (settingsFile/settings), the `MM_CONFIG_DIR` test seam (recentItemsPath.ts), and the context helpers (`ok`/`err`/`sanitizeError`/`isAuthorizedRenderer`) in src/main/ipc/handlers/context.ts.

**Storage**: One JSON file per theme under `<configDir>/themes/` (config dir resolved by the centralised resolver; `migrated-custom.json` reserved for migration). Selection persists in the existing `config.json` settings section (`editorTheme` now stores the theme name = file stem).

**Testing**: Vitest unit suites (tests/main, tests/renderer) covering seeding, restore-only-missing, the discovery/validation matrix, case collisions, ordering, migration, fallback/repair, and renderer palette resolution; Playwright e2e (tests/e2e/json-editor-themes.spec.ts) covering the acceptance scenarios against the real built app.

**Target Platform**: Windows 10/11, macOS 13+, Linux (Electron desktop app)

**Performance Goals**: Discovery runs once at startup and on each settings-dialog open over a small directory; off the keystroke path. Appearance switching remains a pure renderer recomputation (no IPC on toggle).

**Constraints**: Preload stays a fixed list of named operations (one op added); all reading/validation in main; invalid files fail quiet (`invalidNames`), never modal; saves/writes atomic; unsaved-change confirmations untouched.

## Constitution Check

*GATE: reviewed against all five principles; details below.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | Honoured — one new named operation `getEditorThemes()` on the fixed preload API (channel `themes:list`); no generic invoke; `contextIsolation`/`sandbox` untouched; the renderer receives validated data only and performs no filesystem work |
| II. Every Path Is Untrusted | Honoured — the themes directory is derived in main from the centralised config-dir resolver, never from renderer input; discovery enumerates the directory itself and only ever reads `path.join(dir, entry.name)` for entries it just listed, rejecting anything that is not a regular file directly inside the folder (symlinks/reparse points fail the regular-file test and are never followed) |
| III. Never Lose The User's Words | Untouched — no document read/write path changes; the only writes are theme-file seeding (create-if-missing, atomic via `atomicWrite`), migration (create-if-missing, atomic), and the existing debounced atomic settings write |
| IV. Calm, Predictable Editing | Honoured — invalid/unreadable theme files are excluded and reported only via the quiet `invalidNames` array; fallback and selection repair are silent; no dialogs or focus stealing |
| V. Test What Can Corrupt Or Escape | Honoured — adversarial coverage for malformed JSON, missing nodes, bad colours, wrong types, oversized files, symlinks/junctions pointing outside the folder, subdirectories, hidden files, case collisions, and the empty/all-invalid folder fallback |

No principle is violated. One spec-letter deviation (retained base CSS for the five default names) is recorded in Complexity Tracking below and in the spec's Clarifications.

## Project Structure

### Documentation (this feature)

```text
specs/036-json-editor-themes/
├── plan.md              # This file
├── research.md          # Verified evidence (paths + line numbers) behind D1–D8
├── data-model.md        # Theme-file schema, settings shape, IPC payload, rules
├── quickstart.md        # Manual verification steps beyond the automated gates
├── contracts/
│   └── preload.md       # themes:list contract + fallback/repair side effect
└── tasks.md             # Ordered, independently verifiable work items
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── editorThemeTokens.ts     # NEW: embedded default theme contents (verbatim palettes +
│   │                            #  typefaces), fontStackFor/isSerifTypeface, reserved names,
│   │                            #  emergency/default constants. Replaces editorThemePresets.ts.
│   └── ipc-contract.ts          # EDIT: EditorThemeDefinition/EditorThemesList types; DesktopApi
│                                #  gains getEditorThemes(); Settings slims (see data-model)
├── main/
│   ├── index.ts                 # EDIT: seed + migrate at startup (before window creation)
│   ├── ipc/
│   │   ├── register.ts          # EDIT: register/remove 'themes:list'
│   │   └── handlers/
│   │       └── themes.ts        # NEW: authorized handler; discovery + silent repair
│   └── themes/
│       ├── path.ts              # NEW: themes directory resolution (MM_CONFIG_DIR seam aware)
│       ├── validate.ts          # NEW: pure theme-file parsing/validation
│       ├── store.ts             # NEW: ensure dir, seed missing defaults, discover/list
│       └── migration.ts         # NEW: spec-023 legacy custom-colour migration (idempotent)
├── preload/
│   └── index.ts                 # EDIT: getEditorThemes named op
└── renderer/
    ├── main.tsx                 # EDIT: preload editor themes before first render
    ├── state/
    │   ├── editorThemes.ts      # NEW: cached definitions + load/refresh + paletteForMode
    │   └── settings.ts          # EDIT: defaults slimmed (legacy fields gone)
    ├── hooks/
    │   └── useSettingsState.ts  # EDIT: theme list state + refresh; Save stores the name
    ├── chrome/
    │   └── SettingsDialog.tsx   # EDIT: data-driven theme radios; Custom removed
    ├── editor/
    │   └── themes.css           # EDIT: generic file-driven layer appended; custom block removed
    ├── editorThemes.ts          # DELETED (registry replaced by delivered data)
    └── App.tsx                  # EDIT: resolution from delivered definitions + emergency fallback
tests/
├── main/
│   ├── themes/                  # NEW: validate/store/migration unit suites
│   ├── settings.test.ts         # EDIT: slimmed Settings shape
│   └── ...
├── renderer/
│   ├── editorThemeTokens.test.ts  # NEW (replaces editorThemePresets.test.ts)
│   ├── editorThemes.test.ts       # DELETED with the registry
│   └── ...
└── e2e/
    ├── json-editor-themes.spec.ts  # NEW: acceptance scenarios
    ├── editor-theme-custom.spec.ts # DELETED (mechanism withdrawn by FR-008)
    └── editor-theme.spec.ts        # EDIT: stem labels; slimmed config assertions
```

## Decision Log

**D1 — Delivery over one new named IPC operation.** `getEditorThemes()` (channel `themes:list`) returns `{ themes: [{name, typeface, light, dark}], invalidNames: string[] }` wrapped in the standard `Result`. Selection persists through the existing settings mechanism: `Settings.editorTheme` stores the theme name (the file stem) and its type widens from the closed five-name union to a validated theme-name string (data-model §Settings). Rejected: a second settings channel (duplicates the store), file watching (FR-012 requires refresh only at startup and dialog open), any generic `invoke` escape hatch (forbidden by Principle I).

**D2 — Main-process module tree `src/main/themes/`.** `path.ts` resolves the directory (honouring the `MM_CONFIG_DIR` seam exactly like settings do); `validate.ts` is a pure text→definition parser; `store.ts` owns directory lifecycle (ensure, seed-missing-defaults, discover); `migration.ts` owns the spec-023 upgrade step. Everything below the thin handler is electron-free and unit-testable without mocks, mirroring the settingsFile/settings split (research E9).

**D3 — Seeding and restore are create-if-missing only.** Startup writes any of the five default files that are absent, using the embedded template contents in `shared/editorThemeTokens.ts` (values verbatim from today's code, research E1/E2), through `atomicWrite`. An existing file — default or user-created — is never read-for-comparison, never rewritten (FR-007). A missing `themes` directory is created.

**D4 — Strict validation, quiet exclusion.** A file qualifies only if: it is a regular file directly inside the folder (dirent type; symlinks/reparse points fail this test and are never followed), `*.json`, not hidden, ≤ 1 MB, valid UTF-8 JSON object, has non-empty valid `typeface` and both `light` and `dark` nodes holding all six curated tokens as `#rrggbb` hex strings. Unknown extra keys (top-level or inside a palette) are ignored. Failures exclude the file and append its file name to `invalidNames` — never a modal (FR-010, constitution IV). Case-insensitive duplicate stems collapse to the lexicographically smallest file name (code-unit comparison); the losers are reported via `invalidNames`. The delivered list is sorted by name (code-unit ascending) so ordering is stable across machines (spec Assumptions: alphabetical).

**D5 — Rendering: file-driven six-token layer over the retained default base.** The renderer applies the selected definition as inline `--mm-theme-*` custom properties (six tokens + typeface) on the app container; a generic mapping block appended to `themes.css` (after the existing blocks, equal specificity, so it wins) maps them onto Crepe's variables exactly as the withdrawn spec-023 custom block did (research E3). The five default themes ship files whose six token values equal today's constants verbatim, so for unedited defaults the overlay equals the base and rendering is unchanged. The per-preset CSS blocks stay as the base layer so every derived Crepe tone (hover, selected, inverse, surface-low, on-surface variants, secondary pair, Scholarly's accent headings) remains pixel-identical (see Complexity Tracking). When nothing resolves, the container renders `data-editor-theme="default"` with the emergency palette (today's default: the rustic tokens + Inter) supplied as the generic block's `var()` fallbacks and inline values — the single FR-001 exception, never listed or selectable.

**D6 — Appearance re-resolution stays renderer-side.** `useEffectiveTheme` continues to produce the effective mode; a pure `paletteForMode(definition, mode)` picks the light/dark set from the delivered data (research E7), so toggling appearance recomputes the inline variables synchronously with zero IPC (FR-004, SC-002). Static defaults carry identical sets and therefore do not visibly change (US2 S3).

**D7 — Fallback and repair live in main.** Handling `themes:list`, main discovers, then checks the stored selection against the discovered names; an unresolved name is repaired to the default theme name (`rustic`) through the authoritative settings store (in-memory immediately, debounced atomic disk write), and the response still returns normally. This makes FR-013 hold for every consumer of the list without renderer-side policy, and it is idempotent. The renderer independently renders the emergency palette whenever the stored name does not match a delivered definition (including the brief pre-fetch window — mitigated by preloading before first render), losing no document state and showing no error.

**D8 — Withdrawal of the spec-023 mechanism.** Deleted: `resolveEditorTheme`, `presetColorsFor`, `presetFontFor`, the `EDITOR_THEMES` registry, the `editor-theme='custom'` CSS block and `--mm-custom-*` plumbing in App.tsx, the display-only Custom radio, and the `editorColors`/`editorFont` fields (removed from `Settings`, `DEFAULTS`, validation, merge, and the renderer cache). Legacy configs carrying those keys are tolerated on disk; only the migration step reads them (raw config read), satisfying "stop acting on legacy custom fields". `shared/editorThemePresets.ts` is superseded by `shared/editorThemeTokens.ts` (typeface stacks, `fontStackFor`, `isSerifTypeface`, embedded default contents, reserved names).

**D9 — Migration mirrors spec 023 detection.** At startup, after seeding: read the raw `.settings` section; if it stores a valid six-token `editorColors` record, compare (case-insensitive hex, like `colorsMatch`) plus the stored two-valued `editorFont` against the five defaults' colours-and-choice table (research E1): an exact match repairs `editorTheme` to that file stem (no duplicate artifact); no match creates `migrated-custom.json` holding those colours in BOTH sets plus the typeface stack for the stored choice — never overwriting an existing file. Both outcomes are idempotent across restarts; invalid/absent legacy colours make the step a no-op. Note `scholarly`'s legacy choice is `sans-serif` while its file typeface is the Arial stack it renders today — matching uses the choice, rendering uses the stack (research E1/E2).

## Complexity Tracking

> Two deliberate deviations from the artifacts' letter, both recorded where AGENTS.md requires.

1. **Retained name-keyed base CSS for the five default names (bends FR-001's "no theme defined anywhere else").** The six-token schema cannot express eleven derived Crepe tones that today's preset blocks hard-code (hover/selected/inverse/on-inverse/surface-low/on-surface/on-surface-variant/secondary/on-secondary/inline-area, plus Scholarly's accent-coloured headings, research E3). Dropping those blocks would visibly change selection, hover, muted-text, and heading colours of every default theme, violating FR-002/US2-S4 ("rendered appearance … compared against the previous version … looks the same as before"), which is an explicit acceptance scenario with a comparison test. The chosen layering keeps the blocks as a base beneath the file-driven overlay: identity, tokens, typeface, and every user-facing customisation come solely from the files; the base CSS fires only for the five default names, offers no second customisation path, and goes dormant if a default file is renamed away. Simpler alternative rejected: deleting the blocks (single flat layer) in favour of not regressing the defaults' appearance. Recorded in the spec's Clarifications (2026-08-23).
2. **`Settings.editorTheme` widens from a closed union to a validated string.** Spec 016's closed-union guarantee exists so main never stores arbitrary text; file-stem identities cannot be a compile-time union, so the guarantee is replaced by explicit main-side validation (`isValidEditorThemeName`: printable, no path separators or control characters, 1–100 chars) plus strict rejection of malformed patches, and resolution-with-fallback everywhere the name is consumed. Simpler alternative rejected: keeping the union (would forbid user themes — the point of the feature).
