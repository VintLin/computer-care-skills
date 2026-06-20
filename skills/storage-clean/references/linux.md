# Linux Storage Cleanup Reference

## Read-Only Baseline

Measure the filesystem that is actually full before proposing cleanup:

```bash
df -hT
df -ih
findmnt -D 2>/dev/null || true
```

Then locate large directories without crossing filesystem boundaries:

```bash
sudo du -xhd1 / 2>/dev/null | sort -h
sudo du -xhd1 /var /home /usr /opt 2>/dev/null | sort -h
```

Use the bundled cache audit when available:

```bash
bash scripts/cache-audit.sh
```

The script is read-only. On Linux it measures common user-level developer caches and any readable system package/container cache directories. It does not use `sudo`, delete files, or inspect container storage internals.

## Linux-Specific Triage

Linux cleanup starts with mountpoints, not folders. `/`, `/home`, `/var`, `/boot`, container data directories, and Btrfs subvolumes can be separate capacity boundaries.

Check both block usage and inode pressure:

```bash
df -hT /
df -ih /
```

Check deleted-but-open files when `df` and `du` disagree:

```bash
sudo lsof +L1
```

If a large deleted file is still held open, restart or reload the owning service instead of deleting more files.

## User File Triage

List large user-created files before proposing deletion:

```bash
find "$HOME" -xdev -type f -size +1G -printf '%s\t%TY-%Tm-%Td\t%p\n' 2>/dev/null |
  sort -n |
  numfmt --field=1 --to=iec

du -shx "$HOME"/Downloads "$HOME"/Desktop "$HOME"/Documents "$HOME"/Videos 2>/dev/null | sort -h
```

Treat old ISOs, archives, screen recordings, exports, datasets, model weights, and training outputs as medium or high risk. Do not delete based only on age.

## Disposable Cache Targets

| Area | Inspect | Cleanup note |
| --- | --- | --- |
| systemd journal | `journalctl --disk-usage` | Use `journalctl --rotate` before `--vacuum-time` or `--vacuum-size` |
| tmpfiles | `systemd-tmpfiles --cat-config` | Prefer `sudo systemd-tmpfiles --clean` over manual `/tmp` deletion |
| APT | `du -sh /var/cache/apt/archives`; `sudo apt-get -s autoremove` | `apt autoclean` and `apt clean` are lower risk; review autoremove |
| DNF | `du -sh /var/cache/dnf`; `dnf list --autoremove` | `dnf clean packages/all` is lower risk; review autoremove |
| Zypper | `du -sh /var/cache/zypp` | `zypper clean`; `zypper clean --all` also removes metadata |
| Pacman | `du -sh /var/cache/pacman/pkg` | Prefer `paccache -r`; `pacman -Scc` is more aggressive |
| APK | `du -sh /var/cache/apk` | `apk cache clean` removes old cached packages |
| Flatpak | `du -sh /var/lib/flatpak "$HOME/.local/share/flatpak"` | Use `flatpak uninstall --unused`; do not delete object stores manually |
| Snap | `du -sh /var/lib/snapd "$HOME/snap"`; `snap list --all` | Remove only reviewed disabled old revisions; `refresh.retain=2` limits future retention |
| Docker | `docker system df` | `docker system prune` first; volumes need separate high-risk confirmation |
| Podman | `podman system df` | `podman system prune`; `--all --volumes` needs stronger confirmation |
| Btrfs/Snapper | `btrfs filesystem usage /`; `snapper list` | Use Snapper/Timeshift tools; do not manually delete snapshot directories |

## Developer Cache Cleanup

| Tool | Inspect | Cleanup | Risk |
| --- | --- | --- | --- |
| uv | `uv cache dir` | `uv cache prune` or `uv cache clean` | Low/medium; future installs may redownload or rebuild |
| pip | `python -m pip cache info` | `python -m pip cache purge` | Low; packages may redownload |
| npm | `npm cache verify` | `npm cache clean --force` | Low; npm treats cache as self-healing |
| Go | `go env GOCACHE GOMODCACHE` | `go clean -cache -testcache`; `go clean -modcache` | Module cache cleanup has higher rebuild/redownload cost |
| Cargo/Rust | `du -sh target ~/.cargo` | `cargo clean` inside reviewed old projects | Medium; rebuild cost can be large |
| Conda | `conda clean --all --dry-run` | `conda clean --all` | Medium; inspect dry-run first |
| Playwright | `du -sh ~/.cache/ms-playwright` | `npx playwright uninstall --all` | Low/medium; browsers redownload |
| Hugging Face | `hf cache ls` | `hf cache prune --dry-run`; `hf cache prune` | Medium/high; model redownload cost can be large |

## Safer Cleanup Commands

These still require approval:

```bash
sudo journalctl --rotate
sudo journalctl --vacuum-time=14d
sudo journalctl --vacuum-size=1G
sudo systemd-tmpfiles --clean
sudo apt autoclean
sudo apt clean
sudo dnf clean packages
sudo dnf clean all
sudo zypper clean
sudo zypper clean --all
sudo apk cache clean
flatpak uninstall --unused
uv cache prune
python -m pip cache purge
npm cache verify
npm cache clean --force
go clean -cache -testcache
hf cache prune --dry-run
hf cache prune
docker system prune
podman system prune
```

Require stronger explicit confirmation:

```bash
sudo apt-get -s autoremove
sudo apt autoremove
dnf list --autoremove
sudo dnf autoremove
go clean -modcache
conda clean --all --dry-run
conda clean --all
npx playwright uninstall --all
docker system prune -a --volumes
podman system prune --all --volumes
sudo snapper cleanup number
sudo snapper cleanup timeline
rm -rf <specific-reviewed-path>
```

## Linux-Specific Precautions

- Do not treat `/var/cache` and `/var/lib` as equivalent. `/var/cache` is usually rebuildable; `/var/lib` is persistent state.
- Do not manually delete `/var/lib/dpkg`, `/var/lib/rpm`, `/var/lib/pacman`, `/var/lib/docker`, `/var/lib/containers`, databases, Kubernetes state, or libvirt images.
- If `/boot` is full, audit with `df -hT /boot`, `uname -r`, and `ls -lh /boot`, then use distro package tooling. Do not manually remove random kernel files.
- Do not delete Docker/Podman overlay or storage directories directly.
- Do not prune Docker/Podman volumes without naming the impact; volumes may contain databases or application state.
- Do not manually delete Btrfs/Snapper/Timeshift snapshot directories. Snapshots can keep deleted data referenced.
- Prefer journald vacuum and logrotate over deleting active log files.
- Avoid clearing entire `~/.cache`; it can contain model caches, IDE indexes, application state, or files in active use.
- On multi-user systems, do not clean other users' directories without explicit authorization and scope.

## Good Default Order

1. Confirm mountpoint and inode pressure with `df -hT` and `df -ih`.
2. Use `du -xhd1` on the full filesystem to find the real large directories.
3. Check journald, package-manager caches, Flatpak/Snap, and tmpfiles.
4. Audit Docker/Podman with runtime commands before any prune.
5. Audit developer caches and list exact low-risk tool-managed cleanup commands.
6. Triage user Downloads/Desktop/Documents/Videos only after listing files.
7. Check Btrfs/Snapper/Timeshift snapshots when reclaimed space does not match expectations.
8. Leave databases, volumes, VMs, model weights, and project data untouched unless the user selects exact targets.
9. Re-run the same `df`, `du`, and tool-specific measurements after cleanup.
