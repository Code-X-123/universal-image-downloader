Set WshShell = CreateObject("WScript.Shell")

' Run taskkill command hidden (0)
WshShell.Run "taskkill /F /IM node.exe", 0, True

MsgBox "The downloader has been stopped.", 64, "App Stopped"