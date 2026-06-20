# Windows Performance Diagnostics

## Principle

Prefer read-only measurement before cleanup, process kills, or settings changes. Do not diagnose Windows memory pressure from Task Manager's memory percentage alone. Use Available MBytes, committed bytes versus commit limit, `% Committed Bytes In Use`, `Pages Output/sec`, pagefile usage, process Working Set, process Private Bytes, hard faults, disk I/O, WSL/Docker pressure, and profiler output together.

`Memory\Pages/sec` is easy to misread. If paging is suspected, `Memory\Pages Output/sec` is the stronger signal because it shows pages written to the pagefile to free RAM.

## Read-Only Collection

Run in an Administrator PowerShell when possible. The commands collect evidence only; they do not kill processes or change settings.

```powershell
$ErrorActionPreference = "Continue"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Report = Join-Path ([Environment]::GetFolderPath("Desktop")) "win_diag_$stamp"
New-Item -ItemType Directory -Force -Path $Report | Out-Null

function Save-Text {
    param([string]$Name, [scriptblock]$Block)
    $Path = Join-Path $Report $Name
    try {
        & $Block | Out-String -Width 300 | Out-File -FilePath $Path -Encoding UTF8
    } catch {
        "ERROR: $($_.Exception.Message)" | Out-File -FilePath $Path -Encoding UTF8
    }
}

function Export-CsvSafe {
    param([string]$Name, [object]$Data)
    $Path = Join-Path $Report $Name
    try {
        $Data | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $Path
    } catch {
        "ERROR: $($_.Exception.Message)" | Out-File -FilePath ($Path + ".error.txt") -Encoding UTF8
    }
}

"Report directory: $Report" | Tee-Object -FilePath (Join-Path $Report "README.txt")

Save-Text "timestamp.txt" { Get-Date }
Save-Text "whoami_all.txt" { whoami /all }
Save-Text "systeminfo.txt" { systeminfo }
Save-Text "computer_info.txt" { Get-ComputerInfo }
Save-Text "environment_path.txt" { $env:Path -split ';' }

Export-CsvSafe "os.csv" (
    Get-CimInstance Win32_OperatingSystem |
    Select-Object Caption, Version, BuildNumber, OSArchitecture, LastBootUpTime,
        TotalVisibleMemorySize, FreePhysicalMemory, TotalVirtualMemorySize, FreeVirtualMemory
)

Export-CsvSafe "computer_system.csv" (
    Get-CimInstance Win32_ComputerSystem |
    Select-Object Manufacturer, Model, SystemType, TotalPhysicalMemory,
        NumberOfProcessors, NumberOfLogicalProcessors, HypervisorPresent
)

Export-CsvSafe "cpu.csv" (
    Get-CimInstance Win32_Processor |
    Select-Object Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors,
        MaxClockSpeed, CurrentClockSpeed, L2CacheSize, L3CacheSize
)

Export-CsvSafe "gpu.csv" (
    Get-CimInstance Win32_VideoController |
    Select-Object Name, DriverVersion, AdapterRAM, CurrentHorizontalResolution, CurrentVerticalResolution
)

Export-CsvSafe "logical_disks.csv" (
    Get-CimInstance Win32_LogicalDisk |
    Select-Object DeviceID, DriveType, FileSystem, VolumeName,
        @{n="SizeGB";e={[math]::Round($_.Size / 1GB, 2)}},
        @{n="FreeGB";e={[math]::Round($_.FreeSpace / 1GB, 2)}}
)

Export-CsvSafe "pagefile_usage.csv" (
    Get-CimInstance Win32_PageFileUsage |
    Select-Object Name, AllocatedBaseSize, CurrentUsage, PeakUsage
)

Export-CsvSafe "pagefile_setting.csv" (
    Get-CimInstance Win32_PageFileSetting |
    Select-Object Name, InitialSize, MaximumSize
)

Save-Text "powercfg_active_scheme.txt" { powercfg /getactivescheme }
Save-Text "powercfg_available_sleep_states.txt" { powercfg /a }
Save-Text "powercfg_requests.txt" { powercfg /requests }
try { powercfg /batteryreport /output (Join-Path $Report "battery_report.html") | Out-Null } catch {}

$processSnapshot = Get-Process | ForEach-Object {
    $p = $_
    $start = $null
    $path = $null
    try { $start = $p.StartTime } catch {}
    try { $path = $p.Path } catch {}

    [pscustomobject]@{
        Id          = $p.Id
        ProcessName = $p.ProcessName
        CPU_sec     = $p.CPU
        WS_MB       = [math]::Round($p.WorkingSet64 / 1MB, 2)
        Private_MB  = [math]::Round($p.PrivateMemorySize64 / 1MB, 2)
        Virtual_MB  = [math]::Round($p.VirtualMemorySize64 / 1MB, 2)
        Paged_MB    = [math]::Round($p.PagedMemorySize64 / 1MB, 2)
        NonPaged_MB = [math]::Round($p.NonpagedSystemMemorySize64 / 1MB, 2)
        Handles     = $p.HandleCount
        ThreadCount = $p.Threads.Count
        StartTime   = $start
        Path        = $path
    }
}

Export-CsvSafe "processes_all_getprocess.csv" $processSnapshot
Export-CsvSafe "processes_top100_by_workingset.csv" ($processSnapshot | Sort-Object WS_MB -Descending | Select-Object -First 100)
Export-CsvSafe "processes_top100_by_privatebytes.csv" ($processSnapshot | Sort-Object Private_MB -Descending | Select-Object -First 100)
Export-CsvSafe "processes_top100_by_cpu_total.csv" ($processSnapshot | Sort-Object CPU_sec -Descending | Select-Object -First 100)
Export-CsvSafe "processes_top100_by_handles.csv" ($processSnapshot | Sort-Object Handles -Descending | Select-Object -First 100)

Export-CsvSafe "processes_wmi_commandline.csv" (
    Get-CimInstance Win32_Process |
    Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine,
        CreationDate, ThreadCount, HandleCount, WorkingSetSize, PrivatePageCount,
        VirtualSize, PageFaults, UserModeTime, KernelModeTime
)

Export-CsvSafe "processes_perf_snapshot.csv" (
    Get-CimInstance Win32_PerfFormattedData_PerfProc_Process |
    Where-Object { $_.Name -ne "_Total" -and $_.IDProcess -gt 0 } |
    Select-Object IDProcess, Name, PercentProcessorTime, PercentUserTime, PercentPrivilegedTime,
        PrivateBytes, WorkingSet, VirtualBytes, PageFileBytes, PageFaultsPersec,
        IOReadBytesPersec, IOWriteBytesPersec, IODataBytesPersec,
        ThreadCount, HandleCount, ElapsedTime
)

$samples = for ($i = 1; $i -le 15; $i++) {
    $mem  = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
    $cpu  = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor | Where-Object { $_.Name -eq "_Total" }
    $sys  = Get-CimInstance Win32_PerfFormattedData_PerfOS_System
    $disk = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Where-Object { $_.Name -eq "_Total" }

    [pscustomobject]@{
        Timestamp                  = Get-Date -Format o
        AvailableMBytes            = $mem.AvailableMBytes
        PercentCommittedBytesInUse = $mem.PercentCommittedBytesInUse
        CommittedBytes             = $mem.CommittedBytes
        CommitLimit                = $mem.CommitLimit
        PagesPersec                = $mem.PagesPersec
        PagesInputPersec           = $mem.PagesInputPersec
        PagesOutputPersec          = $mem.PagesOutputPersec
        PageReadsPersec            = $mem.PageReadsPersec
        PageWritesPersec           = $mem.PageWritesPersec
        CacheBytes                 = $mem.CacheBytes
        PoolPagedBytes             = $mem.PoolPagedBytes
        PoolNonpagedBytes          = $mem.PoolNonpagedBytes
        CPUPercent                 = $cpu.PercentProcessorTime
        CPUPrivilegedPercent       = $cpu.PercentPrivilegedTime
        CPUUserPercent             = $cpu.PercentUserTime
        ProcessorQueueLength       = $sys.ProcessorQueueLength
        ContextSwitchesPersec      = $sys.ContextSwitchesPersec
        DiskReadBytesPersec        = $disk.DiskReadBytesPersec
        DiskWriteBytesPersec       = $disk.DiskWriteBytesPersec
        DiskReadsPersec            = $disk.DiskReadsPersec
        DiskWritesPersec           = $disk.DiskWritesPersec
        AvgDiskSecPerRead          = $disk.AvgDisksecPerRead
        AvgDiskSecPerWrite         = $disk.AvgDisksecPerWrite
        CurrentDiskQueueLength     = $disk.CurrentDiskQueueLength
        PercentDiskTime            = $disk.PercentDiskTime
        PercentIdleTime            = $disk.PercentIdleTime
    }

    Start-Sleep -Seconds 1
}
Export-CsvSafe "perf_samples_1s_15s.csv" $samples

Export-CsvSafe "startup_commands.csv" (
    Get-CimInstance Win32_StartupCommand |
    Select-Object Name, Command, Location, User
)

Export-CsvSafe "services.csv" (
    Get-Service |
    Select-Object Name, DisplayName, Status, StartType, ServiceType, CanStop
)

try {
    Export-CsvSafe "scheduled_tasks.csv" (
        Get-ScheduledTask | Select-Object TaskName, TaskPath, State
    )
} catch {}

try {
    Export-CsvSafe "tcp_connections.csv" (
        Get-NetTCPConnection |
        Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess
    )
} catch {}

try { Save-Text "defender_status.txt" { Get-MpComputerStatus } } catch {}

try {
    $start = (Get-Date).AddDays(-3)
    Export-CsvSafe "system_events_last3days.csv" (
        Get-WinEvent -FilterHashtable @{LogName="System"; Level=1,2,3; StartTime=$start} -ErrorAction SilentlyContinue |
        Select-Object TimeCreated, ProviderName, Id, LevelDisplayName, Message
    )
    Export-CsvSafe "application_events_last3days.csv" (
        Get-WinEvent -FilterHashtable @{LogName="Application"; Level=1,2,3; StartTime=$start} -ErrorAction SilentlyContinue |
        Select-Object TimeCreated, ProviderName, Id, LevelDisplayName, Message
    )
} catch {}

if (Get-Command wsl.exe -ErrorAction SilentlyContinue) {
    Save-Text "wsl_status.txt" { wsl.exe --status }
    Save-Text "wsl_list_verbose.txt" { wsl.exe --list --verbose }
}

if (Get-Command docker.exe -ErrorAction SilentlyContinue) {
    Save-Text "docker_version.txt" { docker version }
    Save-Text "docker_system_df.txt" { docker system df }
    Save-Text "docker_stats_no_stream.txt" { docker stats --no-stream }
}

Save-Text "runtime_versions.txt" {
    $bins = @("python", "python3", "py", "node", "npm", "java", "go", "rustc", "cargo", "dotnet", "git", "wsl", "docker")
    foreach ($bin in $bins) {
        $cmd = Get-Command $bin -ErrorAction SilentlyContinue
        if ($cmd) {
            "`n--- $bin ---"
            "Path: $($cmd.Source)"
            try { & $bin --version 2>&1 | Select-Object -First 5 } catch {}
        }
    }
}

