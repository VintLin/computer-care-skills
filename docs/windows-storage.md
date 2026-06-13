可以。Windows 版不要简单把 macOS 路径替换成 Windows 路径，而应迁移原 skill 的安全策略：**先测量、区分缓存与用户数据、按风险分层、删除前列清单并确认、清理后复测**。上传的 macOS skill 也是这个核心思路：可重下缓存低风险，用户文件高风险，Docker/toolchain 等需要单独确认。

下面是一份可直接改造成 Windows skill 的参考稿。

---

# Windows Clean Storage

```yaml
---
name: windows-clean-storage
description: Use when a user asks about low disk space, storage cleanup, cache pruning, Downloads triage, forgotten large files, developer cache size, Docker/WSL bloat, Windows Update cleanup, or safe ways to reclaim disk space on Windows 10/11.
---
```

## Overview

在 Windows 10/11 上回收磁盘空间时，优先使用系统内置清理机制和工具自己的 cache/prune 命令；不要直接删除系统目录。Windows 自带的 Storage Sense 可以自动清理临时文件和回收站项目；Cleanup recommendations 会按临时文件、大文件/未使用文件、云同步文件、未使用应用等分类给出建议。([微软支持][1])

核心原则：

1. **Measure first**：先确认 C: 或目标卷的压力，再找最大目录。
2. **Prefer built-in cleanup**：优先用 Settings、Storage Sense、Disk Cleanup、DISM、Docker/WSL/tool-specific 命令。
3. **Never delete system internals manually**：尤其不要手删 `C:\Windows\WinSxS`、`C:\Windows\Installer`、`C:\Windows\SoftwareDistribution`。
4. **Separate disposable caches from user data**：缓存可重下；项目、数据库、虚拟机、模型权重、照片、文档要谨慎。
5. **Require confirmation before deletion**：先报告路径、大小、风险、命令、回滚/重下载代价。

---

## When to Use

Use for:

* `C:` 空间不足、Windows 更新失败、系统变慢。
* 查找大文件、大目录、旧安装包、录屏、导出文件、压缩包。
* 清理 Windows 临时文件、回收站、Delivery Optimization、Windows Update 旧组件。
* 开发者缓存审计：Docker Desktop、WSL2、uv、pip、npm、Go、Scoop、Chocolatey、Playwright、Hugging Face。
* AI/ML 本地模型缓存、数据集缓存、训练输出、临时 checkpoint 膨胀。

Do not use to:

* 自动删除用户文档、照片、项目、数据库、虚拟机镜像。
* 直接删除 `WinSxS`、`Installer`、`ProgramData`、`AppData` 下不明目录。
* 未确认就执行 `docker system prune -a --volumes`。
* 未确认就清空回收站。
* 未确认就 unregister WSL distro 或删除 VHDX。

---

## Workflow

### 1. Measure disk pressure

普通 PowerShell 即可：

```powershell
Get-Volume | Sort-Object DriveLetter |
  Select-Object DriveLetter,
    @{n='SizeGB';e={[math]::Round($_.Size/1GB,1)}},
    @{n='FreeGB';e={[math]::Round($_.SizeRemaining/1GB,1)}},
    @{n='FreePct';e={[math]::Round(100*$_.SizeRemaining/$_.Size,1)}}
```

如果只看 C:：

```powershell
Get-Volume -DriveLetter C |
  Select-Object DriveLetter,
    @{n='SizeGB';e={[math]::Round($_.Size/1GB,1)}},
    @{n='FreeGB';e={[math]::Round($_.SizeRemaining/1GB,1)}}
```

`Get-Volume` 是微软 Storage PowerShell 模块用于返回卷信息的 cmdlet。([微软学习][2])

---

### 2. Find top-level large folders

