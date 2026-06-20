# Computer Care Skills

[中文](README.md) | **English** | [日本語](README.ja.md)

A suite of skills for local computer management, maintenance, and automation — diagnosis, repair, cleanup, path handling, workstation tuning, process monitoring, file watching, and more. Supports macOS, Windows, and Linux.

Core principle: diagnose first, suggest second; run read-only checks before making the smallest reversible change. When deleting files, modifying system settings, killing processes, changing network config, or setting up persistent automation, always state scope, risk, rollback method, and verification upfront.

## Skill Map

```
Computer Care
├─ Diagnose & Repair  ─── computer-health    network-optimize    permissions-fix
├─ Cleanup & Maintain  ─── storage-clean      path-convert        desktop-tune
├─ Monitor & Automate  ─── processes-monitor  folder-watch
└─ Codex Self-Care     ─── codex-optimize
```

## Install

```bash
npx skills add VintLin/computer-care-skills
```

List available skills:

```bash
npx skills add VintLin/computer-care-skills --list
```

Install a single skill:

```bash
npx skills add VintLin/computer-care-skills --skill computer-health
```

## Skills

### Diagnose & Repair

| Skill | Purpose | Typical Use |
| --- | --- | --- |
| `computer-health` | Health check & performance diagnosis | Slow computer, memory pressure, heavy swap/pagefile, CPU saturation, thermal throttling, disk I/O, code benchmark/profiling (macOS / Windows / Linux) |
| `network-optimize` | Network diagnosis & optimization | Slow network, high latency, packet loss, DNS delays, Wi-Fi/Ethernet, MTU, VPN/proxy/TUN conflicts (macOS / Windows / Linux) |
| `permissions-fix` | macOS permission repair | Operation not permitted, Full Disk Access, TCC permission drift, background task permission denial |

### Cleanup & Maintain

| Skill | Purpose | Typical Use |
| --- | --- | --- |
| `storage-clean` | Storage cleanup | Low disk space, cache bloat, Downloads cleanup, Docker/Podman/WSL usage, package manager caches (macOS / Windows / Linux) |
| `path-convert` | Cross-platform path conversion | Windows UNC ↔ macOS smb://, /Volumes paths, path opening, file listing |
| `desktop-tune` | macOS workstation tuning | Always-on power, battery health, sleep/wake issues, USB/audio device dropouts, display sleep |

### Monitor & Automate

| Skill | Purpose | Typical Use |
| --- | --- | --- |
| `processes-monitor` | Long-running process monitoring | Heartbeat, logs, timeout, and status for background commands, scripts, builds, downloads |
| `folder-watch` | Folder change automation | Watch a directory, run commands on change, restart local services, trigger backups or alerts |

### Codex Self-Care

| Skill | Purpose | Typical Use |
| --- | --- | --- |
| `codex-optimize` | Codex local state maintenance | `.codex` session/log/worktree/config bloat cleanup, thread metadata bloat, provider metadata sync |

## Usage

Install and describe your problem in plain language:

```text
My Mac disk is almost full — find what I can safely clean up.
```

```text
Convert \\server\share\project to a path I can open in macOS Finder.
```

```text
My browser is slow when VPN is on, but curl in terminal is fine — help me diagnose.
```

```text
My Mac memory looks full and code runs slow — run a health check and find the bottleneck.
```

```text
Watch my Downloads folder and run a script when new files appear.
```

## How It Works

All skills follow the same workflow:

1. Collect symptoms, environment info, paths, error messages, or metrics.
2. Run read-only diagnostics first — don't touch system settings or delete files yet.
3. Rank candidate actions by risk; explain why each is recommended or not.
4. For high-impact actions, confirm goals and scope first.
5. Verify results with the same metrics or commands.
6. Output conclusions, causes, risks, next steps, and rollback options.

## Safety Boundaries

Unless the goal and scope are explicitly confirmed, these skills will not by default:

- Delete user files, empty Trash, or batch irreversible deletions.
- Kill processes, restart services, uninstall software, or modify persistent tasks.
- Change DNS, MTU, routes, VPNs, proxies, or system network services.
- Reset macOS TCC permissions, edit the permissions database, or bypass system protection.
- Run high-impact cleanup (full Docker prune, deleting model caches, or removing toolchains).
- Set up automation for security monitoring, forensic monitoring, or unauthorized access.

## License

MIT License. See [LICENSE](LICENSE).
