# Feature Specification: Save an Opened File in Place

**Feature Branch**: `spec-069-save-opened-file`

**Created**: 2026-10-13

**Status**: Archived

**Input**: User description: "The repro is: open a file, try to save, the save as dialog appears (instead of just saving)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save writes the opened file (Priority: P1)

A person opens an existing markdown file and saves. The application writes that same file. It does not ask where to put the words.

**Why this priority**: This is the reported bug. Save that asks for a new location leaves the original file unchanged while the person believes they stored the edit.

**Independent Test**: With no folder open, open an existing file, change it, choose Save, and confirm the original file contains the change and no location dialog appeared. Repeat for a file that sits outside an already open folder.

**Acceptance Scenarios**:

1. **Given** no folder is open, **When** the user opens an existing file and chooses Save before editing, **Then** no location dialog appears and the file on disk is unchanged.
2. **Given** no folder is open and an existing file has unsaved edits, **When** the user chooses Save from the menu or with the save shortcut, **Then** the original file receives the edits, the unsaved indicator clears, and no location dialog appears.
3. **Given** a folder is open, **When** the user opens a file that is outside that folder, edits it, and chooses Save, **Then** the outside file receives the edits, no location dialog appears, and the open folder does not change.
4. **Given** a folder is open, **When** the user opens a file from the folder explorer, or opens a file that is inside that folder, and saves an edit, **Then** that file is written in place and no location dialog appears.
5. **Given** the user opens an existing file from the recent-items list, or the operating system opens an existing file in the application, **When** the user saves an edit, **Then** that file is written in place and no location dialog appears.
6. **Given** two existing files are open and only one has unsaved edits, **When** the user saves the edited one, **Then** only that file changes and the other document is left alone.

---

### User Story 2 - The file stays the save target (Priority: P1)

After a successful save, the document remains that file. A later Save does not ask for a location. Save As still asks, and once the user picks a location the document follows that choice.

**Why this priority**: A save that works once and prompts the next time is the same bug one step later. Save As must still be able to place the document somewhere else on purpose.

**Independent Test**: Save an opened file, edit, and save again with no location dialog. Then use Save As to pick a different file outside the open folder, edit, and save. Confirm the later Save wrote only the chosen file and left the previous file unchanged.

**Acceptance Scenarios**:

1. **Given** an opened file was saved in place, **When** the user edits and chooses Save again, **Then** the same file is written and no location dialog appears.
2. **Given** any open document, **When** the user chooses Save As, **Then** the location dialog appears. Cancelling it writes nothing and leaves the document associated with the file it had before.
3. **Given** the user completes Save As to a chosen file, including a file outside the open folder or while no folder is open, **When** the user then edits and chooses Save, **Then** only the chosen file is written and no location dialog appears. The previous file is unchanged by that later Save.
4. **Given** a document that has never been saved, **When** the user chooses Save, **Then** the location dialog appears. Cancelling it leaves the document unsaved and creates no file.
5. **Given** an opened file has unsaved edits, **When** the user closes it or quits and chooses Save in the confirmation, **Then** the existing file is written and the location dialog does not appear. Discard and cancel stay as they are.
6. **Given** the opened file has been removed and the existing removed-file confirmation is showing, **When** the user chooses the option that saves a copy, **Then** the location dialog still appears and the copy is written only where the user chooses.

---

### User Story 3 - A failed save does not ask for a new location (Priority: P2)

If the opened file cannot be written, the document stays unsaved and Save does not switch to asking for a new location.

**Why this priority**: Falling through to a location dialog hides a failed save and can store the words somewhere the user did not choose.

**Independent Test**: Make the opened file unwritable, choose Save, and confirm the document stays unsaved, the original bytes are intact, and no location dialog appears.

**Acceptance Scenarios**:

1. **Given** an opened file cannot be written, **When** the user chooses Save, **Then** the document stays unsaved, the failure is surfaced the same way a failed save of a file inside the open folder is surfaced, no location dialog appears, and the file is not left truncated, empty, or partially written.
2. **Given** the opened file has been removed, **When** the user chooses Save directly, **Then** no file is created at the old location, no location dialog appears, and the document stays unsaved.
3. **Given** any save, **When** the write finishes or fails, **Then** the only locations that can change are the file the document is already associated with or a location the user chose in the location dialog.

---

### Edge Cases

