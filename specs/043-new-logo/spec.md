# Feature Specification: New Product Logo

**Feature Branch**: `043-new-logo`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Take the logo file new-logo.png (provided by the maintainer) and change the logo to this new logo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every icon surface shows the new logo (Priority: P1)

The maintainer has produced a new product logo and supplied it as a finished image file, `new-logo.png`. Today every installation shows the previous product mark. After this feature, every surface where an operating system or the project itself displays the product icon shows the new logo instead: running window and taskbar/Dock, Start menu and launcher entries, installed-programs listings, installer and uninstaller UI, file-association entries, and the project website. No surface anywhere still shows the previous mark.

**Why this priority**: A logo swap that leaves the old mark on any shipped surface is only half done; full replacement is the feature.

**Independent Test**: Install the application fresh on each platform and inspect every icon-bearing surface (taskbar/Dock while running, Start menu/launcher entry, installed-programs list, installer UI, file-manager "Open with" entries), then view the project website; confirm every surface shows the new logo and none shows the previous mark.

**Acceptance Scenarios**:

1. **Given** a fresh install on Windows, **When** the application runs and the taskbar, Start menu entry, installed-programs list, and installer screens are inspected, **Then** each shows the new logo and none shows the previous mark.
2. **Given** a fresh install on macOS, **When** the Dock and Applications folder are inspected while the application runs and while it is closed, **Then** both show the new logo.
3. **Given** a fresh install on Linux via the distributed AppImage, **When** the desktop entry is created and the application launches, **Then** the launcher/menu entry and the running taskbar item show the new logo.
4. **Given** the project website, **When** the page is loaded, **Then** the product icon displayed is the new logo.

---

### User Story 2 - One master artwork, every derived asset regenerated from it (Priority: P1)

The provided image becomes the single master artwork committed to the repository, and every platform-specific icon file is re-derived from it: the Windows multi-resolution icon, the macOS bundled icon, the Linux PNG ladder, the runtime window icon, and the website icon. No platform receives an upscaled, cropped, or hand-retouched approximation of the new logo; every derived asset traces back to the one master, and regenerating the set from the master alone reproduces it.

**Why this priority**: The derivation chain is what prevents platform drift: if any format is produced by a different route, the platforms silently diverge and the old artwork survives in whichever file was missed.

**Independent Test**: Open the committed master and each derived asset; confirm each required size exists and is a faithful downsample of the new artwork (sharp at its native size, no upscaling, no cropping), and that re-running the derivation from the committed master reproduces the set.

**Acceptance Scenarios**:

1. **Given** the repository contents, **When** the master artwork is inspected, **Then** it is the provided new-logo.png artwork: lossless, square, at least 1024×1024 pixels, with transparency.
2. **Given** the Windows asset, **When** its contained sizes are listed, **Then** they include 256×256 down through 16×16, each a crisp rendering of the new logo.
3. **Given** the Linux asset set, **When** the desktop-entry installation runs (the existing mechanism), **Then** it finds the 256×256 PNG it consumes and installs the new logo with unchanged behaviour.
4. **Given** any derived asset on any platform, **When** compared side by side with the master, **Then** it is recognisably the same new design with no recolouring, cropping, or proportion drift.
5. **Given** the previous artwork's derived files, **When** the repository is inspected after the change, **Then** no committed derived asset still contains the previous mark; the old artwork survives only in version history.

---

### User Story 3 - Provenance records the adoption (Priority: P2)

The repository's icon provenance record is updated to describe the new artwork and how it was adopted: supplied by the maintainer as `new-logo.png`, selected by the maintainer, committed as the master. The prior record (which described the old mark and deferred an AI-generation session) is replaced, so a future reader can tell where the artwork came from and how to regenerate everything from it.

**Why this priority**: Provenance keeps the derivation chain maintainable but is not user-visible; the shipped contract stands without it.

**Independent Test**: Read the provenance record; confirm it describes the new artwork, states its origin (maintainer-supplied `new-logo.png`), and documents the regeneration procedure that reproduces every derived asset from it.

**Acceptance Scenarios**:

1. **Given** the provenance documentation, **When** a maintainer reads it, **Then** it describes the new artwork and records that it was supplied and selected by the maintainer, with no reference to the retired artwork as current.
2. **Given** the regeneration procedure in that record, **When** it is followed from a clean checkout, **Then** it reproduces every derived asset from the committed master with no undocumented manual steps.

---

### Edge Cases

