# Feature Specification: Windows Store Tile Assets

**Feature Branch**: `spec-067-windows-store-tile-assets`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "I got this rejection from microsoft partner center: The available product tile icons include a default image. Tile icons must uniquely represent product so users associate icons with the appropriate products and do not confuse one product for another." This is a defect in the Windows Store channel delivered by spec 062: the submitted package ships generic placeholder tile images instead of the product artwork, and the Store listing logos were not sourced from the project's branded set.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The Store listing shows the MarkdownMeister tile, not a placeholder (Priority: P1)

A user browsing the Microsoft Store sees MarkdownMeister's own tile icon in the listing: the navy rounded tile carrying the cream "M" monogram. It is distinctive, so the user associates the store entry with this product rather than confusing it with any other app that still carries a stock Store image.

**Why this priority**: The rejection is specifically about the product tile icon being a default image. Until the listing presents the branded tile, certification fails and there is no Store channel at all.

**Independent Test**: Open the product's listing in the Store (or the certification report's captured listing imagery) and confirm every tile the listing presents is the product artwork, with no Microsoft-generated default image anywhere.

**Acceptance Scenarios**:

1. **Given** the published or in-certification Store listing, **When** its tile icons are viewed, **Then** each shows the MarkdownMeister mark and none shows a default or generic image.
2. **Given** the listing's small tile surface, **When** it is viewed at its smallest size, **Then** the mark is still recognisable and not a featureless blur.
3. **Given** the listing's medium and large square tile surfaces, **When** they are viewed, **Then** each shows a crisp render of the mark with no stretching from a smaller source.

---

### User Story 2 - The installed app presents the branded tile on Windows (Priority: P1)

After installing from the Store, the app's Start menu entry and any tile it pins show the MarkdownMeister mark, including the wide tile shape, exactly as the other distribution channels already do through their own icon.

**Why this priority**: The rejection names the package's tile assets. A package that shows a branded tile in the listing but a placeholder in the Start menu has not fixed the defect; the installed surface is what the user associates with the product day to day.

**Independent Test**: Install the package on Windows, inspect the Start menu entry and pin both the medium and wide tiles, and confirm each shows the mark and none shows a default image.

**Acceptance Scenarios**:

1. **Given** the package is installed, **When** the Start menu entry and the small and medium tiles are viewed, **Then** each shows the mark.
2. **Given** the app is pinned, **When** the wide tile is viewed, **Then** it shows the mark centred on the tile background, without distortion.
3. **Given** any tile surface the package declares, **When** it is inspected, **Then** none resolves to a placeholder or a stock Microsoft image.

---

### User Story 3 - Every tile asset traces to the one master artwork (Priority: P2)

A maintainer can regenerate the entire tile set from the single committed master artwork, so the tile assets can never silently drift from the product icon used on every other platform, and a future logo change updates them in one step.

**Why this priority**: The defect arose because the tile set was never derived from the master at all; making the tile set part of the existing derivation chain is what prevents the same defect recurring after the next logo change.

**Independent Test**: Delete the committed tile assets, regenerate from the master, and confirm the regenerated set reproduces the same sizes and formats with no tile left as a default.

**Acceptance Scenarios**:

1. **Given** the master artwork and the derivation procedure, **When** the tile assets are regenerated, **Then** every declared tile size is produced and each is a faithful render of the master.
2. **Given** the derivation procedure, **When** it runs, **Then** it derives the non-square wide tile from the master by centring the mark rather than stretching it.
3. **Given** the provenance record, **When** it is read, **Then** it lists the tile assets among the outputs derived from the master, with the consumers named.

---

### Edge Cases

