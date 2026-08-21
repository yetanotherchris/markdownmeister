# Feature Specification: Folder Context Menu

**Feature Branch**: `035-folder-context-menu`

**Created**: 2026-08-21

**Status**: Draft

**Input**: User description: "I want to create a new spec, which adds a new Windows Explorer option that mimics the 'Open in Terminal' or 'Open with Code' functionality, so folders can be opened in markdownmeister using this right click/context menu option. If Mac OS supports this, or Linux, then those too. Uninstalling should also ensure it removes these options from the context menu, and also removes 'open with' too"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a folder from the Explorer right-click menu (Priority: P1)

A Windows user browsing in File Explorer right-clicks a folder and chooses the MarkdownMeister action, exactly as they would use the built-in "Open in Terminal" or another editor's "Open with Code" entry. The application launches — or, if already running, comes to the front — with that folder opened as the workspace, ready to edit. The action is offered in the menu the user actually sees on a plain right-click, not hidden behind an extra step such as "Show more options".

**Why this priority**: Opening a folder is the primary way to start working on a collection of notes. Reaching that state without launching the app first and hunting through a file dialog is the whole value of the feature.

**Independent Test**: Install the application on Windows, right-click any folder in File Explorer, choose the MarkdownMeister action, and confirm the folder opens as the workspace with its markdown files listed in the explorer.

**Acceptance Scenarios**:

1. **Given** the application is installed on Windows and the user right-clicks a folder in File Explorer, **When** they choose the action bearing the product name, **Then** the application opens with that folder loaded as the workspace.
2. **Given** the user right-clicks a folder in File Explorer, **When** the context menu appears, **Then** the action bearing the product name is present alongside other applications' folder actions (on Windows 11 this is the classic menu, reached directly or via "Show more options" — the same placement other editors' folder actions use).
3. **Given** the application is already running with a different workspace open, **When** the user invokes the folder action, **Then** the existing workspace-open behaviour applies, including the confirmation prompt when unsaved changes would be discarded.
4. **Given** the application is already running with the same folder already open as the workspace, **When** the user invokes the folder action, **Then** the existing window/session becomes active rather than a duplicate session starting.
5. **Given** the application is not running, **When** the user invokes the folder action, **Then** the application starts directly with that folder as the workspace.

---

### User Story 2 - The same convenience on macOS and Linux where the platform allows it (Priority: P2)

A macOS user can hand a folder to the application through the operating system's standard hand-off routes — Dock drop, `open -a`, or "Open With" in file managers that offer it for folders — without launching the application first. On Linux, where the desktop environment offers a standard way for applications to advertise folder support, the same convenience is available in supported file managers; environments that offer no such mechanism are documented as unsupported rather than left with a broken entry.

**Why this priority**: Windows is the platform named by the request and the product's primary distribution target; macOS and Linux extend the same convenience where the operating system makes it possible without hacks.

**Independent Test**: On macOS, right-click a folder in Finder, invoke the product-name action, and confirm the folder opens as the workspace. Repeat on a Linux environment with a file manager that supports third-party folder actions.

**Acceptance Scenarios**:

1. **Given** the application is installed on macOS, **When** the user hands a folder to the application via an operating-system route (Dock drop, `open -a`, or "Open With" where the file manager offers it), **Then** the application opens with that folder as the workspace.
2. **Given** a Linux desktop environment that provides a standard mechanism for third-party folder context actions, **When** the user right-clicks a folder in its file manager, **Then** an action bearing the product name is available and opens the folder as the workspace.
3. **Given** a Linux desktop environment that offers no standard mechanism for third-party folder actions, **When** the user consults the product documentation, **Then** that environment is listed as unsupported for the folder action, and no broken or non-functional menu entry exists anywhere.

---

### User Story 3 - Uninstall removes every context-menu trace (Priority: P1)

A user who uninstalls the application is left with no trace of it in any file manager's context menus: the folder action is gone, and the "Open with MarkdownMeister" entries on markdown files are gone too. No dead entries remain, and other applications' menu entries and the user's default applications are untouched.

**Why this priority**: Leftover context-menu entries pointing at an uninstalled program are broken UI in the operating system itself. The user explicitly called this out: integration that survives uninstall erodes trust in every install.

