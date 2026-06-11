---
name: manage-paths
description: Use when a user sends a Windows path, UNC network path, macOS path, smb:// URL, /Volumes path, mounted share path, or asks to convert, normalize, quote, inspect, or open a file-system path across Windows and macOS.
---

# Manage Paths

## Overview

Handle file-system paths as data first. Preserve path components exactly, convert syntax only when the target platform is clear, and avoid inventing server/share mappings.

## When to Use

Use for:

- Windows UNC paths: `\\server\share\folder` or `\server\share\folder`
- Windows local paths: `C:\Users\name\folder`
- macOS SMB URLs: `smb://server/share/folder`
- macOS mounted volumes: `/Volumes/share/folder`
- macOS local paths: `/Users/name/folder`
- Requests to open a path, produce a safe command, or convert between Windows and macOS forms

Do not use for URL routing, shell glob expansion, application-specific import paths, or business-specific folder rewrites unless the user provides the mapping rule.

## Core Rules

1. Identify the input path type:
   - Windows UNC: `\\server\share\folder` or `\server\share\folder`
   - Windows local: `C:\Users\name\folder`
   - macOS SMB URL: `smb://server/share/folder`
   - macOS mounted volume: `/Volumes/share/folder`
   - macOS local: `/Users/name/folder`
2. Convert only the path syntax by default. Preserve every directory/file component exactly unless the user explicitly gives a rename, replacement, or business mapping rule.
3. Prefer `smb://server/share/folder` as the macOS output for Windows UNC network paths, because Finder can open it directly.
4. Prefer `\\server\share\folder` as the Windows output for `smb://` paths.
5. When the user asks to open a path:
   - On macOS, open with Finder using `open <path-or-smb-url>`.
   - On Windows, open with File Explorer using `explorer <path>`.
   - If the current environment is not the target OS, return the command the user should run instead of pretending it was opened.

## Quick Reference

| Input | macOS form | Windows form |
| --- | --- | --- |
| `\\server\share\dir` | `smb://server/share/dir` | `\\server\share\dir` |
| `smb://server/share/dir` | `smb://server/share/dir` | `\\server\share\dir` |
| `/Volumes/share/dir` | `/Volumes/share/dir` | placeholder UNC without server |
| `C:\Users\name` | `/Volumes/C/Users/name` placeholder | `C:\Users\name` |

## Tool

Use `scripts/path_tool.py` for deterministic conversion and opening:

```bash
python3 /path/to/manage-paths/scripts/path_tool.py convert --to mac '\\server\share\folder'
python3 /path/to/manage-paths/scripts/path_tool.py convert --to windows 'smb://server/share/folder'
python3 /path/to/manage-paths/scripts/path_tool.py open --to mac '\\server\share\folder'
python3 /path/to/manage-paths/scripts/path_tool.py open --to windows 'smb://server/share/folder' --print-command
```

The script prints the converted path. `open` also opens it when the host OS supports the requested file manager.

## Response Style

For a simple conversion, answer with only the converted path unless the user asks for explanation.

For open requests, state whether it was opened or provide the exact command to run.

If a path appears to require a business-specific rewrite, ask for the rule or say that only syntax conversion can be done safely.

## Common Mistakes

- Do not treat a Windows drive path as a real macOS mount unless the user confirms the mount layout.
- Do not infer a server name from `/Volumes/share`; it only contains the mounted share name.
- Do not silently decode, rename, or translate folder names except for URL percent-decoding in `smb://` paths.
- Do not claim a path was opened when running on the wrong operating system; provide the command instead.
