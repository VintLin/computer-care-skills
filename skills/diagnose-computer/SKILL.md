---
name: diagnose-computer
description: Use when a user reports a slow computer, high memory use, swap, CPU saturation, thermal throttling, disk I/O pressure, slow code execution, profiler needs, Rosetta or runtime architecture concerns, or asks for a reproducible diagnostics bundle on macOS.
---

# Diagnose Computer

## Overview

Diagnose before optimizing. Build a reproducible evidence pack from system pressure, top processes, runtime architecture, workload benchmarks, and profiler output; then choose the smallest reversible action.

Do not treat "free memory" as the goal. On macOS, memory pressure, swap growth, compressed memory, wired memory, CPU load, disk I/O, thermal limits, runtime architecture, and code profiler results matter more.

## When to Use

Use for:

- macOS feels slow, hot, memory-full, swapping, or laggy during development.
- Code runs slowly and the user wants CPU, memory, or I/O bottleneck evidence.
- Python, Node, Java, Go, Rust, Docker, IDE, browser, simulator, local model, or language server usage may affect performance.
- The user needs a shareable diagnostic report before changing settings or killing processes.

Do not use for pure disk cleanup; use `clean-storage`. Do not use for network-only slowness; use `optimize-network`.

If the user says the Mac is slow, memory looks full, swap is high, CPU is hot, or code is slow, stay in this skill first. Only route to `clean-storage` after evidence shows disk space or disposable caches are the primary issue, or when the user explicitly asks to reclaim storage.

## Platform References

Read the matching reference before running commands:

| Platform | Reference | Status |
| --- | --- | --- |
| macOS | `references/macos.md` | supported |
| Windows | future reference | not supported yet |
| Linux | future reference | not supported yet |

If the host is not macOS, say this skill currently only has macOS guidance and fall back to read-only basics unless the user asks to continue.

## Workflow

1. Identify OS, chip, RAM, disk free space, power state, workload command, and what "slow" means.
2. Collect read-only evidence first into a timestamped report directory: system summary, memory pressure, VM counters, top RSS and CPU processes, disk I/O, runtime versions, Docker state when available, and optional thermal/power data.
3. Run a reproducible workload benchmark when the complaint involves code speed.
4. Add a language or native profiler only after the benchmark reproduces the issue.
5. Classify the bottleneck: memory/swap, CPU, thermal/power, disk I/O, runtime architecture, Docker/VM, or code hotspot.
6. Recommend only the smallest action supported by evidence, with validation and rollback.

## Quick Reference

| Evidence | Likely conclusion | Next step |
| --- | --- | --- |
| Memory pressure green and swap not growing | memory is not the bottleneck | benchmark and profile code |
| Memory pressure yellow/red and swap grows during workload | memory bottleneck | reduce high RSS processes or workload peak memory |
| CPU idle near zero and load above logical CPUs | CPU saturation | sample/profile the hot process |
| CPU high but throughput low, machine hot | thermal or power limit possible | inspect `powermetrics` |
| Disk writes high with swap growth | memory pressure causing I/O | fix memory pressure first |
| Disk writes high without swap | build/cache/index/sync I/O | identify writer before cleanup |
| Apple Silicon running x86_64 tools | Rosetta overhead possible | install arm64 or universal runtime |
| Profiler shows one hot function/allocation site | code bottleneck | optimize that site, then re-benchmark |

## Reporting

For each meaningful decision, include:

- Conclusion
- Reason
- Risk
- Next step
- Scope and validation method

Use this final shape:

```text
Baseline:
- Symptom:
- Workload:
- Key metrics:

Diagnosis:
- Main bottleneck:
- Evidence:
- Non-bottlenecks:
- Confidence:

Action:
- Smallest recommended change:
- Risk:
- Rollback or undo:
- Re-test command:
```

## Common Mistakes

- Do not recommend memory cleaners, `purge`, killing system processes, disabling security tools, or clearing caches as first-line fixes.
- Do not infer memory bottlenecks from low free memory alone.
- Do not optimize code without a repeatable command, input size, timing, and peak RSS.
- Do not install profilers before checking built-in tools such as `/usr/bin/time -l`, `sample`, Activity Monitor, and Instruments.
- Do not share raw reports externally without warning that process lists may expose usernames, paths, ports, tokens, and project names.