"Done: $Report" | Tee-Object -FilePath (Join-Path $Report "DONE.txt")
```

Most useful files:

```text
perf_samples_1s_15s.csv
processes_top100_by_privatebytes.csv
processes_top100_by_workingset.csv
processes_perf_snapshot.csv
processes_wmi_commandline.csv
pagefile_usage.csv
logical_disks.csv
runtime_versions.txt
wsl_status.txt
docker_stats_no_stream.txt
system_events_last3days.csv
```

Warn before sharing reports. `processes_wmi_commandline.csv`, event logs, paths, ports, and runtime output can expose usernames, project names, command-line arguments, tokens, and company repositories.

## Code Benchmarking

Use one reproducible command, fixed input, same power state, and same git commit.

Quick wall-time check:

```powershell
Measure-Command { python .\your_script.py }
```

Peak working set and Private Bytes wrapper:

```powershell
$exe = "python"
$argList = @(".\your_script.py")

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$p = Start-Process -FilePath $exe -ArgumentList $argList -PassThru

$peakWS = 0
$peakPrivate = 0
while (-not $p.HasExited) {
    try {
        $p.Refresh()
        $peakWS = [Math]::Max($peakWS, $p.PeakWorkingSet64)
        $peakPrivate = [Math]::Max($peakPrivate, $p.PrivateMemorySize64)
    } catch {}
    Start-Sleep -Milliseconds 200
}
$sw.Stop()

[pscustomobject]@{
    ExitCode       = $p.ExitCode
    WallSeconds    = [Math]::Round($sw.Elapsed.TotalSeconds, 3)
    PeakWS_MB      = [Math]::Round($peakWS / 1MB, 2)
    PeakPrivate_MB = [Math]::Round($peakPrivate / 1MB, 2)
}
```

If `hyperfine` is already installed, use it for repeated timing:

```powershell
hyperfine --warmup 3 "python .\your_script.py"
```

Do not install a benchmarking tool just to start diagnosis. Built-in PowerShell is enough for the first pass.

## Profiling

Python CPU:

```powershell
python -m cProfile -o profile.prof .\your_script.py
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

.NET first pass:

```powershell
dotnet-counters ps
dotnet-counters monitor --process-id <PID>
dotnet-trace ps
dotnet-trace collect --process-id <PID> --output trace.nettrace
```

When PowerShell shows who is busy but not why, use WPR/WPA:

```powershell
wpr -profiles
wpr -start GeneralProfile.light -filemode
# run the slow operation once
wpr -stop "$env:USERPROFILE\Desktop\windows_perf_trace.etl"
```

Open the ETL in Windows Performance Analyzer and inspect CPU Usage, Disk Usage, File I/O, Thread Activity, DPC/ISR, and heap/VirtualAlloc views when enabled. Keep `-filemode` traces short because they can grow quickly.

## Interpretation

| Evidence | Action |
| --- | --- |
| Available MBytes not low, Pages Output/sec near 0, pagefile usage stable | Stop optimizing memory; benchmark/profile code or inspect CPU/I/O. |
| Available MBytes low, `% Committed Bytes In Use` high, Pages Output/sec sustained | Find high Private Bytes processes; reduce batch size, worker count, Docker/WSL limits, or heavy apps. |
| `Pages/sec` high but Pages Output/sec low | Do not call it RAM pressure yet; inspect disk I/O, hard faults, and file cache behavior. |
| One process Private Bytes grows over time | Suspect leak or unbounded cache; use language or Visual Studio memory profiling. |
| Working Set high but Private Bytes normal | Check shared pages, mapped files, and cache with RAMMap or Process Explorer before acting. |
| Commit approaches Commit Limit | Check whether pagefile is disabled or too small; do not disable pagefile. |
| PoolNonpagedBytes unusually high | Suspect driver, security software, virtualization, or network filter; consider WPR/pool tooling. |
| Disk I/O high without memory pressure | Identify build, cache, indexer, Defender, sync, database, or Docker writer before cleanup. |
| `vmmem` or `VmmemWSL` dominates memory | Inspect WSL/Docker config; cap VM/container memory when supported. |

## Process Fields

When summarizing Windows processes, include:

```text
rank
pid
ppid
process_name
path
command_line
cpu_percent_snapshot
cpu_total_seconds
working_set_mb
private_bytes_mb
virtual_bytes_mb
pagefile_bytes_mb
page_faults_per_sec
io_read_bytes_per_sec
io_write_bytes_per_sec
thread_count
handle_count
start_time
suspected_reason
recommended_action
```

## WSL and Docker

For WSL:

```powershell
wsl --status
wsl --list --verbose
```

WSL 2 global limits live in `%UserProfile%\.wslconfig`:

```ini
[wsl2]
memory=8GB
processors=6
swap=4GB
```

Apply changes with:

```powershell
wsl --shutdown
```

For Linux command-line workloads, keep source under the WSL filesystem such as `/home/<user>/Project`. Avoid compiling Linux projects from `/mnt/c/Users/...`.

For Docker Desktop:

```powershell
docker stats --no-stream
docker system df
```

Stop unused containers and prune only disposable images/containers after confirming volumes are not needed. Avoid deleting database volumes blindly. For many small files, reduce cross-filesystem bind mounts and prefer VM-local storage or named volumes.

## Build and I/O Slowness

Common causes:

```text
node_modules / .venv / target / build / dist / .gradle / .m2 / .cargo
Docker bind mounts
Microsoft Defender scans
Windows Search indexing
cloud sync folders
log-heavy processes
local database data directories
```

Use Process Monitor or WPA File I/O when the collection shows disk pressure. On Windows 11 developer machines, consider Dev Drive for repositories, build output, package caches, and intermediate files instead of globally disabling Defender.

## Report Template

```text
# Windows Performance Diagnostic Report

## Context
- Date/time:
- Windows edition/build:
- Machine model:
- CPU:
- Physical cores/logical processors:
- RAM:
- GPU:
- Disk type/free space:
- Power plan:
- Battery/AC:
- WSL/Docker enabled:
- Workload command:
- Input size:
- Repeat count:

## System Summary
- Available MBytes:
- Committed Bytes:
- Commit Limit:
- % Committed Bytes In Use:
- Pages/sec:
- Pages Output/sec:
- Pagefile current/peak usage:
- CPU %:
- Processor Queue Length:
- Disk read/write bytes/sec:
- Avg Disk sec/read:
- Avg Disk sec/write:
- Top event log errors:

## Top Processes
- Top Private Bytes:
- Top Working Set:
- Top CPU:
- Top I/O:
- Suspicious growth:

## Runtime / Toolchain
- Python:
- Node:
- Java:
- Go:
- Rust:
- .NET:
- Git:
- WSL:
- Docker:
- Project location:
- Cache directories:

## Code Benchmark
- command:
- wall time:
- peak working set:
- peak private bytes:
- profiler top entries:
- memory allocation top entries:
- I/O hotspots:
- WPR/WPA findings:

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

## Common Mistakes

- Do not disable the pagefile as a performance fix.
- Do not globally disable Defender as a first response.
- Do not use memory cleaners.
- Do not end random system processes.
- Do not treat high Working Set alone as a leak.
- Do not put WSL Linux build workloads under `/mnt/c` when performance matters.
- Change one variable at a time and re-test with the same command, input, power state, and machine state.