**Independent Test**: Install the application, verify the folder action and the file "Open with" entries exist, uninstall through the same channel, and confirm none of them remain while unrelated context-menu entries still work.

**Acceptance Scenarios**:

1. **Given** an installed application with the folder action present, **When** the user uninstalls through any distribution channel the product ships, **Then** the folder action no longer appears in any file manager context menu.
2. **Given** an installed application with "Open with" entries for supported markdown files, **When** the user uninstalls, **Then** those entries no longer appear for `.md` or `.markdown` files.
3. **Given** the user changed their default application for markdown files between installing and uninstalling, **When** they uninstall, **Then** every entry the application added is still removed completely.
4. **Given** any uninstall, **When** the user inspects context menus afterwards, **Then** entries belonging to other applications are unchanged and no menu item fails or errors when clicked.

---

### Edge Cases

- The chosen folder was deleted, moved, or renamed between the menu being shown and the action being invoked: the application reports a clear in-context error and leaves the current session unchanged.
- The folder path contains spaces, non-Latin characters, or unusual characters: the folder is opened exactly as chosen, with no truncation or reinterpretation.
- The chosen folder is a symbolic link or junction: it is validated like any other externally supplied path before being opened.
- The chosen item is a special location (a drive root, a library, a system folder): the action either works correctly or is not offered; the application never opens a misleading substitute.
- Multiple folders are selected: the action is offered only when the platform lets the user unambiguously act on one folder; batch opening is out of scope.
- Right-clicking the empty background inside a folder (rather than the folder itself) is out of scope for this feature.
- The application is updated from a version without this feature to one with it, or between versions that have it: the folder action remains present and points at the installed version, never at a previous one.
- An externally supplied path fails validation: the application fails closed, changes nothing, and does not expose unrelated filesystem locations in the error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Installed Windows versions MUST offer a File Explorer folder context-menu action, labelled with the product name, that opens the chosen folder as the workspace.
- **FR-002**: On Windows 11 the folder action MUST be reachable from the folder context menu through the standard menu flow (the classic menu, via "Show more options" when that is how the system presents classic entries); placement in the top-level modern menu is out of scope (see Clarifications).
- **FR-003**: Invoking the folder action MUST open the folder through the application's existing workspace-open behaviour, preserving all existing safeguards, including confirmation before unsaved work is discarded.
- **FR-004**: Invoking the folder action while the application is already running MUST route to the running instance; when it is not running, the action MUST start it.
- **FR-005**: Installed macOS versions MUST accept folders handed over by the operating system (Dock drop, `open -a`, and "Open With" in file managers that offer folder hand-off), opening the handed-over folder as the workspace without the user launching the application first.
- **FR-006**: On Linux, where the desktop environment provides a standard mechanism for third-party folder context actions, installed versions MUST provide the folder action in file managers that use that mechanism; environments without such a mechanism MUST be documented as unsupported rather than given a non-functional entry.
- **FR-007**: Every folder path received from the operating system MUST be treated as untrusted and validated by the trusted part of the application before use; an invalid, unavailable, or unsafe path MUST fail closed, leave the current session unchanged, and produce an error that does not expose unrelated filesystem locations.
- **FR-008**: Uninstalling through any distribution channel the product ships MUST remove the folder action everywhere that channel's install added it.
- **FR-009**: Uninstalling MUST also remove the "Open with" context-menu entries the application registers for supported markdown files, leaving no dead entries, and MUST NOT remove or corrupt entries belonging to other applications or change the user's default applications.
- **FR-010**: Installing or updating MUST leave the folder action and the "Open with" file actions present and pointing at the currently installed version.
- **FR-011**: Every action label in this feature MUST derive from the single product display name; no action may carry a differently spelled product name.
- **FR-012**: Registration and removal of the actions on Windows MUST be possible for a standard user account without administrator elevation.
- **FR-013**: The folder action supports one selected folder at a time; multi-selection is out of scope, consistent with the existing file actions.

### Key Entities *(include if feature involves data)*