先扫用户目录和常见膨胀点：

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
    [PSCustomObject]@{
      Path = $_
      GB = [math]::Round(($size / 1GB), 2)
    }
  }
} | Sort-Object GB -Descending
```

如果想要更快、更接近 Linux/macOS `du` 的体验，可以使用 Microsoft Sysinternals `du.exe`；微软文档说明它会递归报告目录及其子目录的磁盘使用量。([微软学习][3])

示例：

```powershell
du.exe -q -l 2 C:\Users
du.exe -q -l 2 $env:LOCALAPPDATA
du.exe -q -l 2 C:\ProgramData
```

---

### 3. Audit user-created files separately

先列出大文件，不删除：

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

这一步只做 triage。常见候选包括旧 ISO、安装包、ZIP、录屏、导出数据、重复数据集。不要根据“时间旧”自动删除，因为 Windows 上访问时间不一定可靠，且旧文件可能仍然重要。

---

### 4. Audit disposable caches separately

推荐先只测量：

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
  [PSCustomObject]@{
    GB = [math]::Round($size/1GB,2)
    Path = $_
  }
} | Sort-Object GB -Descending
```

---

## Risk Groups

| Risk            | Examples                                                                                                 | Default action                                             |
| --------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Low             | `%TEMP%`, package-manager caches, old browser test binaries, build cache                                 | List size, use tool-specific cleanup, require confirmation |
| Medium          | Downloads installers, old archives, ISO files, exports, old logs                                         | List filename/date/size, ask user to choose                |
| High            | Documents, Photos, project folders, databases, VM images, WSL distros, Docker volumes, model checkpoints | Do not delete automatically                                |
| System-critical | `C:\Windows\WinSxS`, `C:\Windows\Installer`, registry hives, app support databases                       | Never manually delete; use official tools only             |

---

## Common Cleanup Targets

| Area                     | Inspect                                                                       | Cleanup note                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows Storage          | Settings → System → Storage → Cleanup recommendations                         | Good first step; Windows shows expected reclaimed size before cleaning.([微软支持][4])                                                                                                                        |
| Storage Sense            | Settings → System → Storage → Storage Sense                                   | Can clean temp files and Recycle Bin; Downloads/OneDrive are not touched unless configured.([微软支持][1])                                                                                                    |
| Disk Cleanup             | `cleanmgr /d C`                                                               | Microsoft documents `cleanmgr` for clearing temp files, Internet files, downloaded files, and Recycle Bin items.([微软学习][5])                                                                               |
| Delivery Optimization    | Disk Cleanup → Delivery Optimization Files                                    | Windows clears this cache automatically, but Disk Cleanup can clear it manually when more space is needed.([微软支持][6])                                                                                     |
| WinSxS / Component Store | `Dism.exe /Online /Cleanup-Image /AnalyzeComponentStore`                      | Analyze first; never delete `WinSxS` manually. Microsoft explicitly warns manual deletion can damage the system.([微软学习][7])                                                                               |
| Component Store cleanup  | `Dism.exe /online /Cleanup-Image /StartComponentCleanup`                      | Use elevated shell. `/ResetBase` removes superseded versions and prevents uninstalling existing update packages, so treat it as higher risk.([微软学习][8])                                                   |
| Recycle Bin              | `Clear-RecycleBin -DriveLetter C`                                             | PowerShell supports this, but it deletes current user recycle-bin contents; require confirmation.([微软学习][9])                                                                                              |
| WinGet apps              | `winget list`, `winget uninstall <app>`                                       | `winget list` shows installed apps, including apps installed by other means; uninstall only after user approval.([微软学习][10])                                                                              |
| Docker                   | `docker system df`                                                            | Use this before prune; it reports Docker daemon disk usage.([Docker Documentation][11])                                                                                                                   |
| Docker prune             | `docker system prune`                                                         | Removes stopped containers, unused networks, dangling images, build cache; volumes are not removed by default. `--volumes` and `-a` need explicit approval.([Docker Documentation][12])                   |
| WSL2                     | `wsl -l -v`, `wsl.exe --system -d <distro> df -h /mnt/wslg/distro`            | WSL2 stores distros in VHDX files; Microsoft documents checking VHD space and locating VHDX paths.([微软学习][13])                                                                                            |
| uv                       | `uv cache dir`, `uv cache prune`, `uv cache clean`                            | `uv cache prune` removes unused entries; `uv cache clean` clears all entries. Windows default is `%LOCALAPPDATA%\uv\cache`.([Astral Docs][14])                                                            |
| pip                      | `py -m pip cache dir`, `py -m pip cache info`, `py -m pip cache purge`        | pip documents `dir`, `info`, `list`, `remove`, and `purge`; `purge` removes all cache items.([pip][15])                                                                                                   |
| npm                      | `npm config get cache`, `npm cache verify`, `npm cache clean --force`         | npm’s Windows default cache path is `%LocalAppData%\npm-cache`; cache clean requires `--force` because npm considers cache self-healing and normally not necessary except reclaiming space.([npm 文档][16]) |
| Go                       | `go env GOCACHE GOMODCACHE`, `go clean -cache -modcache`                      | Go documents `-cache` for build cache and `-modcache` for module download cache.([Go Packages][17])                                                                                                       |
| Scoop                    | `scoop cache`, `scoop cache rm *`, `scoop cleanup *`                          | Scoop command docs list `cache` for showing/clearing download cache and `cleanup` for removing old versions.([GitHub][18])                                                                                |
| Chocolatey               | `choco cache list`, `choco cache remove --all`                                | Chocolatey CLI v2.1+ has `choco cache` for cache statistics and clearing cached items; elevated context affects system cache visibility.([docs.chocolatey.org][19])                                       |
| Playwright               | `%USERPROFILE%\AppData\Local\ms-playwright`, `npx playwright uninstall --all` | Playwright stores browser binaries at that Windows path; these can consume hundreds of MB per browser build.([Playwright][20])                                                                            |
| Hugging Face             | `hf cache ls`, `hf cache prune`, `hf cache rm ... --dry-run`                  | Hugging Face supports dry-run deletion, pruning detached snapshots, and reporting expected freed space before deletion.([Hugging Face][21])                                                               |

