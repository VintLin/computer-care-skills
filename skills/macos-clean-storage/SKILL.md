---
name: macos-clean-storage
description: Use when a user asks about low disk space, storage cleanup, cache pruning, Downloads triage, forgotten large files, developer cache size, Docker or package-manager bloat, or safe ways to reclaim disk space on macOS.
---

# macOS Clean Storage

## Overview

Reclaim space by measuring first, separating disposable caches from user data, and requiring confirmation before deletion. Treat every cleanup as reversible where possible.

## When to Use

Use for:

- Low disk space or "what is taking space?"
- Developer cache audits: Homebrew, uv, pip, npm, cargo, rustup, Docker, Playwright, Hugging Face
- Downloads/Desktop/Documents triage
- Large stale files, old installers, disk images, recordings, exports, or forgotten archives
- Cleanup plans that need before/after size evidence

Do not use to delete personal files automatically. Do not empty Trash, prune Docker images, or remove toolchains without listing the target and getting approval.

## Workflow

1. Measure disk pressure with `df -h /` and major directory sizes.
2. Audit disposable caches separately from user-created files.
3. Group findings by risk:
   - Low risk: re-downloadable caches.
   - Medium risk: old installers, archives, app exports.
   - High risk: documents, photos, project files, databases, virtual machines.
4. Present cleanup candidates with size, path, and rollback expectation.
5. Execute only approved cleanup actions.
6. Re-measure and report reclaimed space.

## Quick Commands

```bash
df -h /
du -sh ~/Library/Caches ~/Downloads ~/Desktop ~/Documents ~/.cache 2>/dev/null | sort -rh
bash scripts/cache-audit.sh
```

Safe cache commands still require user approval:

```bash
brew cleanup --prune=all
uv cache clean
python -m pip cache purge
npm cache clean --force
go clean -cache
```

## Common Cleanup Targets

| Area | Inspect | Cleanup note |
| --- | --- | --- |
| Homebrew | `~/Library/Caches/Homebrew` | `brew cleanup --prune=all` |
| uv | `~/Library/Caches/uv` | `uv cache clean` |
| pip | `~/Library/Caches/pip` | `python -m pip cache purge` |
| npm | `~/.npm/_cacache` | Re-downloadable, but may slow next install |
| Docker | Docker Desktop data | Prune only after checking active containers/images |
| Playwright | `~/Library/Caches/ms-playwright` | Remove only unused browser builds |
| Hugging Face | `~/.cache/huggingface` | Model deletion may force large re-downloads |

## Reporting

For each proposed deletion, report:

- Path
- Size
- Why it is probably safe or risky
- Exact cleanup command
- Expected rollback or re-download cost

Finish with before/after free space and anything intentionally left untouched.

## Common Mistakes

- Do not use `rm -rf` as the first cleanup option when a tool-specific cleanup command exists.
- Do not delete app support folders just because they are large; they may contain databases or user state.
- Do not assume old access time means safe to delete on systems where access time is unreliable.
- Do not run `docker system prune -a` without confirming the user accepts rebuilding/pulling images.
