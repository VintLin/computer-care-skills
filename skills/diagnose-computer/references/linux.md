# Linux Performance Diagnostics

## Principle

Prefer read-only measurement before cleanup, process kills, or kernel tuning. Do not diagnose Linux memory pressure from `free`'s `free` column alone. Use `MemAvailable`, swap in/out, major faults, PSI, process RSS/PSS/USS/VmSwap, cgroup limits, disk latency, and profiler output together.

## Read-Only Collection

Create a local report directory:

```bash
STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT="${HOME}/linux_diag_${STAMP}"
mkdir -p "$REPORT"
echo "Report directory: $REPORT"
```

System context:

```bash
{
  date -Is
  cat /etc/os-release 2>/dev/null || true
  uname -a
  uptime
  cat /proc/loadavg 2>/dev/null || true
  command -v systemd-detect-virt >/dev/null && systemd-detect-virt -v || true
  lscpu 2>/dev/null || true
  lsmem 2>/dev/null || true
  numactl --hardware 2>/dev/null || true
  lsblk -o NAME,MODEL,SIZE,TYPE,FSTYPE,MOUNTPOINTS,ROTA,DISC-MAX,DISC-GRAN 2>/dev/null || true
  df -hT
  findmnt -D 2>/dev/null || findmnt 2>/dev/null || true
} > "$REPORT/system_basic.txt" 2>&1
```

Memory, PSI, CPU, I/O, and process state:

```bash
{
  free -h
  echo
  swapon --show --bytes 2>/dev/null || swapon -s 2>/dev/null || true
  echo
  grep -E 'MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapCached|Active|Inactive|Unevictable|Mlocked|SwapTotal|SwapFree|Dirty|Writeback|AnonPages|Mapped|Shmem|KReclaimable|Slab|SReclaimable|SUnreclaim|KernelStack|PageTables|Committed_AS|CommitLimit|HugePages|AnonHugePages' /proc/meminfo || true
  echo
  sysctl vm.swappiness vm.overcommit_memory vm.overcommit_ratio vm.dirty_ratio vm.dirty_background_ratio 2>/dev/null || true
} > "$REPORT/memory_summary.txt" 2>&1

cp /proc/meminfo "$REPORT/proc_meminfo.txt" 2>/dev/null || true
cp /proc/vmstat "$REPORT/proc_vmstat.txt" 2>/dev/null || true

vmstat -w -t 1 20 > "$REPORT/vmstat_1s_20s.txt" 2>&1
vmstat -s > "$REPORT/vmstat_stats.txt" 2>&1

{
  for f in /proc/pressure/cpu /proc/pressure/memory /proc/pressure/io; do
    echo "=== $f ==="
    cat "$f" 2>/dev/null || echo "not available"
    echo
  done
} > "$REPORT/pressure_psi.txt" 2>&1

command -v mpstat >/dev/null && mpstat -P ALL 1 20 > "$REPORT/mpstat_1s_20s.txt" 2>&1 || echo "mpstat not installed" > "$REPORT/mpstat_1s_20s.txt"
command -v iostat >/dev/null && iostat -xz 1 20 > "$REPORT/iostat_xz_1s_20s.txt" 2>&1 || echo "iostat not installed" > "$REPORT/iostat_xz_1s_20s.txt"
command -v pidstat >/dev/null && pidstat -durh -p ALL 1 10 > "$REPORT/pidstat_all_1s_10s.txt" 2>&1 || echo "pidstat not installed" > "$REPORT/pidstat_all_1s_10s.txt"

ps -eo pid,ppid,user,stat,ni,pri,psr,pcpu,pmem,rss,vsz,etime,comm,args --sort=-rss | head -120 > "$REPORT/ps_top_by_rss.txt" 2>&1
ps -eo pid,ppid,user,stat,ni,pri,psr,pcpu,pmem,rss,vsz,etime,comm,args --sort=-pcpu | head -120 > "$REPORT/ps_top_by_cpu.txt" 2>&1

{
  for pid in $(ps -eo pid --sort=-rss | awk 'NR>1 && NR<=21 {print $1}'); do
    echo "===== PID $pid ====="
    grep -E 'Name|State|Pid|PPid|Threads|VmPeak|VmSize|VmHWM|VmRSS|RssAnon|RssFile|RssShmem|VmData|VmStk|VmExe|VmLib|VmPTE|VmSwap|voluntary_ctxt_switches|nonvoluntary_ctxt_switches' /proc/$pid/status 2>/dev/null || true
    tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null; echo
    echo
  done
} > "$REPORT/process_status_top20_rss.txt" 2>&1
```

