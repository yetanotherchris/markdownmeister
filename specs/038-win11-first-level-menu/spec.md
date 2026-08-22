# Feature Specification: First-Level Folder Context Menu on Windows 11

**Feature Branch**: `038-win11-first-level-menu`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "currently the 'open in markdownmeister' for a folder only appears for 'show more options' context menu in windows 11. I want it to be in the initial context menu items"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The folder action appears in the first-level context menu (Priority: P1)

A user who installed MarkdownMeister from the Microsoft Store right-clicks a folder in Windows 11's File Explorer and sees "Open in MarkdownMeister" directly in the menu that first appears — the same level as the system's own "Open in Terminal" action — with no need to open "Show more options". The entry carries the product name and icon and behaves as a first-class citizen of the modern menu.

**Why this priority**: This is the entire request: the action is functionally present today but effectively invisible behind an extra step most users never learn.

**Independent Test**: Install the Microsoft Store build on Windows 11, right-click any folder, and confirm the product-named action is present in the initially shown context menu and opens that folder as the workspace.

**Acceptance Scenarios**:

1. **Given** a Microsoft Store installation on Windows 11, **When** the user right-clicks a folder, **Then** "Open in MarkdownMeister" appears in the initially displayed context menu without invoking "Show more options".
2. **Given** the first-level entry is visible, **When** the user inspects it, **Then** it bears the product display name and the application icon at the same visual standing as built-in entries such as "Open in Terminal".
3. **Given** the application is not running, **When** the user invokes the first-level entry, **Then** the application launches directly with that folder opened as the workspace.
4. **Given** the application is already running with a different workspace, **When** the user invokes the first-level entry, **Then** the existing workspace-open behaviour applies unchanged, including the confirmation prompt before unsaved changes are discarded.

---

### User Story 2 - Invoking it feels identical to the existing folder action (Priority: P1)

The first-level entry is not a second feature: it hands the chosen folder to exactly the same open-a-workspace path the classic-menu entry uses. Single-instance routing, untrusted-path validation, confirmation before discarding unsaved work — all identical. A user who switches between the two placements cannot tell any difference in behaviour.

**Why this priority**: A new entry point that bypassed or duplicated the existing safeguards would create two divergent behaviours for one action — a correctness risk, not just inconsistency.

**Independent Test**: Invoke the folder-open action from both the first-level menu and the classic menu against the same scenarios (app closed, app running with other workspace, app running with dirty tabs, adversarial folder paths) and confirm outcomes match in every case.

**Acceptance Scenarios**:

1. **Given** the same folder handed over by either placement, **When** the hand-off is processed, **Then** both produce identical results: same workspace state, same single-instance routing, same confirmations.
2. **Given** a folder path supplied by the operating system, **When** it reaches the application through the new entry point, **Then** it is treated as untrusted and validated exactly as every other externally supplied path, failing closed without exposing unrelated filesystem locations.
3. **Given** the invoked folder was deleted or became unavailable between showing the menu and invoking it, **When** the hand-off occurs, **Then** the application reports a clear in-context error and leaves the current session unchanged.

---

### User Story 3 - Every other channel keeps working exactly as today (Priority: P2)

Users who install through the Windows installer, portable zip, or Scoop see no change and no regression: their registry-based classic-menu entry (including its position under "Show more options" on Windows 11) continues to exist and function. Nothing about this feature removes, alters, or destabilises what those channels ship.

**Why this priority**: The Store channel is additive; breaking the channels most current users rely on would trade one problem for another.

**Independent Test**: On a machine with the installer (or Scoop) build only, verify the classic folder entry still works on Windows 11; then install the Store build alongside and verify both entries coexist and each works.

**Acceptance Scenarios**:

1. **Given** an NSIS-installer, zip, or Scoop installation on Windows 11, **When** the user right-clicks a folder, **Then** the classic "Open in MarkdownMeister" entry remains available (via "Show more options", per spec 035) and functions.
2. **Given** both a Store installation and a classic-channel installation on one machine, **When** the user right-clicks a folder, **Then** both placements work independently and neither interferes with the other.
3. **Given** a machine where only the Store build is installed, **When** the user consults the registry-based registration, **Then** nothing from the installer/Scoop scripts is present — each channel registers only itself.
4. **Given** Store and installer builds installed side by side on Windows 11, **When** the user opens "Show more options", **Then** any identically labelled classic entries coexist, each works independently, and uninstalling either build removes exactly its own.

---

### User Story 4 - Install, update, and uninstall leave no trace behind (Priority: P1)

Installing the Store build adds the first-level entry; updating through the Store keeps it present and pointing at the currently installed version; uninstalling the Store build removes it completely — no dead entries anywhere in Explorer, and other applications' entries untouched. This extends spec 035's uninstall guarantees to the new channel.

