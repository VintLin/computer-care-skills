---
name: watch-files
description: Use when a user wants to watch files or folders for changes, run commands on edits, restart local services, trigger backups, send notifications, or debug file-change automation on macOS or Linux.
---

# Watch Files

## Overview

File watchers should be explicit about what is watched, what command runs, where logs go, and how failures are reported. Prefer reversible local automation before installing persistent agents.

## When to Use

Use for:

- Watching a folder for file changes
- Running a command after edits, downloads, exports, or sync events
- Restarting a local script or service when source files change
- Sending notifications after a watched job succeeds or fails
- Debugging watcher behavior across macOS BSD tools and Linux GNU tools

Do not use for security monitoring or destructive cleanup without a separate approval step.

## Workflow

1. Define watched paths and ignore rules.
2. Choose the watcher: `watchexec` when available, otherwise a simple polling script.
3. Decide whether events should debounce, restart, or queue.
4. Capture stdout/stderr to logs.
5. Add notification only after the command is reliable.
6. Test with a harmless file change before enabling persistent automation.

## Quick Examples

Run a command after changes:

```bash
watchexec --restart --watch ./src --ext py -- 'python script.py'
```

Debounce noisy changes:

```bash
watchexec --debounce 2s --watch ~/Downloads -- 'echo changed'
```

Portable recent-file check for macOS:

```bash
find . -type f -maxdepth 2 | while read -r file; do
  mtime=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null || echo 0)
  now=$(date +%s)
  [ $((now - mtime)) -le 60 ] && printf '%s\n' "$file"
done
```

## Notification Rules

- Keep credentials out of skill files and scripts.
- Prefer environment variables, keychain, or a local secret manager.
- Include command, exit code, log path, and changed file in notifications.
- Avoid sending sensitive file contents.

## Common Mistakes

- Do not use Linux-only `find -newermt` in macOS scripts.
- Do not restart services on every noisy temporary file write; debounce or filter extensions.
- Do not run watchers from an unclear working directory.
- Do not install launchd/systemd automation until a foreground test works.
