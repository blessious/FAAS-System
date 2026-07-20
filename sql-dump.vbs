Set objShell = CreateObject("WScript.Shell")

Dim scriptDir
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))

objShell.Run """" & scriptDir & "sql-dump.bat""", 0, True
