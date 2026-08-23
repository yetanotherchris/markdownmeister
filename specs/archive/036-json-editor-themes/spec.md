# Feature Specification: File-Based Editor Themes

**Feature Branch**: `036-json-editor-themes`

**Created**: 2026-08-22

**Status**: Archived

**Input**: User description: "I want the themes to be in a separate json file (move the json out, into these). there should be a folder in the config directory called 'themes' and each theme name in this folder, e.g. 'default-dark.json' and 'academic.json'. The JSON should have a dark and light JSON node, in the file. Each as the colours for each dark and light theme."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editor themes are ordinary files in the configuration directory (Priority: P1)

A user who opens the application's configuration directory finds a `themes` folder containing one file per editor theme, named after the theme it defines (for example `rustic.json`, `monotone-serif.json`). After installing or first running this version, the five themes that exist today are present there as individual files with their current names, palettes, and typeface choices unchanged. Selecting a theme in settings works exactly as before, and the selection survives restarting the application.

**Why this priority**: Moving theme definitions out of the application into user-visible files is the core of the request; every other story builds on themes living as files.

**Independent Test**: Install or launch the application, open the configuration directory, confirm the `themes` folder contains the five default theme files, select each theme in settings, restart, and confirm the selection persisted.

**Acceptance Scenarios**:

1. **Given** a fresh install (or first launch after upgrading), **When** the user opens the configuration directory, **Then** a `themes` folder exists containing one file per default theme — `rustic.json`, `rustic-serif.json`, `scholarly.json`, `monotone.json`, `monotone-serif.json` — and no other theme sources exist.
2. **Given** any theme file in the folder, **When** the user opens settings' theme area, **Then** a theme matching that file's name is offered for selection alongside all others.
3. **Given** a selected theme, **When** the application is closed and reopened, **Then** the same theme remains selected and applied.
4. **Given** an upgraded installation where the user had previously selected a built-in theme, **When** they first run the new version, **Then** that same theme is still selected with the same appearance as before the upgrade.

---

### User Story 2 - Every theme carries explicit light and dark palettes (Priority: P1)

Each theme file contains two colour sets inside it: one for light appearance and one for dark appearance, each consisting of the same curated colour tokens the editor uses today. The application applies whichever set matches the effective application appearance at the moment. When the operating system or the application's own setting switches between light and dark, the editor's colours follow immediately — without restarting, re-selecting, or saving anything. A theme whose two sets are identical simply looks the same in both appearances; the shipped defaults preserve today's exact behaviour (the themes that never changed with appearance keep identical sets).

**Why this priority**: This defines the content contract of every theme file. Getting the structure wrong would break appearance switching, which users experience dozens of times a day.

**Independent Test**: Select any theme, toggle the application between light and dark appearance, and confirm the editor switches to that theme's other palette immediately; open each default theme file and confirm it contains both a light and a dark colour set.

**Acceptance Scenarios**:

1. **Given** any theme file, **When** its contents are inspected, **Then** it contains exactly two colour sets, one designated for light and one for dark appearance, and each set contains all six curated colour tokens.
2. **Given** a selected theme while the application is in light mode, **When** the appearance switches to dark (by OS change or by the application's own appearance setting), **Then** the editor immediately renders that theme's dark set with no restart or re-selection.
3. **Given** a selected theme whose light and dark sets are identical, **When** the appearance switches either way, **Then** the editor's colours do not visibly change.
4. **Given** the default themes after upgrade, **When** their rendered appearance in light and dark modes is compared against the previous version, **Then** every default theme looks the same as before (Monotone continues to follow appearance; Rustic and Scholarly remain static).

---

### User Story 3 - Customising a theme means editing its file (Priority: P1)

The settings dialog's display-only Custom state disappears, and the configuration-file colour customisation introduced by spec 023 is withdrawn: theme files become the single way to define or change an editor theme's appearance. A user who wants different colours edits a theme file directly — changing tokens under the light or dark node — and sees the result the next time themes are read. Nothing about the previous version's customisation is lost in the move: anyone whose stored configuration contained hand-picked colours finds them preserved as a selectable theme file automatically created on first run after upgrading.

**Why this priority**: This completes "move the json out": files become the single source of truth for theme appearance. Removing the parallel mechanism keeps one mental model, and migration protects existing users from silent loss of their customisation.

**Independent Test**: Edit a token in a theme file, reopen settings, and observe the new colour; then take a pre-upgrade configuration containing non-default colours, run the new version once, and confirm those exact colours are available as a theme.

**Acceptance Scenarios**:

1. **Given** the settings dialog's theme area after this change, **When** the user inspects it, **Then** there is no way to alter a theme's colours from within the dialog: the area offers selection among discovered themes only, with no Custom entry and no custom-colour state.
2. **Given** a valid theme file with edited colour values, **When** the user reopens settings (no application restart), **Then** the theme offered and applied reflects the edited values.
3. **Given** a pre-upgrade configuration storing colours that match no default theme (a customised theme), **When** the new version runs for the first time, **Then** a theme file containing those exact colours is created automatically and appears as a selectable theme, in both appearances, looking identical to what the user had before.
4. **Given** a pre-upgrade configuration storing a default preset, **When** the new version runs for the first time, **Then** no extra migration file is created beyond the defaults and the stored selection resolves to the corresponding file.

---

### User Story 4 - Adding and removing themes is adding and removing files (Priority: P2)

A user can create a new theme by copying an existing file, renaming it, and editing its contents; on the next refresh the new theme appears in settings alongside the others. Deleting a theme file removes that theme. If the deleted theme was the selected one, the application falls back safely to a default rather than leaving a broken selection.

**Why this priority**: Extensibility is the point of external files, but it layers on top of the core move; the app must be correct without it before it can be extensible with it.

**Independent Test**: Copy a theme file under a new name, edit a distinguishing value, reopen settings and select it; delete the file while selected, restart, and confirm a sensible default is active with no errors.

**Acceptance Scenarios**:

1. **Given** a well-formed new theme file added to the folder, **When** the user reopens settings, **Then** the new theme is listed (named after its file) and can be selected and applied like any other.
2. **Given** a theme file is deleted, **When** the user reopens settings, **Then** that theme is no longer listed.
3. **Given** the currently selected theme's file is removed while it is applied, **When** the application next resolves the selection (restart or settings reopen), **Then** a default theme is active instead, the stale selection is repaired silently, and no error dialog interrupts the user.
4. **Given** a user-modified or user-created theme file, **When** the application starts or updates, **Then** the file's contents are left untouched; the application restores only its own missing default files, never overwrites existing ones.

---

### User Story 5 - Invalid theme files fail safe (Priority: P1)

Theme files are inputs the application does not control, so a broken one — invalid syntax, missing light or dark node, missing colour tokens, wrong types, unreadable permissions — must never crash the application, corrupt another theme, or leave the editor unusable. An invalid file is ignored, surfaced at most as a quiet indication, and everything else keeps working.

**Why this priority**: Once themes load from disk, malformed input is guaranteed to happen eventually; shipping discovery without fail-safe validation would make a typo in one file able to break the whole editor.

**Independent Test**: Place various malformed files (empty, syntactically invalid, missing nodes, missing tokens, wrong types) into the themes folder, restart, and confirm the application runs normally, valid themes work, invalid ones are absent or flagged quietly.

**Acceptance Scenarios**:

1. **Given** one or more invalid theme files in the folder alongside valid ones, **When** the application starts, **Then** it starts normally, all valid themes are available, and no invalid file produces a modal error or crash.
2. **Given** a theme file missing its dark node (or its light node), **When** themes are read, **Then** that file is rejected as incomplete rather than partially applied.
3. **Given** a theme file whose colour values are not valid colours, **When** themes are read, **Then** that file is rejected rather than rendering with substituted or partial colours.
4. **Given** an invalid file that later gets fixed on disk, **When** themes are next read, **Then** the now-valid theme appears and behaves normally.

---

### Edge Cases

- Two files differing only in letter case on a case-insensitive filesystem (e.g. `Rustic.json` and `rustic.json`): treated as one name; the collision is resolved deterministically and never produces two identically named themes or a crash.
- A file with unknown extra properties beyond the defined structure: valid ones are honoured, unknown properties are ignored rather than rejected (forward compatibility).
- The `themes` folder itself is missing, renamed, or deleted: recreated with the default files at startup; the application never fails to start over it.
- A default seed file exists but is unreadable due to filesystem permissions: the application continues with the remaining themes and surfaces a quiet indication, consistent with any other unreadable file.
- A theme file that is a symlink or shortcut pointing outside the configuration directory: not followed and not loaded; only ordinary files directly inside the `themes` folder count as themes.
- Files with other extensions, subdirectories, or hidden files placed in the folder: ignored entirely; discovery never descends into subfolders.
- A very large or binary file dropped into the folder: rejected by the same validation as any other invalid file, without stalling startup noticeably.
- Every file in the folder is invalid: the application falls back to a built-in default appearance so the editor is always usable, with a quiet indication.
- The selected theme file changes while the settings dialog is open: the list refreshes on next read; the dialog never hot-reloads mid-edit in a way that yanks the preview away while typing.
- The stored selection references a theme name that no longer matches any file after an upgrade or manual edit: handled by the same safe fallback as deletion, never a dangling reference.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST store editor theme definitions as one file per theme inside a `themes` folder within the application's configuration directory; no discoverable or selectable theme MAY be defined anywhere else. One exception exists: a single built-in emergency appearance (equivalent to today's default theme), never listed or selectable, used ONLY as the fail-safe required when no valid theme resolves (FR-013).
- **FR-002**: On first run after install or upgrade, the five default themes MUST exist as files named `rustic.json`, `rustic-serif.json`, `scholarly.json`, `monotone.json`, `monotone-serif.json`, preserving today's names, typeface choices, and rendered colours.
- **FR-003**: Each theme file MUST contain two colour sets keyed by appearance — one for light and one for dark — and each set MUST contain all six curated colour tokens used by the editor today; both sets are mandatory; a file missing either is invalid.
- **FR-004**: When resolving a theme's colours, the application MUST apply the set matching the current effective application appearance, and MUST re-resolve when the appearance changes so switching light/dark updates the editor immediately without restart or re-selection.
- **FR-005**: The application MUST discover every valid theme file directly inside the `themes` folder and offer each, identified by its file name (without extension), in the settings dialog's theme area alongside the others, in a stable order.
- **FR-006**: Selecting a theme MUST persist across restarts; the stored selection MUST reference the theme by name such that a file with that name being present again restores the selection.
- **FR-007**: Missing default theme files MUST be restored (recreated with shipped content) at startup; files that exist — default or user-created — MUST NEVER be overwritten or rewritten by the application during discovery, selection, or upgrade.
- **FR-008**: The settings dialog's theme area MUST offer only selection among discovered themes; editing a theme's colours MUST be possible only by editing its file. The configuration-file custom-colour mechanism and the display-only Custom state introduced by spec 023 MUST be withdrawn.
- **FR-009**: On first run after upgrading from the previous version, matching stored configuration against default themes MUST consider both colours and the stored typeface choice (mirroring spec 023's detection), because some default pairs share identical palettes and differ only by typeface. A stored configuration whose combination matches no default theme MUST be migrated into an automatically created theme file holding those exact colours in both appearance sets AND the stored typeface choice; a stored default-preset selection MUST resolve to the file for its exact colours-and-typeface combination, with no duplicate migration artifacts.
- **FR-010**: Theme files MUST be validated before use; a file that fails validation (syntactically invalid, structurally incomplete, wrong types, invalid colour values) MUST be excluded from discovery, MUST NOT affect any other theme or the application's stability, and its rejection MUST be indicated quietly (never modally).
- **FR-011**: Discovery MUST consider only regular files lying directly inside the `themes` folder; links or indirections pointing outside the configuration directory MUST NOT be followed, and nothing outside that folder MAY be read as a theme. All reading and validation MUST happen in the trusted part of the application.
- **FR-012**: The theme list MUST be refreshed when the settings dialog opens and at application startup, so file edits take effect no later than reopening settings, without requiring a restart.
- **FR-013**: If the selected theme cannot be resolved (its file was deleted, renamed, or became invalid), the application MUST fall back to a default theme, repair the stored selection, and MUST NOT show a blocking error or lose any document state.
- **FR-014**: Adding a well-formed theme file to the folder MUST make the theme available at the next refresh; removing a file MUST remove its theme at the next refresh; neither operation may require reinstalling, restarting, or any action inside the application beyond reopening settings.

### Key Entities *(include if feature involves data)*

- **Theme file**: A single JSON file in the configuration directory's `themes` folder; its base name is the theme's identity and display name; its contents define a typeface choice and exactly two colour sets (light and dark), each holding the six curated colour tokens.
- **Themes folder**: The `themes` directory inside the application's configuration directory; the only location theme definitions are ever read from.
- **Default theme (seed)**: One of the five theme files the application guarantees to exist, restoring it if absent but never rewriting it if present.
- **Discovered theme**: A theme made available by validating a file during discovery; exists only while its file remains valid.
- **Stored theme selection**: The persisted record of which theme name the user chose; resolved against discovered themes at read time with safe fallback.
- **Appearance variant**: The light or dark colour set within a theme file, selected by the application's effective appearance at render time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of fresh-install tests, the `themes` folder contains exactly the five default theme files and settings offers all five plus any added valid files, each sourced from disk (no embedded fallback in normal operation).
- **SC-002**: In 100% of appearance-switch tests across all default themes, the editor's colours follow the switch immediately (under one second, no restart): Monotone visibly changes, static defaults visibly stay.
- **SC-003**: A theme colour change made by editing a file is reflected in the applied editor after at most: save file + reopen settings. Zero restarts required in 100% of tested edits.
- **SC-004**: In 100% of adversarial-file tests (malformed JSON, missing node, missing/invalid tokens, symlinks out of the config directory, binary junk), the application starts, valid themes work, invalid ones are excluded, and no modal error appears.
- **SC-005**: In 100% of upgrade-migration tests, pre-upgrade customised colours are available post-upgrade as a selectable theme whose stored colour values are identical to the pre-upgrade configuration, and pre-upgrade default selections map to their exact colours-and-typeface files with no duplicates created.
- **SC-006**: In 100% of deletion/fallback tests, deleting the selected theme results in a repaired default selection with zero error dialogs and zero data loss.

## Clarifications

### 2026-08-22 (during specification)

- **File structure (user direction)**: Every theme file carries explicit light and dark nodes, each holding that variant's colours. This generalises the previous special case (only Monotone followed appearance) to all themes; defaults that previously looked static ship with identical light and dark sets so their rendered behaviour is unchanged.
- **Scope confirmed — user-extensible**: Users may add themes by adding files and customise themes only by editing files. Spec 023's customisation mechanism (hand-edited configuration colours surfaced as a display-only Custom state in the dialog) is withdrawn; there is no second customisation path.
- **Roster confirmed**: The five existing theme names are kept (`rustic`, `rustic-serif`, `scholarly`, `monotone`, `monotone-serif`). Names like `default-dark` / `academic` were illustrative examples of the one-file-per-name convention, not a rename mandate.

## Assumptions

- **Naming**: A theme's identity and display name derive from its file name minus extension. There is no separate name property inside the file; renaming a theme means renaming its file. Settings render the stem verbatim (`rustic-serif`), which intentionally replaces today's title-case labels ("Rustic Serif"); if humanised rendering is wanted, it can be added at planning time without changing this contract.
- **Unknown properties**: Extra unknown keys in a theme file are ignored rather than rejected, allowing forward-compatible additions.
- **Refresh timing**: Discovery happens at startup and when the settings dialog opens. No live file watching is required; a file saved mid-dialog is picked up on the next open. (Live watching could be added later without changing this contract.)
- **Ordering**: Themes are listed alphabetically by name; the five defaults therefore appear in alphabetical position among user themes, not grouped separately.
- **Migration naming**: The auto-created file for migrated customised colours uses a reserved, unlikely-to-collide file name: `migrated-custom.json` (chosen at planning time, 2026-08-23).
- **Wrong-extension files**: Files not ending in the theme extension are invisible to discovery (not errors); only files with the right extension that fail validation produce a quiet indication.
- **Fallback default**: When no valid theme resolves (including an empty or fully-invalid folder), the application falls back to the equivalent of today's default appearance so the editor is always usable.

### 2026-08-23 (during planning)

- **Rendering layering**: "Preserving today's rendered colours" (FR-002, US2 S4) is defined over the six curated colour tokens and each default's typeface — those move into the files verbatim. The per-preset stylesheet blocks that also hard-code derived chrome tones (hover, selection, secondary/inverse pairs, muted text variants, Scholarly's accent headings) are retained beneath the new file-driven token layer so unedited defaults stay pixel-identical; they fire only for the five default names and carry no user-facing customisation path, so files remain the single way to define or change a theme's identity, colours, or typeface. Editing a default file's tokens overrides the base values for every property the six-token mapping drives.
- **Theme-name validation**: The stored selection is now a theme name (file stem) rather than one of five fixed identifiers; main validates it as a bounded printable string with no path separators and resolves it against discovered themes at read time, falling back silently to the default theme when nothing matches (FR-013).
