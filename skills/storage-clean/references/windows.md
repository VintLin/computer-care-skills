# Windows Storage Cleanup Reference

## Read-Only Baseline

Measure volume pressure in PowerShell:

```powershell
Get-Volume | Sort-Object DriveLetter |
  Select-Object DriveLetter,
    @{n='SizeGB';e={[math]::Round($_.Size/1GB,1)}},
    @{n='FreeGB';e={[math]::Round($_.SizeRemaining/1GB,1)}},
    @{n='FreePct';e={[math]::Round(100*$_.SizeRemaining/$_.Size,1)}}
```

Find top-level large folders without deleting:

```powershell
$paths = @(
  "$env:USERPROFILE",
  "$env:LOCALAPPDATA",
  "$env:APPDATA",
  "$env:ProgramData",
  "C:\Program Files",
  "C:\Program Files (x86)"
)

$paths | ForEach-Object {
  if (Test-Path $_) {
    $size = (Get-ChildItem -LiteralPath $_ -Force -Recurse -File -ErrorAction SilentlyContinue |
      Measure-Object Length -Sum).Sum
    [PSCustomObject]@{Path=$_; GB=[math]::Round($size/1GB,2)}
  }
} | Sort-Object GB -Descending
```

Microsoft Sysinternals `du.exe` is useful when installed:

```powershell
du.exe -q -l 2 C:\Users
du.exe -q -l 2 $env:LOCALAPPDATA
du.exe -q -l 2 C:\ProgramData
```

## User File Triage

List large user-created files before proposing deletion:

```powershell
$roots = @(
  "$env:USERPROFILE\Downloads",
  "$env:USERPROFILE\Desktop",
  "$env:USERPROFILE\Documents",
  "$env:USERPROFILE\Videos"
)

Get-ChildItem $roots -File -Recurse -Force -ErrorAction SilentlyContinue |
  Sort-Object Length -Descending |
  Select-Object -First 50 `
    @{n='GB';e={[math]::Round($_.Length/1GB,2)}},
    LastWriteTime,
    FullName
```

Treat ISO files, installers, ZIP archives, recordings, exports, and duplicate datasets as medium risk. Do not clear Downloads automatically.

## Disposable Cache Targets

Measure first:

```powershell
$candidates = @(
  "$env:TEMP",
  "$env:LOCALAPPDATA\Temp",
  "$env:LOCALAPPDATA\pip\Cache",
  "$env:LOCALAPPDATA\uv\cache",
  "$env:LOCALAPPDATA\npm-cache",
  "$env:USERPROFILE\.cache",
  "$env:USERPROFILE\.cargo",
  "$env:USERPROFILE\go\pkg\mod",
  "$env:USERPROFILE\AppData\Local\ms-playwright",
  "$env:USERPROFILE\.cache\huggingface",
  "$env:USERPROFILE\scoop\cache",
  "$env:ProgramData\chocolatey"
)

$candidates | Where-Object { Test-Path $_ } | ForEach-Object {
  $size = (Get-ChildItem -LiteralPath $_ -Force -Recurse -File -ErrorAction SilentlyContinue |
    Measure-Object Length -Sum).Sum
  [PSCustomObject]@{GB=[math]::Round($size/1GB,2); Path=$_}
} | Sort-Object GB -Descending
```

| Area | Inspect | Cleanup note |
| --- | --- | --- |
| Storage Sense | Settings -> System -> Storage | Built-in first step for temporary files and cleanup recommendations |
| Disk Cleanup | `cleanmgr /d C` | Use OS UI/tooling instead of deleting Windows internals |
| Component store | `Dism.exe /Online /Cleanup-Image /AnalyzeComponentStore` | Analyze first; cleanup requires elevated shell |
| WinGet apps | `winget list` | Uninstall only after user selects apps |
| uv | `uv cache dir`, `uv cache prune` | `uv cache clean` removes all cache entries |
| pip | `py -m pip cache info` | `py -m pip cache purge` |
| npm | `npm config get cache`, `npm cache verify` | `npm cache clean --force` only when reclaiming space |
| Go | `go env GOCACHE GOMODCACHE` | `go clean -cache`; `go clean -modcache` is broader |
| Scoop | `scoop cache`, `scoop cleanup *` | `scoop cache rm *` clears download cache |
| Chocolatey | `choco cache list` | `choco cache remove --all` may need elevated context |
| Playwright | `%USERPROFILE%\AppData\Local\ms-playwright` | `npx playwright uninstall --all` after approval |
| Hugging Face | `hf cache ls` | Prefer dry-run removal or `hf cache prune` |
| Docker | `docker system df` | Volumes are high risk |
| WSL2 | `wsl -l -v` | Distro VHDX cleanup is separate from deleting files inside Linux |

## Safer Cleanup Commands

These still require approval:

```powershell
Start-Process "ms-settings:storage"
Start-Process "ms-settings:storagesense"
cleanmgr /d C
uv cache prune
py -m pip cache purge
npm cache clean --force
go clean -cache
npx playwright uninstall --all
hf cache prune
docker system prune
```

Require stronger explicit confirmation:

```powershell
Clear-RecycleBin -DriveLetter C
Dism.exe /online /Cleanup-Image /StartComponentCleanup
Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase
go clean -modcache
docker system prune -a --volumes
wsl --unregister <DistroName>
Remove-Item -Recurse -Force <specific-reviewed-path>
```

## Windows-Specific Precautions

- Do not manually delete `C:\Windows\WinSxS`; use DISM or Disk Cleanup.
- Do not delete `C:\Windows\Installer`; it is used for MSI repair and uninstall.
- Do not delete unknown `ProgramData`, `AppData`, or `AppData\Roaming` directories.
- Treat `Dism.exe ... /ResetBase` as higher risk because existing update packages cannot be uninstalled afterward.
- Treat Docker volumes as high risk; default `docker system prune` does not remove volumes.
- Do not unregister WSL distros as a cleanup shortcut. It deletes the distro and its data.
- OneDrive/cloud placeholders need sync-state awareness before treating them as local files.
- Avoid cleanup while Windows Update, package managers, Docker builds, WSL jobs, training jobs, or IDE indexing tasks are active.

## Good Default Order

1. Start with `Get-Volume`.
2. Open Storage settings or Cleanup recommendations for OS-managed cleanup.
3. Audit developer caches and package manager caches.
4. Run tool-specific prune commands before manual deletion.
5. Use `docker system df` before Docker cleanup.
6. Audit WSL separately from Windows host storage.
7. Triage user Downloads/Desktop/Documents only after listing exact files.
8. Use DISM component cleanup only when evidence supports it and admin context is acceptable.
9. Re-run `Get-Volume` and report before/after free space.