- Small sizes: the new logo carries a border ring around the tile as well as the "M" monogram; the smallest ladder entries (16×16, 24×24) are hand-checked so the mark stays recognisable rather than collapsing into an unreadable blob.
- The master's native size (1254×1254) is not one of the derived sizes and is larger than the macOS large-chunk size: derived assets are always downsamples of the master, never upscales, and the large macOS chunk receives a true downsample at its nominal size rather than an off-size embedding.
- Transparency: the artwork is verified on light and dark backgrounds in every derived format so a converter cannot introduce black boxes or halos.
- Regeneration after a future artwork tweak: the derivation is repeatable from the committed master alone, so a future change never leaves one platform's files stale.
- The old artwork: retired entirely from the shipped set; no in-app, installer, or website surface retains it. Version history remains the only archive of the previous mark.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The provided `new-logo.png` artwork MUST become the repository's single master artwork: lossless format, square, at least 1024×1024 pixels, with transparency, serving as the sole source for every derived icon asset. The master is committed as provided (native resolution), not resized to fit a legacy dimension.
- **FR-002**: Every derived platform asset MUST be regenerated from the new master: a Windows multi-resolution icon covering at least 256×256, 128, 64, 48, 32, 24, and 16 pixels; a macOS bundled icon covering at least 128 through 1024; and a Linux PNG ladder that includes at least 256×256 (the size the existing desktop-entry mechanism installs) and extends to at least 512×512.
- **FR-003**: Every packaged artefact on every distribution channel the product ships today (Windows installer, portable archives, Scoop manifest assets, macOS disk images, Linux AppImage) MUST embed the new logo so all operating-system icon surfaces show it. The existing file-association and folder-action registrations continue to present the icon through the executable's embedded icon with no registration change.
- **FR-004**: Derived assets MUST be reproducible from the committed master alone via the committed derivation tooling; a regeneration run MUST refresh every platform's assets together so no platform drifts, and no derived asset MAY be hand-edited.
- **FR-005**: The previous artwork MUST be fully retired: after this change no committed derived asset, and no project-owned surface (application, installer, website), still displays the previous mark.
- **FR-006**: The project website's product icon MUST be refreshed from the new master (it consumes the same derived asset set per the prior icon specification).
- **FR-007**: The icon provenance record MUST be updated to describe the new artwork, record its origin (supplied by the maintainer as `new-logo.png` and selected by the maintainer), and document the regeneration procedure; the prior artwork's provenance section is replaced.
- **FR-008**: The committed assets MUST NOT reproduce identifiable third-party logos or protected imagery beyond the maintainer-supplied artwork itself.

## Key Entities *(include if feature involves data)*

- **Master artwork**: The committed `new-logo.png` image, now the canonical definition of the product mark and the sole source every platform icon derives from.
- **Derived platform assets**: The per-format files (Windows multi-resolution icon, macOS bundle icon, Linux PNG ladder, runtime window icon, website icon) regenerated from the master; never edited independently.
- **Icon surfaces**: The operating-system and project locations where the icon is displayed (taskbar/Dock, launcher, installed-programs, installer, file-association entries, website); the completeness checklist for coverage.
- **Provenance record**: The committed documentation describing the artwork, its origin, and the regeneration procedure.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of fresh-install inspections across Windows, macOS, and Linux, every checked icon surface shows the new logo and zero surfaces retain the previous mark or the default framework icon.
- **SC-002**: In 100% of size-ladder inspections, each derived resolution renders sharp at its native size with no upscaling artifacts.
- **SC-003**: The 16×16 rendering remains recognisable as the new mark when hand-checked at taskbar size.
- **SC-004**: In 100% of side-by-side comparisons, every platform's icon is visually identical in design (colour, geometry, proportions) with only platform-convention treatment differing.
- **SC-005**: Re-running the committed derivation from the committed master reproduces functionally equivalent assets (a reviewer cannot distinguish a regenerated set from the committed one in blind comparison).
- **SC-006**: In 100% of contrast checks against light and dark backgrounds, the new logo remains clearly visible in every derived format.

## Clarifications

### 2026-08-24 (during specification)

- **Artwork source (user direction)**: The logo is replaced with the maintainer-provided file `new-logo.png`, referenced by file name only; the maintainer has already selected the artwork, so no generation or candidate-selection step is in scope. This supersedes the prior specification's AI-generation route (which had been deferred by maintainer authorisation) and its FR-005.
- **Scope**: "The logo" means the product icon everywhere it appears: application/platform icon surfaces, installer, file associations, and the project website icon. No separate wordmark, in-app branding imagery, or broader brand refresh is in scope.

## Assumptions

- **Artwork approval**: The provided artwork is final and maintainer-approved; no art iteration or candidate review happens in this feature.
- **Master dimensions**: The provided image is 1254×1254 with alpha, satisfying the "square, lossless, at least 1024×1024, transparency" master contract at its native size; all derived sizes are downsamples from it.
- **IP cleanliness**: The maintainer vouches for the supplied artwork's originality; the third-party-imagery review is the maintainer's selection step, not an automated check.
- **Mechanism reuse**: All existing icon consumers (packaging configuration, runtime window icon, Linux desktop-entry mechanism, website asset copy) keep their current wiring; only the artwork and its derivation change.
