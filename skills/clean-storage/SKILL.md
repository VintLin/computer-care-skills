---
name: clean-storage
description: Use when a user asks about low disk space, storage cleanup, cache pruning, Downloads triage, forgotten large files, developer cache size, Docker/WSL bloat, package-manager caches, Windows Update cleanup, or safe ways to reclaim disk space on macOS or Windows.
---

# Clean Storage

## Overview

Reclaim disk space by measuring first, separating disposable caches from user data, and requiring confirmation before deletion. Prefer built-in cleanup tools and tool-specific prune commands over manual deletion.

Do not turn a storage cleanup request into a blind delete task. Treat user files, databases, virtual machines, model weights, Docker volumes, WSL distros, and unknown application state as high risk until proven otherwise.

## Workflow

1. Identify OS, target volume, free space, and whether the user wants analysis only or approved cleanup.
2. Run read-only measurements first: volume pressure, top-level directory sizes, cache sizes, and large user-created files.
3. Read the platform reference that matches the machine:
   - macOS: `references/macos.md`
   - Windows: `references/windows.md`
4. Group candidates by risk:
   - Low: re-downloadable caches and tool-managed temporary data.
   - Medium: installers, disk images, archives, exports, logs, old downloads.
   - High: documents, photos, project folders, databases, VM images, Docker volumes, WSL distros, local models, checkpoints.
   - System-critical: OS internals and package installer state that must only be handled by official tools.
5. Present exact candidates before cleanup: path, size, category, risk, command, admin requirement, and re-download or rollback cost.
6. Execute only explicitly approved actions.
7. Re-measure with the same baseline and report before/after free space plus anything intentionally left untouched.

## Platform Selection

Use macOS guidance for Darwin hosts, Apple laptops/desktops, `/Users`, `~/Library`, Homebrew, Trash, APFS snapshots, and Docker Desktop on macOS.

Use Windows guidance for Windows 10/11, `C:\`, PowerShell, Storage Sense, Disk Cleanup, DISM component store cleanup, WSL2, WinGet, Scoop, Chocolatey, and Docker Desktop on Windows.

If the user provides paths from both systems, first determine where the cleanup will run. Do not apply Windows deletion commands to mounted macOS paths or macOS shell commands to WSL/PowerShell paths.

## Reporting Format

For each proposed deletion or cleanup command, report:

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

For each meaningful decision, include:

- Conclusion
- Reason
- Risk
- Next step
- Scope and validation method when changing or deleting anything

## Common Mistakes

- Do not delete user files automatically, even if they are old or large.
- Do not empty Trash or Recycle Bin without confirmation.
- Do not use broad recursive deletion on `AppData`, `Library`, `ProgramData`, `Windows`, project roots, or application support directories.
- Do not manually delete system internals when an OS cleanup tool exists.
- Do not prune Docker volumes, unregister WSL distros, remove toolchains, or delete model caches without explicit user approval.
- Do not stop after changing scripts or commands; re-read generated reports or command output and verify counts, sizes, and before/after free space.