**Why this priority**: Leftover context-menu entries pointing at uninstalled software are broken UI in the operating system itself; spec 035 made "no traces" a hard rule and this channel must meet the same bar.

**Independent Test**: Install the Store build, confirm the first-level entry; update through the Store, confirm it still works; uninstall, then verify the entry is gone everywhere while unrelated applications' context menus are unaffected.

**Acceptance Scenarios**:

1. **Given** a fresh Store install, **When** the installation completes, **Then** the first-level folder entry is present and functional.
2. **Given** a Store update to a newer version, **When** the user right-clicks a folder afterwards, **Then** the first-level entry remains present and launches the updated version.
3. **Given** the Store build is uninstalled, **When** the user right-clicks folders afterwards, **Then** no MarkdownMeister first-level entry remains anywhere, including after restarting Explorer.
4. **Given** any Store install/update/uninstall cycle, **When** other applications' modern-menu and classic-menu entries are inspected, **Then** they are unchanged and functional.

---

### User Story 5 - The shell extension can never take Explorer down (Priority: P1)

The component that powers the first-level entry runs inside Explorer's process. If anything goes wrong — the application directory moved, a corrupted update, an unexpected fault — the failure must stay contained: Explorer keeps running, other applications' menu entries keep working, and the MarkdownMeister entry degrades gracefully rather than dragging the shell down.

**Why this priority**: An unstable shell extension is worse than no feature: it makes the whole desktop feel broken and is the classic reason developers fear writing them. Containment is a launch-blocking requirement for shipping one at all.

**Independent Test**: Simulate failure modes (component removed after registration, corrupted load, exception during menu query) and confirm Explorer survives each with other context menus intact and the failed entry simply absent or inert.

**Acceptance Scenarios**:

1. **Given** any fault raised inside the shell-extension component during enumeration or invocation, **When** Explorer processes the folder context menu, **Then** Explorer does not crash or hang and unrelated entries render normally.
2. **Given** the component's files were removed or corrupted while its registration persists, **When** the user right-clicks a folder, **Then** the entry is absent or inert and Explorer recovers without user intervention beyond a restart of Explorer at worst.
3. **Given** the component loads successfully, **When** the user does NOT interact with MarkdownMeister entries at all, **Then** there is no measurable ongoing activity attributable to it — presence in the menu costs nothing until used.

---

### Edge Cases

- Windows versions without the modern context menu (Windows 10): a Store installation still provides a working route to open folders — the classic mechanism — so no platform silently loses the capability entirely.
- Modern-menu registration fails on a given machine (policy, identity issues): the experience degrades to the best available alternative rather than leaving the application unopenable-by-folder; failures are quiet, never blocking errors.
- Multiple folders selected: consistent with spec 035 FR-013, multi-selection is out of scope; the action is offered only when the platform lets the user act on one folder unambiguously.
- Right-clicking empty space inside a folder: out of scope, matching spec 035.
- The Store listing is unavailable in a market or withdrawn later: machines with it installed keep working; new installs fall back to the existing distribution channels documented on the project page.
- Folder names with spaces, Unicode, reserved device names, or maximum-length paths: handed off verbatim and validated like any external path.
- The user has pinned the application or launched it normally: the shell extension plays no role outside folder hand-off; normal launches are unaffected.
- OneDrive/cloud placeholder folders and virtualised locations: the action either works correctly or reports clearly; it must not hang Explorer while the cloud materialises content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST gain a Microsoft Store distribution packaged as an MSIX package whose signature is provided by the Store itself, so installations carry trusted package identity without any developer-purchased certificate.
- **FR-002**: The Store package MUST include a native shell-extension component implementing Windows 11's modern folder-command interface, registered through the package's identity, presenting the folder action under the product display name.
- **FR-003**: On Windows 11, for Store installations, the folder action MUST appear in the FIRST-LEVEL folder context menu (the menu initially shown), equivalent in placement to the operating system's own "Open in Terminal"; reaching it MUST NOT require "Show more options".
- **FR-004**: Invoking the first-level entry MUST route the chosen folder through the application's existing workspace-open behaviour with all existing safeguards — untrusted-path validation, single-instance routing, and confirmation before unsaved changes are discarded — identical to the classic entry defined by spec 035.
- **FR-005**: The first-level entry MUST work when the application is closed (cold launch into the folder) and when it is already running (routing to the running instance), matching spec 035's FR-003/FR-004 semantics.
- **FR-006**: The entry label MUST derive from the single product display name ("Open in MarkdownMeister") and carry the application icon, consistent with spec 035 FR-011; no differently spelled variants may exist anywhere.
- **FR-007**: Non-Store channels (NSIS installer, portable zip, Scoop) MUST continue to register the classic-menu entry per specs 006/035, completely unchanged; these channels MUST NOT receive the native shell-extension component or any new registration.
- **FR-008**: When more than one distribution channel is installed on one machine, each channel's entries MUST work independently, and removing one channel MUST remove only that channel's registrations. Where both channels register identically labelled classic entries (the Store build on a system without the modern menu alongside an installer install), both entries may coexist under the classic menu; each MUST work, and neither may break the other.
- **FR-009**: Uninstalling the Store build MUST remove the first-level entry completely, leaving no dead entries in any Explorer view, and MUST NOT affect other applications' entries — the same standard spec 035 FR-008/FR-009 set for the classic channels.
- **FR-010**: Updates delivered through the Store MUST leave the first-level entry present, correctly labelled, and launching the updated version.
- **FR-011**: Failures of the shell-extension component MUST be contained: a faulting, missing, or corrupted component MUST NEVER crash, hang, or degrade Explorer or any other application's context-menu entries; the worst permitted outcome is the MarkdownMeister entry being absent until repair or reinstall.
- **FR-012**: The shell-extension component MUST do nothing beyond handing the chosen folder to the application: no filesystem browsing, no reading of folder contents, and no persistence of observed paths. All path validation remains inside the trusted application process, preserving Principle II.
- **FR-013**: On Windows versions or configurations where the modern first-level menu is unavailable, a Store installation MUST still offer folder opening through the classic mechanism so the capability exists on every platform the channel supports. That mechanism is the same registry-based registration used by the installer channels (specs 006/035): the Store package MUST register its own classic verb where needed, without touching registrations owned by other channels.

