---
name: monitor-processes
description: Use when supervising long-running local commands, background processes, scripts, services, downloads, builds, or automation jobs that may hang, timeout, crash, lose logs, or need heartbeat-based liveness checks.
---

# Monitor Processes

## Overview

Monitor long-running work with explicit status files, heartbeats, logs, and timeouts. A PID alone proves a process exists; it does not prove progress.

## When to Use

Use for:

- Commands expected to run longer than a short interactive task
- Background jobs that need success/failure evidence
- Scripts that may hang while keeping a PID alive
- Local service health checks and restart decisions
- Batch work where each item needs logs and exit status

Do not use for interactive shells, editors, password prompts, or commands that require live stdin.

## Sentinel Pattern

Create a monitor directory with:

| File | Purpose |
| --- | --- |
| `<name>.pid` | Process ID |
| `<name>.heartbeat` | Updated periodically while work progresses |
| `<name>.status` | `SUCCESS`, `FAILED`, `TIMEOUT`, or `HUNG` |
| `<name>.log` | Captured stdout/stderr |
| `<name>.result` | Optional structured output |

## Minimal Wrapper

```bash
#!/usr/bin/env bash
set -uo pipefail
name="${1:?name required}"
monitor_dir="${2:-/tmp/process-monitor}"
mkdir -p "$monitor_dir"
echo $$ > "$monitor_dir/$name.pid"

(while true; do touch "$monitor_dir/$name.heartbeat"; sleep 10; done) &
heartbeat_pid=$!
trap 'kill "$heartbeat_pid" 2>/dev/null' EXIT

if your_command >"$monitor_dir/$name.log" 2>&1; then
  echo SUCCESS > "$monitor_dir/$name.status"
else
  echo FAILED > "$monitor_dir/$name.status"
fi
```

## Monitor Logic

Check in a loop:

1. If `.status` exists, read it and stop.
2. If `.heartbeat` is stale beyond the threshold, treat as hung.
3. If elapsed time exceeds the timeout, stop or escalate.
4. Otherwise wait and check again.

Recommended defaults:

| Setting | Value |
| --- | --- |
| heartbeat interval | 10 seconds |
| stale threshold | 60 seconds |
| poll interval | 10-15 seconds |
| max timeout | based on task, declared before start |

## Common Mistakes

- Do not rely on `tail -f | grep -m1`; it can hang on macOS due to buffering.
- Do not kill a process only because it is slow; compare heartbeat, logs, and timeout.
- Do not restart a failing process repeatedly without reading the log.
- Do not leave monitor files in ambiguous states; write a final status.