---

## Quick Commands

### Safe measurement commands

```powershell
# Volume pressure
Get-Volume | Sort-Object DriveLetter |
  Select-Object DriveLetter,
    @{n='SizeGB';e={[math]::Round($_.Size/1GB,1)}},
    @{n='FreeGB';e={[math]::Round($_.SizeRemaining/1GB,1)}}

# Top large files in user areas
$roots = @("$env:USERPROFILE\Downloads", "$env:USERPROFILE\Desktop", "$env:USERPROFILE\Documents", "$env:USERPROFILE\Videos")
Get-ChildItem $roots -File -Recurse -Force -ErrorAction SilentlyContinue |
  Sort-Object Length -Descending |
  Select-Object -First 50 @{n='GB';e={[math]::Round($_.Length/1GB,2)}}, LastWriteTime, FullName

# Developer cache size audit
$candidates = @(
  "$env:TEMP",
  "$env:LOCALAPPDATA\pip\Cache",
  "$env:LOCALAPPDATA\uv\cache",
  "$env:LOCALAPPDATA\npm-cache",
  "$env:USERPROFILE\AppData\Local\ms-playwright",
  "$env:USERPROFILE\.cache\huggingface",
  "$env:USERPROFILE\scoop\cache"
)
$candidates | Where-Object { Test-Path $_ } | ForEach-Object {
  $size = (Get-ChildItem -LiteralPath $_ -Force -Recurse -File -ErrorAction SilentlyContinue |
    Measure-Object Length -Sum).Sum
  [PSCustomObject]@{GB=[math]::Round($size/1GB,2); Path=$_}
} | Sort-Object GB -Descending
```

### Low-risk cleanup commands, still requiring approval

```powershell
# Windows built-in UI
Start-Process "ms-settings:storagesense"
Start-Process "ms-settings:storage"

# Disk Cleanup
cleanmgr /d C

# pip
py -m pip cache info
py -m pip cache purge

# uv
uv cache dir
uv cache prune
# stronger:
uv cache clean

# npm
npm config get cache
npm cache verify
npm cache clean --force

# Go
go env GOCACHE GOMODCACHE
go clean -cache -modcache

# Playwright
npx playwright uninstall --all

# Hugging Face
hf cache ls
hf cache prune
# or dry-run first:
hf cache rm <repo-or-revision> --dry-run

# Docker
docker system df
docker system prune
```

