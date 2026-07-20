Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get current script directory
strPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' Kill existing processes on ports 3000 and 8081
WshShell.Run "taskkill /F /IM node.exe 2>nul", 0, True
WshShell.Run "taskkill /F /IM npm.cmd 2>nul", 0, True
WScript.Sleep 1000

' Show notification
WshShell.Popup "FAAS System started successfully!" & vbCrLf & vbCrLf & _
            "Backend: Port 3000" & vbCrLf & _
            "Frontend: Port 8081" & vbCrLf & vbCrLf & _
            "Access at: http://faas.icts.net", 5, "✓ FAAS System Running", 64

' Start Backend (Hidden)
WshShell.CurrentDirectory = strPath & "\backend"
WshShell.Run "cmd /c npm run dev", 0, False
WScript.Sleep 2000

' Start Frontend (Hidden)
WshShell.CurrentDirectory = strPath
WshShell.Run "cmd /c npm run dev", 0, False

Set WshShell = Nothing