cgroup, container, OOM, GPU, and runtime state:

```bash
{
  mount | grep cgroup || true
  echo
  cat /proc/self/cgroup 2>/dev/null || true
  echo
  for f in /sys/fs/cgroup/cgroup.controllers /sys/fs/cgroup/memory.current /sys/fs/cgroup/memory.peak /sys/fs/cgroup/memory.max /sys/fs/cgroup/memory.high /sys/fs/cgroup/memory.events /sys/fs/cgroup/cpu.max /sys/fs/cgroup/cpuset.cpus.effective; do
    [ -e "$f" ] && echo "--- $f ---" && cat "$f"
  done
  echo
  command -v systemd-cgtop >/dev/null && timeout 5 systemd-cgtop -b -n 1 || true
  command -v systemctl >/dev/null && systemctl status systemd-oomd --no-pager 2>/dev/null || true
  command -v oomctl >/dev/null && oomctl 2>/dev/null || true
} > "$REPORT/cgroup_summary.txt" 2>&1

{
  dmesg -T 2>/dev/null | grep -Ei 'out of memory|oom|killed process|memory allocation failure|segfault|hung task|blocked for more than' | tail -300 || true
  command -v journalctl >/dev/null && journalctl -k --since '3 days ago' --no-pager 2>/dev/null | grep -Ei 'out of memory|oom|killed process|memory allocation failure|segfault|hung task|blocked for more than' | tail -500 || true
} > "$REPORT/oom_and_kernel_logs.txt" 2>&1

if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  { docker stats --no-stream; echo; docker system df; } > "$REPORT/docker_container_stats.txt" 2>&1
fi

if command -v nvidia-smi >/dev/null; then
  { nvidia-smi; echo; nvidia-smi pmon -c 3 2>/dev/null || true; } > "$REPORT/gpu_nvidia.txt" 2>&1
fi

{
  for bin in python python3 pip pip3 node npm pnpm yarn java javac go rustc cargo dotnet gcc g++ clang clang++ cmake ninja make git docker kubectl; do
    if command -v "$bin" >/dev/null 2>&1; then
      echo
      echo "--- $bin ---"
      command -v "$bin"
      "$bin" --version 2>&1 | head -10 || true
    fi
  done
} > "$REPORT/runtime_versions.txt" 2>&1
```

Optional workload benchmark:

```bash
/usr/bin/time -v <your command> 2> "$REPORT/workload_time_verbose.txt"
command -v perf >/dev/null && perf stat -d -d -d -- <your command> > "$REPORT/workload_perf_stat.txt" 2>&1
```

Warn before sharing reports. Process lists, command lines, paths, logs, profiler output, and runtime output can expose usernames, tokens, project names, ports, and company repositories.

## Interpretation

| Evidence | Action |
| --- | --- |
| `MemAvailable` healthy, `vmstat si/so` zero, PSI low | Stop optimizing memory; benchmark/profile code or inspect CPU/I/O. |
| `MemAvailable` low, sustained `so`, `pswpout` growth, memory PSI rising | Find high RSS/PSS/USS/VmSwap processes; reduce batch size, worker count, cache size, or container limits. |
| `pgmajfault` grows with I/O pressure | Inspect mmap, data reads, page cache misses, storage, and network mounts. |
| RSS high but `RssFile` high | Do not call it a leak yet; inspect PSS/USS or `smaps_rollup`. |
| `RssAnon` or `VmData` grows over time | Suspect heap growth or unbounded cache; use language memory profiler or Massif. |
| cgroup `memory.events high` grows | Service/container is being throttled by `memory.high`; adjust limit or reduce workload peak. |
| cgroup `memory.events oom_kill` grows | Container/service OOM; raise limit or reduce memory peak. |
| CPU user high | Use `perf record`, language profiler, or runtime profiler. |
| CPU system high | Inspect syscalls, I/O, networking, locks, kernel hotspots, and security/file watchers. |
| iostat `await`/`util` high and CPU low | Inspect process I/O with `pidstat -d`; avoid slow mounts and small-file bind mounts. |
| GPU util low with CPU or disk busy | Check dataloader, host-to-device copies, CPU fallback, and batch sizing. |

## Code Benchmarking

Use one reproducible command, fixed input, same power/cgroup limits, same storage path, and same git commit.

```bash
/usr/bin/time -v <your command>
```

Record:

