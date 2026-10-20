Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!ifndef VERSION
!define VERSION "0.3.0"
!endif
Name "Bongo Clawd"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\Bongo Clawd"
InstallDirRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BongoClawd" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "${ICON}"
UninstallIcon "${ICON}"
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "将为当前用户安装 Bongo Clawd，并创建开始菜单入口。$\r$\n$\r$\n安装前请先从托盘菜单退出正在运行的小蟹。$\r$\n$\r$\n需要系统已安装 Microsoft Edge WebView2 Runtime；本安装包不包含该运行时。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\Bongo-Clawd.exe"
!define MUI_FINISHPAGE_RUN_PARAMETERS "--open-settings"
!define MUI_FINISHPAGE_RUN_TEXT "启动 Bongo Clawd"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Bongo Clawd 需要 Windows 10 / 11 x64。"
    Abort
  ${EndIf}
  SetShellVarContext current
FunctionEnd
Section "Bongo Clawd（必选）" MainSection
  SectionIn RO
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  SetOverwrite on
  ClearErrors
  File "${PAYLOAD}\Bongo-Clawd.exe"
  IfErrors 0 +3
    MessageBox MB_OK|MB_ICONSTOP "无法更新程序文件。请先从托盘菜单退出小蟹，再重新运行安装包。"
    Abort
  File /r /x Bongo-Clawd.exe "${PAYLOAD}\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Bongo Clawd"
  CreateShortcut "$SMPROGRAMS\Bongo Clawd\Bongo Clawd.lnk" "$INSTDIR\Bongo-Clawd.exe" "--open-settings"
  CreateShortcut "$SMPROGRAMS\Bongo Clawd\卸载 Bongo Clawd.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BongoClawd" "DisplayName" "Bongo Clawd"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BongoClawd" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BongoClawd" "Publisher" "miyomochi"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BongoClawd" "DisplayIcon" "$INSTDIR\Bongo-Clawd.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BongoClawd" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BongoClawd" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BongoClawd" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BongoClawd" "NoRepair" 1
SectionEnd
Section "创建桌面快捷方式" DesktopSection
  CreateShortcut "$DESKTOP\Bongo Clawd.lnk" "$INSTDIR\Bongo-Clawd.exe" "--open-settings"
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  ClearErrors
  Delete "$INSTDIR\Bongo-Clawd.exe"
  IfErrors 0 +3
    MessageBox MB_OK|MB_ICONSTOP "小蟹可能仍在运行。请先从托盘菜单退出，再重新卸载。"
    Abort
  Delete "$INSTDIR\COMPARISON.md"
  Delete "$INSTDIR\LICENSE-CODE.txt"
  Delete "$INSTDIR\README-FIRST.txt"
  Delete "$INSTDIR\SHA256SUMS.txt"
  Delete "$INSTDIR\THIRD-PARTY-NOTICES.md"
  Delete "$INSTDIR\VALIDATION-RESULTS.json"
  Delete "$INSTDIR\VALIDATION.md"
  Delete "$INSTDIR\package-metrics.json"
  Delete "$INSTDIR\rust-licenses\Apache-2.0.txt"
  Delete "$INSTDIR\rust-licenses\BSD-2-Clause.txt"
  Delete "$INSTDIR\rust-licenses\CC-BY-SA-4.0.txt"
  Delete "$INSTDIR\rust-licenses\COPYRIGHT-library.html"
  Delete "$INSTDIR\rust-licenses\GCC-exception-3.1.txt"
  Delete "$INSTDIR\rust-licenses\GPL-2.0-only.txt"
  Delete "$INSTDIR\rust-licenses\GPL-3.0-or-later.txt"
  Delete "$INSTDIR\rust-licenses\ISC.txt"
  Delete "$INSTDIR\rust-licenses\LLVM-exception.txt"
  Delete "$INSTDIR\rust-licenses\MIT.txt"
  Delete "$INSTDIR\rust-licenses\NCSA.txt"
  Delete "$INSTDIR\rust-licenses\OFL-1.1.txt"
  Delete "$INSTDIR\rust-licenses\Unicode-3.0.txt"
  RMDir "$INSTDIR\rust-licenses"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\Bongo Clawd.lnk"
  Delete "$SMPROGRAMS\Bongo Clawd\Bongo Clawd.lnk"
  Delete "$SMPROGRAMS\Bongo Clawd\卸载 Bongo Clawd.lnk"
  RMDir "$SMPROGRAMS\Bongo Clawd"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "BongoClawd"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BongoClawd"
SectionEnd
