; A second shortcut that opens Bonsai Beta (the same app with --beta).
!macro customInstall
  CreateShortCut "$SMPROGRAMS\Bonsai Beta.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--beta" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  CreateShortCut "$DESKTOP\Bonsai Beta.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--beta" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
!macroend
!macro customUnInstall
  Delete "$SMPROGRAMS\Bonsai Beta.lnk"
  Delete "$DESKTOP\Bonsai Beta.lnk"
!macroend
