---
name: codex-provider-sync
description: Use when Codex thread lists omit unarchived records, the active state_5.sqlite model_provider differs from config.toml, or local rollout JSONL session_meta.model_provider metadata needs safe syncing.
---

# Codex Provider Sync

## Overview

Use this workflow to inspect local Codex thread metadata and, after explicit user confirmation, sync unarchived `threads.model_provider` values to the active provider. Use rollout rewrite mode only when SQLite changes are not persistent because JSONL `session_meta.model_provider` restores the old value.

## Required Workflow

1. Locate the active Codex SQLite database.
   - Run `node <skill>/scripts/provider_sync.mjs inspect`.
   - Prefer `~/.codex/sqlite/state_5.sqlite` when present.
   - Treat root `~/.codex/state_5.sqlite` as legacy unless inspection proves it is active.
2. Report the inspection summary to the user.
   - Active DB path.
   - Current `config.toml` `model_provider`.
   - Provider distribution for `archived = 0`.
   - Number of rows that would change.
3. Ask the user to confirm before writing.
   - Do not run write mode from assumption alone.
   - The write command must include `apply --yes`.
4. On confirmation, run the generated apply command.
   - The script backs up the SQLite DB before writing.
   - The script only rewrites unarchived rows by default.
   - Add `--rewrite-rollouts` only when the user explicitly confirms mutating original `~/.codex/sessions/**/*.jsonl` metadata.
5. Verify after writing.
   - Re-run `inspect`.
   - If app-server still omits records after SQLite-only apply, explain that JSONL `session_meta.model_provider` can repair SQLite back to original values.
   - Prefer `thread/list` with `modelProviders: []` for product code when the goal is all-provider display without mutating local history.

## Commands

Inspect:

```bash
node ~/.codex/skills/codex-provider-sync/scripts/provider_sync.mjs inspect
```

Apply after user confirmation:

```bash
node ~/.codex/skills/codex-provider-sync/scripts/provider_sync.mjs apply --yes
```

Persistent rewrite after explicit JSONL confirmation:

```bash
node ~/.codex/skills/codex-provider-sync/scripts/provider_sync.mjs apply --yes --rewrite-rollouts
```

Optional flags:

- `--to openai|custom`: override the target provider. Defaults to current `config.toml` provider.
- `--db /path/to/state_5.sqlite`: override DB path.
- `--include-archived`: include archived rows. Avoid unless the user explicitly asks.
- `--rewrite-rollouts`: also back up and rewrite the first `session_meta` line in scoped JSONL rollouts whose `payload.model_provider` differs from the target provider.

## Safety Rules

- Never edit `~/.codex/sessions/**/*.jsonl` unless the user explicitly asks to rewrite original rollout metadata and accepts that this mutates conversation history files; use `--rewrite-rollouts` for that case.
- Never delete Codex DB or JSONL files as part of provider normalization.
- Never write secrets from `config.toml` to output. Report only provider id and DB paths.
- Prefer `modelProviders: []` in app-server clients when the actual goal is all-provider display, because it avoids mutating local history.