### Medium/high-risk commands requiring explicit confirmation

```powershell
# Recycle Bin: irreversible from normal UI after clear
Clear-RecycleBin -DriveLetter C

# Component store: admin shell required
Dism.exe /Online /Cleanup-Image /AnalyzeComponentStore
Dism.exe /online /Cleanup-Image /StartComponentCleanup

# Higher risk: prevents uninstalling existing superseded update packages
Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase

# Docker: can remove unused images and anonymous volumes
docker system prune -a --volumes
```

---

## Windows-specific precautions

### 1. Do not manually delete WinSxS

`C:\Windows\WinSxS` is not a normal cache directory. Microsoft explicitly says not to delete it manually; use DISM or Disk Cleanup instead. Manual deletion can make Windows unbootable or unable to update.([微软学习][8])

Recommended sequence:

```powershell
Dism.exe /Online /Cleanup-Image /AnalyzeComponentStore
Dism.exe /online /Cleanup-Image /StartComponentCleanup
```

Use this only from an elevated terminal.

---

### 2. Treat `ResetBase` as irreversible for existing updates

This command can reclaim more space:

```powershell
Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase
```

But Microsoft notes that after it completes, existing update packages cannot be uninstalled. That means it should be classified as **medium/high risk**, not as a default cleanup.([微软学习][8])

---

### 3. Docker volumes are high risk

Default `docker system prune` does **not** remove volumes, specifically to avoid deleting important data. Adding `--volumes` changes that risk profile. Docker’s documentation says `docker system prune -a --volumes` can remove anonymous unused volumes, images without associated containers, and build cache.([Docker Documentation][12])

Safe Docker flow:

```powershell
docker system df
docker ps -a
docker images
docker volume ls
docker system prune
```

Only after user confirms that volumes are disposable:

```powershell
docker system prune -a --volumes
```

---

### 4. WSL2 requires two layers of cleanup

Inside the distro, deleting files frees Linux filesystem space, but the Windows-side VHDX may still occupy space until managed/compacted depending on configuration. Microsoft documents WSL2 distros as VHD-backed and provides commands to check distro VHD usage.([微软学习][13])

Audit:

```powershell
wsl -l -v
wsl.exe --system -d Ubuntu df -h /mnt/wslg/distro
```

Inside WSL:

```bash
df -h
du -h -d 1 ~ | sort -h
sudo apt clean
sudo journalctl --vacuum-time=7d
```

Do not run:

```powershell
wsl --unregister Ubuntu
```

unless the user explicitly wants to delete that distro and all its data.

---

### 5. AppData is mixed-risk

`AppData` contains both disposable caches and application state. Examples:

* likely disposable: `Temp`, package caches, browser test binaries.
* risky: database files, IDE indexes tied to active projects, app profiles, local wallets, chat app data, game saves.
* very risky: unknown `AppData\Roaming` directories.

Default behavior: report size and path only; do not delete unknown AppData directories.

---

## Reporting Format

For each proposed deletion, report:

```text
Path:
Size:
Category:
Risk:
Why it is probably safe/risky:
Cleanup command:
Rollback/re-download cost:
Needs admin:
Requires explicit confirmation:
```

Example:

```text
Path: C:\Users\vint\AppData\Local\uv\cache
Size: 8.4 GB
Category: Python package/build cache
Risk: Low
Why: uv cache can be recreated from package sources; uv provides official cache prune/clean commands.
Cleanup command: uv cache prune
Rollback/re-download cost: future installs may redownload/rebuild packages.
Needs admin: No
Requires explicit confirmation: Yes
```

---

## Common Mistakes

* Do not delete `C:\Windows\WinSxS`; use DISM or Disk Cleanup.
* Do not delete `C:\Windows\Installer`; it is used for installed MSI repair/uninstall operations.
* Do not use `Remove-Item -Recurse -Force` on broad paths like `AppData`, `ProgramData`, `Windows`, or project roots.
* Do not clear Docker volumes unless the user accepts possible database/data loss.
* Do not unregister WSL distros as a cleanup shortcut.
* Do not assume all Hugging Face or model cache is disposable; for large models, re-download cost can be significant.
* Do not clear Downloads automatically; list candidates first.
* Do not treat OneDrive/cloud placeholders as normal local files without checking sync state.
* Do not run cleanup while package managers, Docker builds, training jobs, or IDE indexing tasks are active.

