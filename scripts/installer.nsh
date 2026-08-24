
!ifndef PRODUCT_NAME
  !define PRODUCT_NAME "MarkdownMeister"
!endif


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
  !insertmacro MM_RegisterVerbClass "Directory" "${MM_VERB_DISPLAY_FOLDER}"
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend

!macro customUnInstall
  StrCpy $0 0
  MM_LOOP:
  EnumRegValue $1 HKCU "${MM_STATE_KEY}" $0
  StrCmp $1 "" MM_LOOP_DONE
  DeleteRegKey HKCU "Software\Classes\$1\shell\${MM_VERB_NAME}"
  IntOp $0 $0 + 1
  Goto MM_LOOP
  MM_LOOP_DONE:
  DeleteRegKey HKCU "${MM_STATE_KEY}"
  !insertmacro MM_UnregisterFileVerb ".md"
  !insertmacro MM_UnregisterFileVerb ".markdown"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\${MM_VERB_NAME}"
  DeleteRegKey HKCU "Software\Classes\*\shell\${MM_VERB_NAME}"
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend
