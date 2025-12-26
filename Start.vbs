Set WshShell = CreateObject("WScript.Shell")

' 1. Start the Server (Hidden)
WshShell.Run "cmd /c node server.js", 0, False

' 2. Wait 2 seconds for server to load
WScript.Sleep 2000

' 3. Open the Web UI in Browser
WshShell.Run "http://localhost:3000"