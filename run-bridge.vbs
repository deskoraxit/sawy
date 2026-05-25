Dim ws, fs, cmd
Set ws = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")

Dim basePath
basePath = fs.GetParentFolderName(WScript.ScriptFullName)

Do While True
  cmd = "node """ & basePath & "\scripts\pinterest-bridge.js"""
  ws.Run cmd, 0, True
  WScript.Sleep 2000
Loop
