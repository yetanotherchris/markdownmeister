; Spec 006 (FR-001/002/012/013/015): per-user Explorer context-menu verbs that
; open .md/.markdown files and folders in MarkdownMeister WITHOUT changing the
; user's default handler (research R5).
;
; Registry strategy (research R5): HKCU\Software\Classes is the admin-free
; per-user equivalent of HKCR. A freshly created per-user class key would shadow
; the machine-wide class, so the effective (Default) is preserved BEFORE the
; verb is written. Whether we CREATED a class is recorded in an app-owned state
; key, so uninstall deletes a class only when it was ours; a pre-existing class
; (or one the user has since extended) is left intact.

!ifndef PRODUCT_NAME
  !define PRODUCT_NAME "MarkdownMeister"
!endif

; electron-builder defines `${PRODUCT_FILENAME}.exe` as APP_EXECUTABLE_FILENAME
; in its common.nsh (markdownmeister.exe, spec 019) — never redefine it here.

; FR-015: one product display name feeds every native action label.
!define MM_VERB_NAME "${PRODUCT_NAME}"
!define MM_VERB_DISPLAY "Open with ${PRODUCT_NAME}"
!define MM_STATE_KEY "Software\MarkdownMeister\OsOpenState"

; Register one verb for a class (".md", ".markdown", "Directory"). If the
; per-user class did not already exist it is marked in the state key so
; uninstall can remove it wholesale.
!macro MM_RegisterVerb EXT
  ReadRegStr $0 HKCR "${EXT}" ""
  ClearErrors
  ReadRegStr $1 HKCU "Software\Classes\${EXT}" ""
  IfErrors 0 MM_EXISTS_${EXT}
  WriteRegDWord HKCU "${MM_STATE_KEY}" "${EXT}" 1
  MM_EXISTS_${EXT}:
  WriteRegStr HKCU "Software\Classes\${EXT}" "" "$0"
  WriteRegStr HKCU "Software\Classes\${EXT}\shell\${MM_VERB_NAME}" "" "${MM_VERB_DISPLAY}"
  WriteRegStr HKCU "Software\Classes\${EXT}\shell\${MM_VERB_NAME}" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKCU "Software\Classes\${EXT}\shell\${MM_VERB_NAME}\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

; Remove a verb; then drop the class key only when we created it (state marker
; set at install) AND it no longer holds a `shell` subkey — a pre-existing or
; user-extended class is left intact.
!macro MM_UnregisterVerb EXT
  DeleteRegKey HKCU "Software\Classes\${EXT}\shell\${MM_VERB_NAME}"
  EnumRegKey $1 HKCU "Software\Classes\${EXT}\shell" 0
  StrCmp $1 "" 0 MM_KEEP_SHELL_${EXT}
  DeleteRegKey HKCU "Software\Classes\${EXT}\shell"
  MM_KEEP_SHELL_${EXT}:
  ReadRegDWord $2 HKCU "${MM_STATE_KEY}" "${EXT}"
  StrCmp $2 1 0 MM_KEEP_CLASS_${EXT}
  DeleteRegKey HKCU "Software\Classes\${EXT}"
  DeleteRegValue HKCU "${MM_STATE_KEY}" "${EXT}"
  MM_KEEP_CLASS_${EXT}:
!macroend

!macro customInstall
  !insertmacro MM_RegisterVerb ".md"
  !insertmacro MM_RegisterVerb ".markdown"
  !insertmacro MM_RegisterVerb "Directory"
  ; Refresh Explorer so the verbs appear without a shell restart (research R6).
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend

!macro customUnInstall
  !insertmacro MM_UnregisterVerb ".md"
  !insertmacro MM_UnregisterVerb ".markdown"
  !insertmacro MM_UnregisterVerb "Directory"
  DeleteRegKey HKCU "${MM_STATE_KEY}"
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend
