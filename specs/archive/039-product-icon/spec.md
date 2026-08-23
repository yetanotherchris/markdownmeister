# Feature Specification: Product Icon

**Feature Branch**: `039-product-icon`

**Created**: 2026-08-22

**Status**: Archived

**Input**: User description: "I want the editor to have an icon. It will need gemini nano banana or grok to produce this. It should be the correct type e.g. PNG and correct dimensions for an icon."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The product looks like itself everywhere an icon appears (Priority: P1)

Today every installation shows the development framework's default icon: in the taskbar, Start menu, Dock, file manager, installer, and the operating system's program lists. After this feature, every surface where an operating system displays an application icon shows the MarkdownMeister product icon instead — installed app, running window, installer, uninstall entry, shortcut, and file-association entries alike. A user can pick the application out of a lineup.

**Why this priority**: An icon that exists but doesn't reach the actual launcher surfaces changes nothing visible; full coverage is the feature.

**Independent Test**: Install the application fresh on each platform and inspect every icon-bearing surface (taskbar/Dock while running, Start menu/launcher entry, installed-programs list, installer UI, file-manager "Open with" entries); confirm none still show the default framework icon.

**Acceptance Scenarios**:

1. **Given** a fresh install on Windows, **When** the application runs and the taskbar, Start menu tile/entry, installed-programs list, and installer screens are inspected, **Then** each shows the product icon and none shows the default framework icon.
2. **Given** a fresh install on macOS, **When** the Dock and Applications folder are inspected while the application runs and while it is closed, **Then** both show the product icon.
3. **Given** a fresh install on Linux via the distributed AppImage, **When** the desktop entry is created and the application launches, **Then** the launcher/menu entry and the running taskbar item show the product icon.
4. **Given** the existing "Open with"/"Open in MarkdownMeister" registrations (specs 006/035) — which already point their displayed icons at the application executable — **When** those context-menu entries are viewed in a file manager after this change, **Then** they show the product icon through the executable's embedded icon, requiring no registration change.

---

### User Story 2 - One master artwork, correct formats and dimensions per platform (Priority: P1)

A single high-resolution master artwork is committed to the repository, and every platform-specific icon file is derived from it: a multi-resolution icon file for Windows containing the small sizes through extra-large, the bundled icon format for macOS, and a set of PNG sizes for Linux covering the size the desktop-entry mechanism installs today plus larger sizes for icon-theme completeness. No platform receives an upscaled, cropped, or hand-redrawn approximation; every derived asset traces back to the one master.

**Why this priority**: Wrong formats or missing small sizes are the classic way an icon feature fails in practice — blurry taskbar pixels on Windows, missing Dock icon on Linux. The derivation chain is what makes the result correct everywhere.

**Independent Test**: Open the committed master and each derived asset; confirm the required size ladder exists in each platform's file, that each rendered size is sharp (not upscaled), and that regenerating derived assets from the master reproduces them.

**Acceptance Scenarios**:

1. **Given** the repository contents, **When** the master artwork is inspected, **Then** it is a lossless, square image of at least 1024×1024 pixels with transparency, committed alongside the derived assets it produces.
2. **Given** the Windows asset, **When** its contained sizes are listed, **Then** they include 256×256 down through the small sizes used by lists and title bars, each individually crisp.
3. **Given** the Linux asset set, **When** the desktop-entry installation runs (the existing mechanism), **Then** it finds the PNG size it consumes — 256×256 today — installs it into the icon theme with unchanged behaviour, and larger sizes remain available for icon themes that support them.
4. **Given** any derived asset, **When** compared against the master artwork, **Then** it is recognisably the same design with no recolouring, cropping, or proportion drift between platforms.

---

### User Story 3 - The artwork is generated, then chosen by a human (Priority: P2)

The artwork is produced with an AI image generator (Gemini's image model, known as "Nano Banana", or Grok's image generation), iterating on prompts until candidates fit the product's character: minimal, calm, geometric enough to survive tiny sizes. A human reviews the candidates and selects the final artwork; the machine proposes, the person decides. Generated output must not reproduce identifiable third-party intellectual property.

**Why this priority**: The generation route shapes how candidates are produced but the deliverable contract (formats, sizes, aesthetics) stands regardless; human selection keeps taste and legal sanity in the loop.

**Independent Test**: Review the generation session record: multiple candidate images exist, the selected one is traceable to that session, and the final committed master matches the selected candidate.

**Acceptance Scenarios**:

1. **Given** the implementation of this feature, **When** the artwork process is reviewed, **Then** several AI-generated candidates were produced and a human explicitly chose among them before anything was committed.
2. **Given** the selected artwork, **When** examined at the smallest supported size, **Then** it remains recognisable and unambiguous at 16×16 pixels.
3. **Given** the selected artwork, **When** placed on both a light and a dark taskbar background, **Then** it retains adequate contrast against either.
4. **Given** any candidate considered, **When** inspected, **Then** none reproduces a recognisable existing product's logo or protected imagery.

---

### Edge Cases

- Platforms round or mask icons differently (macOS squircle conventions, Windows square-with-transparency): the master is designed to tolerate both treatments without redesign; per-platform padding decisions are recorded once, not improvised per size.
- Very old Windows list views rendering only the smallest sizes: the small ladder entries are hand-checked, not left to automatic downsampling alone.
- High-DPI displays scaling the taskbar icon: mid and large sizes prevent visible blur at 125–200% scaling.
- Regenerating derived assets after a master tweak: the derivation is repeatable, so a future colour tweak does not require re-doing platform files by hand or leave platforms inconsistent.
- The icon appearing inside the application or on the web later (an About section, a project website): out of scope here beyond committing the master others may consume; such features take the same master rather than redrawing variants.
- Transparency mishandling by a converter producing black boxes or halos: each derived format is visually verified on both light and dark backgrounds.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A single master artwork MUST be committed to the repository: lossless format, square, at least 1024×1024 pixels, with transparency, serving as the sole source for every derived icon asset.
- **FR-002**: Derived platform assets MUST be produced from the master: a Windows multi-resolution icon covering at least 256×256, 128, 64, 48, 32, 24, and 16 pixels; a macOS bundled icon; and a Linux PNG ladder that includes at least 256×256 — the size the existing desktop-entry mechanism installs — and extends to at least 512×512 for icon-theme completeness.
- **FR-003**: Every packaged artefact on every distribution channel the product ships today — the Windows installer, portable archives, Scoop manifest assets, macOS disk images, and the Linux AppImage — MUST embed the derived assets so that all operating-system icon surfaces show the product icon: running-window/taskbar or Dock, launcher menus, installed-programs listings, and installer or uninstaller UI. Any future distribution channel MUST embed them as well.
- **FR-004**: The existing file-association and folder-action registrations (specs 006/035) MUST present the product icon wherever those entries are displayed.
- **FR-005**: The artwork MUST be produced using AI image generation — Gemini's "Nano Banana" or Grok's image generation per user direction (equivalent generators acceptable if results are better) — with a human selecting the final artwork from multiple generated candidates before commit. The generation session record — the prompts used and the selected candidate image — MUST be committed alongside the master artwork as its provenance.
- **FR-006**: The selected artwork MUST fit the product's character — minimal, calm, geometrically simple — and MUST remain recognisable at 16×16 pixels and legible against both light and dark system backgrounds.
- **FR-007**: The master and all derived assets MUST be versioned in the repository; derived assets MUST be reproducible from the master alone, and a change to the master MUST regenerate every platform's assets together so no platform drifts.
- **FR-008**: No committed asset MAY reproduce identifiable third-party logos or protected imagery.

### Key Entities *(include if feature involves data)*

- **Master artwork**: The single committed source image from which every platform icon derives; the canonical definition of the product mark.
- **Derived platform assets**: The per-format files (Windows multi-resolution icon, macOS bundle icon, Linux PNG ladder) generated from the master; never edited independently.
- **Icon surfaces**: The operating-system locations where an application icon is displayed (taskbar/Dock, launcher, installed-programs, installer, file-association entries); the completeness checklist for coverage.
- **Generation session**: The AI-image-generation iteration record — prompts, candidates, and the human selection — establishing provenance of the final artwork.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of fresh-install tests across Windows, macOS, and Linux, every checked icon surface shows the product icon and zero surfaces retain the default framework icon.
- **SC-002**: In 100% of size-ladder inspections, each Windows icon resolution renders sharp at its native size with no upscaling artifacts.
- **SC-003**: The 16×16 rendering passes recognition checks by reviewers unfamiliar with the larger artwork in at least 4 of 5 cases.
- **SC-004**: In 100% of side-by-side comparisons, every platform's icon is visually identical in design (colour, geometry, proportions) with only platform-convention treatment differing.
- **SC-005**: Regenerating derived assets from the committed master reproduces functionally equivalent assets (a reviewer cannot tell a regenerated build from the committed one in blind comparison).
- **SC-006**: In 100% of contrast checks against light and dark taskbar/Dock backgrounds, the icon remains clearly visible without background-dependent retouching.

## Clarifications

### 2026-08-22 (during specification)

- **Production route (user direction)**: The artwork is to be produced with an AI image generator — named options were Google Gemini's "Nano Banana" and Grok's image generation. Recorded here because it is a user-directed constraint; the spec's enforceable contract remains on the committed artefacts (formats, dimensions, aesthetics, provenance), and any equally capable generator is acceptable (FR-005).
- **Scope**: One product icon feeding every consumer (launchers, installers, file associations, any future store listing or project website). Per-surface bespoke variants are out of scope.

## Assumptions

- **Art direction approval**: Candidate artworks are presented to the maintainer during implementation and the final selection is theirs; this spec fixes the constraints, not the specific picture.
- **Toolchain locations**: Where derived files live in the repository follows the packaging tooling's conventional layout; decided at planning time.
- **Conversion tooling**: Deriving platform formats from the master uses scriptable converters committed to the repository, so FR-007's reproducibility holds without undocumented manual steps.
- **Trademark diligence**: The IP-cleanliness check (FR-008) is a human review step at selection time; no automated screening is assumed.
- **Runtime window icon**: On platforms where the window server takes the icon from the executable/bundle automatically, no additional runtime wiring is needed; where explicit configuration is convention (Linux taskbars), the existing desktop-entry mechanism carries it once fed the new asset.
- **Desktop-entry scope**: This feature feeds the existing desktop-entry mechanism its asset without changing what it installs (a single 256×256 hicolor PNG); extending the mechanism to install a multi-size ladder would touch spec 035's contract and is out of scope.
