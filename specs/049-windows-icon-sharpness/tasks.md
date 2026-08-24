# Tasks: Sharp Windows Application Icon

**Branch**: `spec-049-windows-icon-sharpness`

**Spec**: `specs/049-windows-icon-sharpness/spec.md`

## 1. Frame ladder

- [ ] 1.1 Extend `scripts/generate-icons.ps1`: `$LadderSizes` and `$IcoSizes` both gain 20, 40, and 96, covering 16, 20, 24, 32, 40, 48, 64, 96, 128, 256 (ladder keeps 512; icns chunk list untouched) (FR-002, FR-006, research D1)
- [ ] 1.2 Run the generator and commit the regenerated set: `resources/icons/{16,20,24,32,40,48,64,96,128,256,512}.png`, `resources/icon.png`, `resources/icon.ico` (10 frames), `resources/icon.icns` (FR-004)

## 2. Runtime serving

- [ ] 2.1 Add `resources/icon.ico` to `electron-builder.yml` extraResources under the win block so packaged Windows builds carry it (FR-003, research R5)
- [ ] 2.2 Change `src/main/windowIcon.ts`: on win32 return the .ico in both packaged (`<resourcesPath>/icon.ico`) and dev modes; darwin stays undefined; linux keeps the PNG (FR-003)

## 3. Tests

- [ ] 3.1 Update `tests/main/iconAssets.test.ts`: ten-frame ICO with the exact FR-002 ladder enumerated as a build gate; ladder list gains 20/40/96; payload byte-identity invariant kept intact (FR-002, FR-005, SC-002)
- [ ] 3.2 Update `tests/main/windowIcon.test.ts`: win32 expectations point at icon.ico in packaged and dev modes; linux PNG coverage retained; darwin undefined retained

## 4. Documentation

- [ ] 4.1 Update `docs/icon-provenance.md`: extended frame ladder, why the intermediates exist (fractional-DPI shell requests), resampling procedure unchanged (FR-007, research D3)

## 5. Verification

- [ ] 5.1 Run `npm run lint`, `npm run typecheck`, `npm run test`; all green
- [ ] 5.2 Record that the SC-001 manual DPI visual matrix (100%/125%/150%/200% on real Windows shells) remains a manual verification item for the PR description; it cannot be automated
- [ ] 5.3 Confirm macOS (.icns chunk layout) and Linux (ladder superset) coverage unchanged from test output (FR-006, SC-003)

## 6. Finalisation

- [ ] 6.1 Archive the spec to `specs/archive/049-windows-icon-sharpness/` with Status: Archived as part of the implementation PR