- The master artwork is missing or does not meet the committed contract: generation fails rather than fabricating a tile from a placeholder.
- A tile size the package declares is left unsupplied: the package must not fall back to a generic Microsoft image; every declared tile size must be present.
- The non-square wide tile is produced by stretching the square master: distortion is a defect; the accept criterion is a centred, undistorted mark.
- A tile size is requested at a display scale between two provided sizes: the smallest supplied size that is at least as large as the request must exist so the shell does not upscale a smaller image.
- Partner Center is updated with new packaging while the listing logos were never uploaded: both surfaces must be branded, because a branded package with a default listing tile still fails the same way.
- The master artwork changes: regenerating updates every tile surface at once and no surface retains the previous mark.
- The tile background colour is changed: the mark must remain clearly visible against it in both light and dark system chrome.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every tile and logo image the Windows Store package declares MUST show the product artwork. No tile surface the package declares may resolve to a default, placeholder, or generic image.
- **FR-002**: The Store listing's product tile icons MUST be supplied from the project's branded tile set, not left to a Store-generated default.
- **FR-003**: The package MUST provide a branded image for every tile and logo size it declares, including the small square, medium square, package logo, and the non-square wide tile.
- **FR-004**: The non-square wide tile MUST be composed by centring the square mark on a transparent canvas with safe padding, preserving the mark's aspect ratio; the mark MUST NOT be stretched or cropped.
- **FR-005**: Every tile asset MUST be derived from the single committed master artwork by the existing derivation procedure, so regenerating from the master reproduces the tile set. No tile asset may be a hand-edited or independently sourced image.
- **FR-006**: The derivation procedure MUST emit the tile assets as part of its output set and MUST NOT write the master itself.
- **FR-007**: The package's tile background colour MUST be chosen so the centred mark remains clearly visible, and the same mark MUST keep contrast on both light and dark system surfaces.
- **FR-008**: The provenance record MUST list the tile assets among the outputs derived from the master, name the surfaces that consume them, and document how to regenerate them.
- **FR-009**: A certification submission MUST be rejectable in advance for the tile defect: before submitting, the maintainer can inspect the packaged tile set and the listing tile set and confirm neither contains a default image.
- **FR-010**: This feature MUST NOT change the other distribution channels' icons, the Windows package's identity, capabilities, shell integration, or file-association scope.

### Key Entities *(include if feature involves data)*

- **Master artwork**: The single committed product mark every icon asset is derived from.
- **Package tile set**: The images the Windows package declares for its small square, medium square, package logo, and wide tile surfaces.
- **Store listing tile set**: The product tile logos supplied to the Store for the public listing.
- **Wide tile**: The non-square tile surface, whose image is the mark centred rather than stretched.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tile surfaces presented in the Store listing and by the installed package, the product mark is shown and zero surfaces show a default or generic image.
- **SC-002**: A certification submission whose tile set is derived from the master contains no default tile image in either the package or the listing, confirmed by inspection before submission.
- **SC-003**: Regenerating from the master reproduces every declared tile size, with the wide tile an undistorted centred mark, in 100% of runs.
- **SC-004**: The smallest supplied tile size remains recognisable as the product mark rather than an unreadable blur.
- **SC-005**: Existing distribution channels' icons and the Windows package's behaviour are unchanged in 100% of regression checks.

## Assumptions

- **The artwork exists**: The master artwork adopted by spec 043 is the canonical product mark; this feature produces no new design and creates no new logo.
- **The wide tile is centred, not stretched**: The maintainer chose a centred mark on a transparent canvas for the non-square tile, so the wide tile is a composition of the square mark rather than a wide redraw. The existing promotional listing art (hero, poster, box art) is out of scope and unchanged.
- **The derivation procedure is extended, not replaced**: The existing single-master derivation (spec 043/049) is the vehicle for the tile assets, so the tile set inherits its one-master rule and its documented regeneration step.
- **Package identity and behaviour are untouched**: This is an asset-level fix to the Windows Store channel from spec 062; identity, capabilities, shell extension, folder action, and file-association scope do not change.
- **Certification is the final verifier**: No automated test can exercise the real Store listing; the automated tests assert that the package references branded assets and that regeneration is faithful, while the maintainer confirms the real listing before submission and the rejection is closed by a re-submission.

## Clarifications

### 2026-10-02 (during specification)

- **Root cause recorded**: The Windows Store package built for spec 062 declares tile images but the packaging supplies no branded tile assets, so the packager substitutes its own generic sample images. `docs/store-listing.md` had recorded this as an acceptable follow-up and was wrong; this feature closes it. Separately, the branded listing tile set committed to the repository was not being sourced into the Store listing.
- **Wide tile composition decided**: The non-square wide tile is the square mark centred on a transparent canvas with safe padding (maintainer decision), not a stretched redraw. The package's tile background colour is set to the mark's navy so the centred mark composites as one brand-coloured tile.
- **Scope boundary**: Only the Windows Store tile surfaces are in scope. The promotional listing images already committed are not regenerated, and no other platform's icons change.
