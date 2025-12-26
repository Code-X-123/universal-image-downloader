Set WshShell = CreateObject("WScript.Shell")

' 1. Kill Node.js (Hide window)
WshShell.Run "taskkill /F /IM node.exe", 0, True

' 2. Wait a moment
WScript.Sleep 1000

' 3. Start Server
WshShell.Run "cmd /c node server.js", 0, False

' 4. Wait for load
WScript.Sleep 2000

' 5. Open Browser
WshShell.Run "http://localhost:3000"