### Key Entities *(include if feature involves data)*

- **Store package**: The MSIX-distributed build carrying trusted package identity obtained from Microsoft's own signing; the only artefact through which the modern-menu integration ships.
- **Shell-extension component**: The native in-process module Explorer loads to present the first-level entry; strictly a hand-off relay between the shell and the application.
- **First-level folder action**: The modern-menu presentation of "Open in MarkdownMeister" for folders, distinct from — but behaviourally identical to — the classic registry verb.
- **Channel isolation**: The principle that each distribution channel owns exactly its own registrations and cleanup, with no cross-channel interference.
- **Hand-off payload**: The folder path transferred from shell to application; untrusted until validated by the application like any externally supplied path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tests on up-to-date Windows 11 systems, a Store installation presents "Open in MarkdownMeister" in the initially shown folder context menu — zero tests require "Show more options".
- **SC-002**: In 100% of behavioural-parity tests across cold start, running instance, dirty-tab, and adversarial-path scenarios, the first-level entry and the classic entry produce identical outcomes.
- **SC-003**: In 100% of regression tests, the installer, zip, and Scoop channels produce registration artifacts unchanged byte-for-byte from immediately before this feature.
- **SC-004**: In 100% of uninstall tests, no MarkdownMeister first-level entry remains after Store removal (verified after an Explorer restart), and other applications' entries are unaffected.
- **SC-005**: Across all injected-fault tests (missing files, corrupted component, exceptions during query/invocation), Explorer exhibits zero crashes or hangs attributable to the component.
- **SC-006**: In 100% of Store-update tests, the entry survives the update and launches the post-update version.

## Clarifications

### 2026-08-22 (during specification)

- **Route decision**: Three routes were evaluated — full signed-native (amend spec 005, buy Azure Artifact Signing ~$9.99/month, US/Canada individuals only), Store-only, and document-and-defer. **Store MSIX selected**: individual developer accounts are now free (fee waived, September 2025) and the Store re-signs submitted packages for free, yielding trusted package identity — the prerequisite for first-level placement — at zero cost.
- **Spec 005 untouched**: Direct-download channels remain unsigned; this feature adds a signed *channel* rather than amending the no-signing decision. SmartScreen reputation for the existing channels is unchanged.
- **The native component is unavoidable**: every route to the first-level menu runs a shell-extension component inside Explorer; signing solves trust/identity only. Its containment requirements are therefore first-class (US5, FR-011).
- **Scope**: The folder action only. File (.md/.markdown) actions stay classic-menu-only (spec 006); promoting them can be a follow-up if wanted.

## Assumptions

- **Certification gate**: Store submissions undergo Microsoft certification; release cadence for the Store channel therefore lags GitHub releases and is accepted as part of choosing this route.
- **Publisher identity**: The publisher display name Windows shows derives from the free individual developer account used for submission; exact naming is settled at planning time.
- **Component packaging**: The native shell-extension component ships only inside the Store package; non-Store artifacts remain pure Electron output with their current footprint.
- **Win10 coverage**: First-level placement is a Windows 11 concept; on older Windows the Store build relies on the classic mechanism (FR-013) with whatever reach spec 006/035 provide there.
- **Verification limits**: Real Explorer menu behaviour cannot be exercised by the automated end-to-end suite; verification is manual against real built artifacts per the feature quickstart, plus automated unit coverage for everything the repository can test directly (hand-off handling, containment logic, channel-isolation scripts). Fault-injection testing (US5) is manual and mandatory before each phase declaring this feature done.