```text
command
input_size
repeat_count
wall_time
user_time
sys_time
cpu_percent
max_rss
major_page_faults
minor_page_faults
filesystem_inputs
filesystem_outputs
exit_code
git_commit
runtime_version
container_limit
cpu_quota
```

If `hyperfine` is already installed, use it for repeated timing:

```bash
hyperfine --warmup 3 '<your command>'
```

Do not install a benchmarking tool just to start diagnosis. `/usr/bin/time -v` is enough for the first pass.

## Profiling

CPU overview and native hotspots:

```bash
perf stat -d -d -d -- <your command>
perf record -F 99 -g -- <your command>
perf report
```

Python CPU:

```bash
python3 -m cProfile -o profile.prof your_script.py
python3 - <<'PY'
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

Native heap:

```bash
valgrind --tool=massif --stacks=yes ./your_binary arg1 arg2
ms_print massif.out.<PID> | less
```

JVM:

```bash
jcmd <PID> VM.version
jcmd <PID> VM.flags
jcmd <PID> GC.heap_info
jcmd <PID> Thread.print
jcmd <PID> JFR.start name=profile settings=profile filename=profile.jfr duration=60s
```

NVIDIA GPU:

```bash
nvidia-smi
nvidia-smi dmon -s pucvmet -d 1
nvidia-smi pmon -c 5
nsys profile -o nsys_report python3 train.py
```

## Process Fields

When summarizing Linux processes, include:

```text
rank
pid
ppid
user
state
nice
priority
cpu_id
%cpu
%mem
rss_mb
vsz_mb
pss_mb
uss_mb
vmhwm_mb
vmswap_mb
threads
fd_count
elapsed
comm
args
suspected_reason
recommended_action
```

RSS is useful for sorting, but shared libraries, mmap files, and shared memory can exaggerate totals. Use PSS/USS, `smaps_rollup`, or `smem` when attribution matters.

## Containers and cgroups

Always inspect cgroups when the workload runs under systemd, Docker, Kubernetes, CI, or a hosted VM:

```bash
cat /proc/self/cgroup
cat /sys/fs/cgroup/memory.current
cat /sys/fs/cgroup/memory.peak
cat /sys/fs/cgroup/memory.max
cat /sys/fs/cgroup/memory.high
cat /sys/fs/cgroup/memory.events
cat /sys/fs/cgroup/cpu.max
cat /sys/fs/cgroup/cpuset.cpus.effective
docker stats --no-stream
```

| Evidence | Action |
| --- | --- |
| Host has memory but cgroup `oom_kill` grows | Raise container/service limit or reduce workload peak. |
| `memory.events high` grows without OOM | Raise `memory.high`, split workload, or reduce peak memory. |
| `cpu.max` quota is small | Raise CPU quota or lower worker count. |
| `cpuset.cpus.effective` is narrow | Adjust cpuset or worker count. |
| Docker memory is near limit | Optimize container workload before changing host-wide settings. |

## Report Template

```text
# Linux Performance Diagnostic Report

## Context
- Date/time:
- Distro:
- Kernel:
- Machine/VM/container:
- CPU:
- Cores/threads:
- NUMA:
- RAM:
- Swap:
- Disk/filesystem:
- GPU:
- Workload command:
- Input size:
- Runtime versions:

## System Summary
- Load average:
- MemTotal:
- MemAvailable:
- SwapTotal / SwapFree:
- vmstat si/so:
- pswpin / pswpout delta:
- pgmajfault delta:
- PSI cpu some/full:
- PSI memory some/full:
- PSI io some/full:
- CPU user/sys/iowait/steal:
- Disk await/util:
- OOM logs:
- cgroup memory.current / max / peak / events:

## Top Processes
- Top RSS:
- Top CPU:
- Top I/O:
- Suspicious growth:

## Code Benchmark
- command:
- wall time:
- user time:
- sys time:
- CPU %:
- max RSS:
- major page faults:
- filesystem inputs:
- filesystem outputs:
- perf stat summary:
- profiler top entries:

## Diagnosis
- Primary bottleneck:
- Evidence:
- Secondary bottleneck:
- Non-bottlenecks:
- Confidence:

## Action
- Smallest recommended change:
- Risk:
- Rollback or undo:
- Re-test command:
```

## Avoid

- Memory cleaners and scheduled `echo 3 > /proc/sys/vm/drop_caches`.
- Blindly tuning `swappiness`.
- Disabling swap as a first-line fix.
- Killing system processes.
- Inferring leaks by summing RSS.
- Ignoring cgroup limits when inside containers, services, CI, or hosted VMs.
- Installing profilers before built-in evidence shows the gap.