---

## Practical Windows Skill Behavior

A Windows cleanup assistant should behave like this:

1. Start with `Get-Volume`.
2. If C: is low, audit top-level user/system/dev cache locations.
3. Present grouped candidates:

   * Windows built-in cleanup
   * developer caches
   * Docker/WSL
   * user large files
   * high-risk untouched items
4. Ask for approval only after showing exact commands.
5. Execute only approved items.
6. Re-run `Get-Volume` and report before/after free space.
7. State anything intentionally left untouched.

A good default cleanup order is:

```text
1. Storage Cleanup Recommendations / Storage Sense
2. Disk Cleanup / Delivery Optimization Files
3. Tool-specific developer cache prune
4. Docker prune without volumes
5. User Downloads triage
6. DISM StartComponentCleanup
7. Optional high-risk actions only with explicit approval
```

This produces an effect close to the macOS skill, but aligned with Windows’ actual cleanup mechanisms and risk boundaries.

[1]: https://support.microsoft.com/en-us/windows/manage-drive-space-with-storage-sense-654f6ada-7bfc-45e5-966b-e24aded96ad5 "Manage drive space with Storage Sense - Microsoft Support"
[2]: https://learn.microsoft.com/en-us/powershell/module/storage/get-volume?view=windowsserver2025-ps&utm_source=chatgpt.com "Get-Volume (Storage)"
[3]: https://learn.microsoft.com/en-us/sysinternals/downloads/du "Disk Usage - Sysinternals | Microsoft Learn"
[4]: https://support.microsoft.com/en-us/windows/free-up-drive-space-in-windows-85529ccb-c365-490d-b548-831022bc9b32 "Free up drive space in Windows - Microsoft Support"
[5]: https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cleanmgr "cleanmgr | Microsoft Learn"
[6]: https://support.microsoft.com/en-us/windows/delivery-optimization-in-windows-dbcaf188-0cf9-427a-b791-a7c5d740a48c "Delivery Optimization in Windows - Microsoft Support"
[7]: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/determine-the-actual-size-of-the-winsxs-folder?view=windows-11&utm_source=chatgpt.com "Determine the Actual Size of the WinSxS Folder"
[8]: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/clean-up-the-winsxs-folder?view=windows-11 "Clean Up the WinSxS Folder | Microsoft Learn"
[9]: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/clear-recyclebin?view=powershell-7.6&utm_source=chatgpt.com "Clear-RecycleBin (Microsoft.PowerShell.Management)"
[10]: https://learn.microsoft.com/en-us/windows/package-manager/winget/list "list Command | Microsoft Learn"
[11]: https://docs.docker.com/reference/cli/docker/system/df/ "docker system df | Docker Docs"
[12]: https://docs.docker.com/reference/cli/docker/system/prune/ "docker system prune | Docker Docs"
[13]: https://learn.microsoft.com/en-us/windows/wsl/disk-space "How to manage WSL disk space | Microsoft Learn"
[14]: https://docs.astral.sh/uv/concepts/cache/ "Caching | uv"
[15]: https://pip.pypa.io/en/stable/cli/pip_cache/ "pip cache - pip documentation v26.1.2"
[16]: https://docs.npmjs.com/cli/v11/commands/npm-cache "npm-cache | npm Docs"
[17]: https://pkg.go.dev/cmd/go?utm_source=chatgpt.com "go command - cmd/go"
[18]: https://github.com/ScoopInstaller/Scoop/wiki/Commands?utm_source=chatgpt.com "Commands · ScoopInstaller/Scoop Wiki"
[19]: https://docs.chocolatey.org/en-us/choco/commands/cache/?utm_source=chatgpt.com "Chocolatey Software Docs | Cache"
[20]: https://playwright.dev/docs/browsers "Browsers | Playwright"
[21]: https://huggingface.co/docs/huggingface_hub/en/guides/manage-cache "Understand caching · Hugging Face"
