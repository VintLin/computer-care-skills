---
name: macos-repair-permissions
description: Use when a macOS app, script, launchd job, CLI, or background process gets Operation not permitted, permission denied, Full Disk Access, Files and Folders, TCC, sandbox, or protected Library/Containers access errors.
---

# macOS Repair Permissions

## Overview

macOS privacy permissions are granted to the exact app or executable that accesses protected data. Diagnose which binary is denied before asking the user to change Full Disk Access, Files and Folders, Automation, or related privacy settings.

## When to Use

Use for:

- `Operation not permitted` on Desktop, Documents, Downloads, iCloud Drive, Mail, Messages, Photos, or `~/Library/Containers`
- LaunchAgents/LaunchDaemons that work interactively but fail in the background
- CLI tools that need Full Disk Access or Files and Folders permission
- TCC permission drift after moving, rebuilding, or re-signing a binary

Do not claim permissions were granted programmatically. macOS usually requires a user-authenticated UI action.

## Workflow

1. Capture the exact error, path, executable, and launch context.
2. Resolve the executable path that macOS sees:
   ```bash
   ps -axo pid,ppid,comm,args | grep '<process-name>'
   readlink -f /path/to/binary 2>/dev/null || realpath /path/to/binary
   ```
3. Check whether the failure is limited to protected paths.
4. If Full Disk Access is likely required, guide the user to:
   System Settings -> Privacy & Security -> Full Disk Access.
5. Add the actual app or binary, then restart the app/job.
6. Re-run the failing command and verify the protected path can be read.

## Helper Script

If present, `scripts/fda-grant-walkthrough.sh` can prepare the manual grant:

```bash
bash scripts/fda-grant-walkthrough.sh /absolute/path/to/binary
bash scripts/fda-grant-walkthrough.sh --check /absolute/path/to/binary
```

The helper may open System Settings and copy a path to the clipboard, but the user still performs the permission grant.

## Common Fixes

| Symptom | Likely fix |
| --- | --- |
| Terminal command works, launchd fails | Grant FDA to the launchd-spawned binary, not only Terminal |
| Rebuilt binary lost access | Re-add the new signed binary or app bundle |
| App can read normal files but not app containers | Full Disk Access or app-specific privacy permission |
| Permission dialog never appears | Open System Settings manually and add the executable |

## Common Mistakes

- Do not run `tccutil reset` unless the user accepts resetting prompts for that service.
- Do not add the shell app when the failing process is a separate compiled binary.
- Do not assume `sudo` bypasses TCC; privacy permissions still apply.
- Do not edit TCC databases directly.
