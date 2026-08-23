; Spec 006 (FR-001/002/012/013/015) + fix 2026-08-09: per-user Explorer
; context-menu verbs that open .md/.markdown files and folders in MarkdownMeister
; WITHOUT changing the user's default application.
;
; Registration targets the EFFECTIVE file type (fix 2026-08-09): the shell
; ignores verbs registered under the bare extension key whenever a Windows
; user-choice default exists (the file resolves to the chosen ProgID). For each
; supported extension the verb is therefore registered under the per-user class
; of the resolved ProgID when that is safe — the class already exists in HKCU,
; or the ProgID is dead (registered nowhere, so a fresh HKCU class shadows
; nothing) — otherwise under `*` (AllFilesystemObjects), which the shell always
; enumerates. Folders register under `Directory`. Every class registered is
; recorded in an app-owned state key so uninstall removes exactly what was
; added, even if the user's default changed in between.
;
; Spec 035 (D5): the folder verb gets its own display label, "Open in
; ${PRODUCT_NAME}", mirroring the platform's "Open in Terminal" convention,
; while file verbs keep "Open with ${PRODUCT_NAME}". Both derive from the one
; product name; the verb KEY stays the product name so the uninstall removal
; keys written by earlier versions still resolve.

!ifndef PRODUCT_NAME
  !define PRODUCT_NAME "MarkdownMeister"
!endif

; electron-builder defines `${PRODUCT_FILENAME}.exe` as APP_EXECUTABLE_FILENAME
; in its common.nsh (markdownmeister.exe, spec 019) — never redefine it here.

; FR-015: one product display name feeds every native action label.
!define MM_VERB_NAME "${PRODUCT_NAME}"
!define MM_VERB_DISPLAY_FILE "Open with ${PRODUCT_NAME}"
!define MM_VERB_DISPLAY_FOLDER "Open in ${PRODUCT_NAME}"
!define MM_STATE_KEY "Software\MarkdownMeister\OsOpenState"

; Register the verb under an arbitrary class (a ProgID, `*`, or `Directory`) and
; record the class for uninstall. `${CLASS}` may be a literal or a register
; (e.g. `$1`) holding the class name at runtime; `${DISPLAY}` selects the
; file or folder label.
!macro MM_RegisterVerbClass CLASS DISPLAY
  WriteRegStr HKCU "Software\Classes\${CLASS}\shell\${MM_VERB_NAME}" "" "${DISPLAY}"
  WriteRegStr HKCU "Software\Classes\${CLASS}\shell\${MM_VERB_NAME}" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKCU "Software\Classes\${CLASS}\shell\${MM_VERB_NAME}\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegDWord HKCU "${MM_STATE_KEY}" "${CLASS}" 1
!macroend

; Resolve the effective ProgID for an extension and register the file verb.
!macro MM_RegisterFileVerb EXT
  ClearErrors
  ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\${EXT}\UserChoice" "ProgId"
  IfErrors 0 MM_PROGID_OK_${EXT}
  ClearErrors
  ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\${EXT}\UserChoiceLatest\ProgId" "ProgId"
  IfErrors 0 MM_PROGID_OK_${EXT}
  ClearErrors
  ReadRegStr $1 HKCR "${EXT}" ""
  IfErrors 0 MM_PROGID_OK_${EXT}
  ; No ProgID resolves anywhere: register under `*`.
  !insertmacro MM_RegisterVerbClass `*` "${MM_VERB_DISPLAY_FILE}"
  Goto MM_FILE_DONE_${EXT}
  MM_PROGID_OK_${EXT}:
  ; Use the resolved ProgID when its per-user class already exists (safe) or
  ; when it is dead (registered nowhere, so creating it shadows nothing).
  ClearErrors
  ReadRegStr $2 HKCU "Software\Classes\$1" ""
  IfErrors 0 MM_REG_UNDER_PROGID_${EXT}
  ClearErrors
  ReadRegStr $2 HKLM "Software\Classes\$1" ""
  IfErrors MM_REG_UNDER_DEAD_${EXT}
  Goto MM_REG_UNDER_STAR_${EXT}
  MM_REG_UNDER_DEAD_${EXT}:
  MM_REG_UNDER_PROGID_${EXT}:
  !insertmacro MM_RegisterVerbClass `$1` "${MM_VERB_DISPLAY_FILE}"
  Goto MM_FILE_DONE_${EXT}
  MM_REG_UNDER_STAR_${EXT}:
  !insertmacro MM_RegisterVerbClass `*` "${MM_VERB_DISPLAY_FILE}"
  MM_FILE_DONE_${EXT}:
!macroend

; Remove the file verb for an extension: re-resolve the effective class and
; delete the verb there, then drop a dead-ProgID class we created once it is
; empty (the predefined `*` class is never removed).
!macro MM_UnregisterFileVerb EXT
  ClearErrors
  ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\${EXT}\UserChoice" "ProgId"
  IfErrors 0 MM_UNREG_HAS_PROGID_${EXT}
  ClearErrors
  ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\${EXT}\UserChoiceLatest\ProgId" "ProgId"
  IfErrors 0 MM_UNREG_HAS_PROGID_${EXT}
  ClearErrors
  ReadRegStr $1 HKCR "${EXT}" ""
  IfErrors 0 MM_UNREG_HAS_PROGID_${EXT}
  StrCpy $1 `*`
  MM_UNREG_HAS_PROGID_${EXT}:
  DeleteRegKey HKCU "Software\Classes\$1\shell\${MM_VERB_NAME}"
  StrCmp $1 `*` 0 MM_UNREG_KEEP_${EXT}
  ClearErrors
  ReadRegStr $2 HKCU "Software\Classes\$1" ""
  IfErrors MM_UNREG_KEEP_${EXT}
  EnumRegKey $3 HKCU "Software\Classes\$1" 0
  StrCmp $3 "" 0 MM_UNREG_KEEP_${EXT}
  StrCmp $2 "" 0 MM_UNREG_KEEP_${EXT}
  DeleteRegKey HKCU "Software\Classes\$1"
  MM_UNREG_KEEP_${EXT}:
!macroend

!macro customInstall
  !insertmacro MM_RegisterFileVerb ".md"
  !insertmacro MM_RegisterFileVerb ".markdown"
  ; Spec 035: the folder action carries the folder label (D5).
  !insertmacro MM_RegisterVerbClass "Directory" "${MM_VERB_DISPLAY_FOLDER}"
  ; Refresh Explorer so the verbs appear without a shell restart.
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend

!macro customUnInstall
  ; Remove the verb from every class recorded at install — robust even when the
  ; user changed their default application since.
  StrCpy $0 0
  MM_LOOP:
  EnumRegValue $1 HKCU "${MM_STATE_KEY}" $0
  StrCmp $1 "" MM_LOOP_DONE
  DeleteRegKey HKCU "Software\Classes\$1\shell\${MM_VERB_NAME}"
  IntOp $0 $0 + 1
  Goto MM_LOOP
  MM_LOOP_DONE:
  DeleteRegKey HKCU "${MM_STATE_KEY}"
  ; Also clean the legacy v0.1.0 extension-key entries and the standard
  ; locations, in case an earlier version or a manual change left them.
  !insertmacro MM_UnregisterFileVerb ".md"
  !insertmacro MM_UnregisterFileVerb ".markdown"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\${MM_VERB_NAME}"
  DeleteRegKey HKCU "Software\Classes\*\shell\${MM_VERB_NAME}"
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend
