# Feature Specification: Sharp Windows Application Icon

**Feature Branch**: `spec-049-windows-icon-sharpness`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "The ico file seems to be pixelated on windows."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The icon looks crisp on every Windows surface (Priority: P1)

A user on Windows sees the application's logo rendered sharply, not pixelated or mushy, everywhere it appears: title bar, taskbar (including scaled displays), Alt-Tab switcher, Start menu, desktop shortcut, Explorer listings, and the installer. At common display scales (100%, 125%, 150%, 200%) no surface shows an icon that was visibly stretched from a smaller image.

**Why this priority**: The pixelated icon is the entire complaint.

**Independent Test**: Install the packaged app on a Windows machine at each common DPI scale and inspect each listed surface; compare against the master artwork rendered at the same size. No surface should look upscaled or blocky relative to that reference.

**Acceptance Scenarios**:

1. **Given** the installed application at 100% scale, **When** the title bar, taskbar, Alt-Tab, Start menu, desktop shortcut, and Explorer icons are inspected, **Then** each renders sharply with no visible upscaling artefacts.
2. **Given** display scales of 125%, 150%, and 200%, **When** the same surfaces are inspected, **Then** each requests and receives an appropriately sized image; none displays a smaller frame stretched to fit.
3. **Given** the installer itself, **When** viewed in Explorer or during installation prompts, **Then** its icon matches the application's sharp rendering.
4. **Given** a portable/zip deployment of the same build, **When** the executable's icon is inspected in Explorer, **Then** it is equally sharp.

---

### User Story 2 - Derivation stays principled and reproducible (Priority: P2)

The icon set continues to derive from the single committed raster master by one uniform procedure: no per-size hand retouching, regeneration reproducible from a documented command, and structural tests asserting the required coverage so the sharpness fix cannot silently regress. macOS and Linux outputs remain governed by their existing rules.

**Why this priority**: Spec 043 established master-based derivation as a deliberate constraint; the fix must not reintroduce ad-hoc assets or untested binaries.

**Independent Test**: Run the documented generation command, confirm the structural tests pass against the regenerated files on a clean checkout, and confirm macOS/Linux artifacts keep their required size coverage.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** the icon generation command runs, **Then** all derived icon resources regenerate deterministically in structure (sizes, frame counts) and the structural test suite passes.
2. **Given** the regenerated Windows icon resource, **When** its embedded frames are enumerated, **Then** they cover every required standard size from 16 through 256 inclusive, including intermediate sizes commonly requested at fractional display scales.
3. **Given** the macOS and Linux icon artifacts after regeneration, **When** inspected, **Then** their size coverage matches today's requirements (no removals).

---

### Edge Cases

- Shell surfaces requesting sizes between ladder points: served by downscaling the nearest larger frame rather than upscaling a smaller one.
- Very high scale factors beyond 200%: the largest available frame serves without exceeding it; residual softness at extreme sizes is acceptable provided no upscale-from-small occurs.
- Windows icon caching after an upgrade: verification includes reinstall/cache-clear steps so a stale cached image is not mistaken for a defect (or a fix missed).
- Development (unpackaged) runs: the development window icon follows the same multi-size principle where the platform honours it.
- Non-square display scaling quirks on remote desktops: no crash or missing-icon state; worst case falls back to nearest-frame behaviour above.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every Windows shell surface MUST be served an icon image at least as large as the size it requests; displaying a smaller embedded frame stretched upward to meet the request MUST be eliminated for all standard request sizes up to 256.
- **FR-002**: The Windows icon resource embedded in the executable MUST contain frames covering at least these sizes: 16, 20, 24, 32, 40, 48, 64, 96, 128, and 256 pixels.
- **FR-003**: On Windows, the running application MUST supply its window/taskbar imagery from the multi-size icon resource so each surface obtains an appropriately sized image, replacing any use of a single large bitmap scaled per surface.
- **FR-004**: All frames MUST derive from the committed raster master via one uniform resampling procedure applied identically to every size; hand-retouching individual sizes MUST NOT be introduced.
- **FR-005**: Regeneration MUST remain possible from a documented command committed to the repository, and structural tests MUST assert the FR-002 frame coverage so regressions fail the build.
- **FR-006**: macOS and Linux icon artifacts MUST retain their current size coverage after this change; shared generator changes MUST NOT reduce their outputs' fidelity or coverage.
- **FR-007**: The provenance documentation MUST be updated to describe the new frame set and any generator changes.

### Key Entities *(include if feature involves data)*

- **Icon resource frames**: The individually sized images packed into the Windows icon container; the fix's subject.
- **Raster master**: The committed source artwork from which every frame derives (established by spec 043).
- **Size ladder**: The enumeration of sizes a platform's artifacts must cover; extended for Windows by FR-002.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a manual matrix across 100%/125%/150%/200% scales on Windows 10 and 11, zero surfaces show upscaling-induced pixelation attributable to missing frames (documented screenshot comparison per cell).
- **SC-002**: Automated structural tests enumerate the embedded frames and pass only when the FR-002 ladder is complete, byte-consistent with the generated ladder images.
- **SC-003**: macOS (.icns chunks) and Linux (ladder directory) coverage checks pass unchanged after regeneration.
- **SC-004**: A clean-checkout regeneration reproduces structurally identical resources (same frame list), proving reproducibility.

## Clarifications

### 2026-08-24 (during specification)

- **Root cause framing**: "the ico file seems pixelated" is treated as a sizing/coverage problem (surfaces receiving too-small frames and stretching them, plus a runtime window icon supplied as a single oversized bitmap), not as artwork replacement. Artwork quality itself is out of scope.

## Assumptions

- **Artwork adequacy**: the committed raster master is sharp enough at target sizes; the defect is in derivation/serving, not art.
- **Residual tiny-size softness**: some softness at 16 px from raster downsampling may persist; acceptable if no surface upscales from a smaller frame than requested.
- **Windows icon cache**: users upgrading in place may see stale cached imagery until cache refresh; installation notes need not change, but verification accounts for it.