- **Folder open action**: The operating-system file-manager command that routes a chosen folder to the application as a requested workspace, labelled with the product name.
- **Product display name**: The single product-level value from which every action label in this feature derives.
- **External path**: A folder location received from the operating system rather than selected inside the application; it is untrusted until validated.
- **Registration record**: The record of exactly which menu locations an install created, so uninstall removes precisely those and nothing else, even if the user's system changed between install and uninstall.
- **Distribution channel**: The way the application reached the machine (installer, package manager, portable archive); each channel that adds the actions is responsible for removing them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of Windows installation tests, the folder action appears in File Explorer's folder context menu and opens the chosen folder as the workspace.
- **SC-002**: In 100% of Windows 11 tests, the folder action is reachable from the folder context menu via the standard menu flow (including "Show more options"), matching how other applications' folder actions present themselves.
- **SC-003**: In 100% of supported macOS installation tests, handing a folder to the application through each operating-system route opens that folder as the workspace.
- **SC-004**: Across tested Linux desktop environments, the folder action works in every environment that supports third-party folder actions, and no tested environment shows a broken or non-functional entry.
- **SC-005**: In 100% of uninstall tests across every distribution channel the product ships, no folder action and no "Open with" file entry bearing the product name remains in any context menu, and other applications' entries still function.
- **SC-006**: In 100% of adversarial external-path tests, invalid, unavailable, or unsafe folder paths are refused without changing the current session or exposing unrelated filesystem locations.
- **SC-007**: Opening a folder via the context menu takes no more user steps than the platform's built-in "Open in Terminal" action: one right-click and one menu selection.

## Clarifications

### 2026-08-21 (during planning)

- **Windows 11 menu level (rescopes FR-002/SC-002)**: Placement in the modern top-level context menu (exactly like "Open in Terminal") requires the application to have package identity via a signed identity package plus a native shell-extension component implementing the Explorer command interface. That is disproportionate for this feature, and releases ship unsigned by decision of spec 005. The folder action therefore uses the same standard registration mechanism as the existing file actions; on Windows 11 it appears in the classic menu ("Show more options"), which is where the large majority of applications' folder actions appear. Top-level placement may be revisited as its own feature if ever wanted.
- **macOS Finder right-click (rescopes FR-005/SC-003)**: Finder offers no "Open With" or third-party context entry for folders on any current macOS version (Apple feedback FB9987605, unresolved). The requirement is met through the operating-system hand-off routes that do exist and are already declared (Dock drop, `open -a`, third-party file managers).


## Assumptions

- **Relationship to spec 006**: Spec 006 (archived, implemented) introduced the "Open with MarkdownMeister" actions for `.md`/`.markdown` files and folders on Windows, and Finder "Open With" support on macOS. This spec builds on that foundation: it makes the folder action a first-class right-click action using the same standard registration mechanism as the file actions, extends folder support toward Linux, and hardens uninstall so every trace — including the file "Open with" entries — is removed. Spec 006 remains authoritative for file-open behaviour; where this spec and 006 overlap on folders or uninstall, this spec is the stricter requirement.
- **Labels**: The folder action is labelled "Open in MarkdownMeister", mirroring the platform's "Open in Terminal" convention; the existing file action keeps its "Open with MarkdownMeister" label.
- **Scope of "removes 'open with' too"**: This is interpreted as uninstall cleanup — the file "Open with" entries continue to exist while the application is installed, and uninstalling removes both them and the folder action. The file feature itself is not withdrawn.
- **Per-user scope**: Actions are registered for the current user only; no administrator rights are needed to install or remove them.
- **No code signing**: Releases ship unsigned (spec 005 assumption). The chosen mechanisms — per-user registration entries and desktop-entry files — do not require signing.
- **macOS mechanism**: macOS receives folder hand-off through the document-type declaration already shipped by spec 006 (Dock drop, `open -a`, third-party file managers). Finder itself offers no third-party folder context-menu entry on any current macOS version — an operating-system gap, not a gap in this feature.
- **Linux scope**: Support follows the mainstream desktop-environment mechanism for folder actions; niche file managers without a standard mechanism are documented as unsupported instead of half-supported.
- **Folder background**: Right-clicking empty space inside an open folder is out of scope; the action targets the folder item itself.
- **Verification**: Context-menu behaviour cannot be exercised by the automated end-to-end suite against a real Explorer/Finder; verification is manual against real built artifacts per the feature quickstart, plus automated coverage for whatever the repository can test directly (for example, registration scripts and uninstall logic).