- The Save command and the save shortcut follow the same rule.
- Saving a file inside the open folder is unchanged, including a file created in that folder.
- Saving a file from outside the open folder does not switch the open folder to that file's folder.
- Saving one document does not retarget, edit, or clear another document.
- A file renamed or moved inside the open folder keeps its existing association.
- Cancelling the location dialog does not clear an unsaved indicator.
- An interrupted write does not replace the opened file with a partial copy.
- The removed-file confirmation is unchanged. Direct Save is what must not invent a replacement file.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Save of a document opened from an existing file MUST write that file and MUST NOT present a location dialog.
- **FR-002**: FR-001 covers Open File with no folder open, Open File of a file outside the open folder, a recent file, and a file the operating system opened in the application.
- **FR-003**: Save of a file inside the open folder, including one opened from the folder explorer, MUST keep writing that file and MUST NOT present a location dialog.
- **FR-004**: A document that has never been saved MUST still present a location dialog on Save. Cancelling MUST leave it unsaved and MUST NOT create a file.
- **FR-005**: Save As MUST still present a location dialog. After the user chooses a location, the document MUST become that file, including when no folder is open or the chosen file is outside the open folder. The next Save MUST write that file and MUST NOT present a location dialog. Cancelling Save As MUST leave the previous association unchanged and MUST NOT write.
- **FR-006**: A later Save of the same opened file MUST write the same file and MUST NOT present a location dialog.
- **FR-007**: The Save choice in the close-document and quit confirmations MUST write the existing file for an opened document and MUST NOT present a location dialog. Discard and cancel MUST stay as they are.
- **FR-008**: A failed save MUST leave the document unsaved, MUST surface the failure the same way a failed in-folder save does, MUST NOT present a location dialog, and MUST NOT leave the target truncated, empty, or partially written.
- **FR-009**: If the opened file no longer exists, direct Save MUST NOT create a file at the old location and MUST NOT present a location dialog. The existing removed-file confirmation MUST remain the way to save a copy to a chosen location.
- **FR-010**: A save MUST NOT write any location other than the file the document is already associated with or a location the user chose in the location dialog. Saving an outside file MUST NOT change which folder is open.
- **FR-011**: Saving one document MUST NOT change another document's file, content, or unsaved state.

### Key Entities

- **Opened file**: An existing file the user opened, from the file command, the recent list, the operating system, or the folder explorer. It already has a location.
- **Never-saved document**: A document that has no file yet. Save asks for a location.
- **Chosen location**: The file the user picks in the location dialog. After a completed Save As, it replaces the opened file as the document's save target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every check of an opened file that is not inside an open folder, Save and the save shortcut write that file and show zero location dialogs.
- **SC-002**: In every check of a file opened from the folder explorer or from inside the open folder, Save writes that file and shows zero location dialogs.
- **SC-003**: A never-saved document still shows the location dialog on Save, and cancelling creates zero files.
- **SC-004**: After Save As, the next Save writes only the chosen file, including a choice outside the open folder, and leaves the previous file unchanged.
- **SC-005**: In every failed-save check, the document remains unsaved, the opened file is not truncated, and direct Save shows zero location dialogs.
- **SC-006**: In every check that offers a location the user did not open and did not choose, that location is not written.

## Assumptions

- "Location dialog" means the existing Save As prompt. The Save command, its shortcut, and the Save choice in close and quit prompts are the actions that must write an opened file directly.
- The running application was checked on 13 October 2026. Open File with no folder showed the location dialog for the Save command and, after an edit, for the save shortcut. The file on disk stayed unchanged, and the dialog suggested only the file name. The same dialog appeared for Open File of a file outside an open folder. A file opened from the explorer, and a file inside the open folder opened with Open File, saved with no dialog and the edit reached disk. A never-saved document still showed the dialog.
- Recent-item opens and operating-system opens were not clicked in that check. They are in scope because they open an existing file in the same situation as Open File.
- Save As to a destination outside the open folder was not part of the click-through. It is in scope because a later ordinary Save has to follow the file the user just chose, and cancelling has to leave the previous file in place.
- Spec 001 already requires Save of an opened file to write the original file. This spec records the cases where that does not happen today and the surrounding behaviour that must stay.
- This spec does not add a new way to present save errors. A failed save stays unsaved and is reported the same way a failed save of a file inside the open folder is reported. Close and quit already explain a failed save in their confirmation.
- The removed-file confirmation and its choice to save a copy stay as they are.

## Clarifications

### 2026-10-13 (reproduction)

- The reported bug is Save of an existing file that is not inside an open folder. Both the menu command and the save shortcut open the location dialog and leave the original file unchanged.
- Saving a file that is inside the open folder already writes that file. That path stays as a regression check.
- A never-saved document asking for a location is the existing first-save prompt and is not part of the bug.
