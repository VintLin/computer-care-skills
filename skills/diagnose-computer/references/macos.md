# macOS Performance Diagnostics

## Principle

Prefer read-only measurement before cleanup or process changes. macOS uses memory aggressively for cache; low free memory is not automatically a problem. Treat Memory Pressure, Swap Used growth, Compressed, Wired, CPU load, disk I/O, thermal limits, runtime architecture, and profiler output as the evidence.

## Read-Only Collection

Create a local report directory:

```zsh
REPORT="${HOME}/Desktop/mac_diag_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$REPORT"
```

System context:

```zsh
{
  date
  sw_vers
  uname -a
  echo "machine: $(uname -m)"
  sysctl -n machdep.cpu.brand_string 2>/dev/null || true
  sysctl hw.physicalcpu hw.logicalcpu hw.memsize
  uptime
  df -h /
  pmset -g batt 2>/dev/null || true
} > "$REPORT/system_basic.txt"

system_profiler SPHardwareDataType SPSoftwareDataType SPStorageDataType SPPowerDataType \
  > "$REPORT/system_profiler.txt" 2>&1
```

Memory, CPU, process, and I/O state:

```zsh
{
  vm_stat
  echo
  vm_stat 1 10
} > "$REPORT/vm_stat.txt" 2>&1

top -l 2 -s 1 -n 40 -o mem \
  -stats pid,ppid,user,command,cpu,mem,threads,state,time,ports,pageins \
  > "$REPORT/top_by_memory.txt" 2>&1

top -l 2 -s 1 -n 40 -o cpu \
  -stats pid,ppid,user,command,cpu,mem,threads,state,time,ports,pageins \
  > "$REPORT/top_by_cpu.txt" 2>&1

ps -axo pid,ppid,user,%cpu,%mem,rss,vsz,etime,state,command -r \
  > "$REPORT/ps_all_by_cpu.txt" 2>&1

ps -axo pid,ppid,user,%cpu,%mem,rss,vsz,etime,state,command \
  | sort -k6 -nr | head -100 \
  > "$REPORT/ps_top100_by_rss.txt" 2>&1

iostat -d -w 1 -c 10 > "$REPORT/iostat.txt" 2>&1
```

Runtime and architecture checks:

```zsh
{
  for bin in python3 python node npm java go rustc cargo uv conda docker git; do
    if command -v "$bin" >/dev/null 2>&1; then
      echo "\n--- $bin ---"
      which "$bin"
      file "$(which "$bin")" 2>/dev/null || true
      "$bin" --version 2>&1 | head -5 || true
    fi
  done
} > "$REPORT/runtime_versions.txt" 2>&1

if command -v brew >/dev/null 2>&1; then
  {
    brew --prefix
    brew services list
  } > "$REPORT/homebrew.txt" 2>&1
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  {
    docker stats --no-stream
    docker system df
  } > "$REPORT/docker.txt" 2>&1
fi
```

Optional thermal and power data. This may ask for sudo:

```zsh
sudo powermetrics -i 1000 -n 10 \
  --show-process-energy \
  --show-process-io \
  --show-process-gpu \
  --show-plimits \
  > "$REPORT/powermetrics.txt" 2>&1
```

Warn before sharing reports: `ps`, `lsof`, `launchctl`, profiler output, and shell commands can expose usernames, paths, command-line arguments, ports, tokens, and project names.

## Code Benchmarking

Use one reproducible command, fixed input, same power state, and same git commit.

```zsh
/usr/bin/time -l <your command>
```

Record:

```text
command
input_size
repeat_count
wall_time
user_time
sys_time
peak_rss
swap_before_after
git_commit
runtime version
architecture
```

If `hyperfine` is already installed, use it for repeated timing:

```zsh
hyperfine --warmup 3 '<your command>'
```

Do not install it just to start diagnosis; `/usr/bin/time -l` is enough for the first pass.

## Profiling

Python CPU:

```zsh
python -m cProfile -o profile.prof your_script.py
python - <<'PY'
import pstats
p = pstats.Stats("profile.prof")
p.strip_dirs().sort_stats("cumtime").print_stats(30)
PY
```

Python memory allocations:

```python
import tracemalloc

tracemalloc.start()
# run workload here
snapshot = tracemalloc.take_snapshot()
for stat in snapshot.statistics("lineno")[:30]:
    print(stat)
```

Running process sampling:

```zsh
sample <PID> 10 1 -file sample.txt
```

Native, Swift, C, C++, GUI, and Apple-platform apps: use Xcode Instruments. Start with Time Profiler or CPU Profiler for CPU, Allocations or Leaks for memory growth, File Activity for heavy I/O, and System Trace or Thread State for hangs and waits.

## Interpretation

| Evidence | Action |
| --- | --- |
| Memory Pressure green and swap not growing | Stop optimizing memory; benchmark/profile code or inspect I/O/CPU. |
| Memory Pressure yellow/red and swap grows | Find high RSS processes; reduce workload batch size; stop nonessential heavy apps only with user approval. |
| Single process RSS grows linearly | Profile that process for leaks or retained objects. |
| Cached Files large while pressure green | Leave it alone; cache is useful. |
| Wired Memory unusually high | Reboot may be temporary relief; inspect drivers, virtualization, Docker, security software, and kernel extensions. |
| CPU User high | Profile application code. |
| CPU System high | Inspect I/O, networking, file watchers, virtualization, security tools, and sync tools. |
| `kernel_task` high with heat | Check thermal, external devices, docks, virtualization, and drivers. |
| Swap writes high | Treat as memory pressure before disk cleanup. |
| Build/cache/sync writes high | Identify the writer; clean project caches only when bounded and approved. |
| Apple Silicon uses `/usr/local` or `x86_64` runtimes | Check Rosetta; prefer `/opt/homebrew` arm64 or universal tools. |

## Process Fields

When summarizing processes, include:

```text
rank
pid
ppid
user
command
%cpu
%mem
rss_mb
vsz_mb
elapsed
state
threads
pageins
ports
kind/arch
suspected_reason
recommended_action
```

`ps` RSS is in KiB. Convert only in the report; keep raw data unchanged.

## Report Template

```text
# macOS Performance Diagnostic Report

## Context
- Date/time:
- Mac model:
- Chip:
- RAM:
- macOS:
- Power:
- Workload command:
- External display / Docker / IDE / browser state:

## System Summary
- Memory Pressure:
- Physical Memory:
- Memory Used:
- Wired:
- Compressed:
- Cached Files:
- Swap Used:
- CPU idle/user/system:
- Load average:
- Disk free:
- Disk read/write during workload:
- Thermal/power limits:

## Top Processes
- Top RSS:
- Top CPU:
- Suspicious growth:

## Runtime / Architecture
- Terminal arch:
- Python:
- Node:
- Java:
- Homebrew prefix:
- Docker:

## Code Benchmark
- command:
- wall time:
- user time:
- sys time:
- peak RSS:
- profiler top entries:

## Diagnosis
- Main bottleneck:
- Evidence:
- Non-bottlenecks:
- Confidence:

## Plan
- Immediate action:
- Code-level action:
- System/app action:
- Verify with:
```

## Avoid

- Memory cleaners and blind cache clearing.
- `purge` as a performance fix.
- Killing system processes.
- Disabling firewall, SIP, Gatekeeper, EDR, or other security controls.
- Installing new tools before built-in diagnostics prove a gap.
- Changing Docker, IDE, or runtime limits without before/after measurements.
