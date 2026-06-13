可以。Linux 版建议不要做成一个“通用 `rm -rf` 清理脚本”，而应按 **文件系统 / 发行版包管理器 / 日志 / 容器 / 快照 / 开发者缓存 / 用户文件** 分层处理。上传的 macOS skill 的核心原则仍然适用：**先测量、区分可重下缓存和用户数据、删除前列出风险并确认、清理后复测**。

下面是一份可直接改造成 Linux skill 的参考稿。

---

# Linux Clean Storage

```yaml
---
name: linux-clean-storage
description: Use when a user asks about low disk space, Linux disk usage, cache cleanup, package-manager cache pruning, journal/log cleanup, Docker/Podman bloat, Flatpak/Snap cleanup, Btrfs/Snapper/Timeshift snapshots, developer cache size, or safe ways to reclaim disk space on Linux.
---
```

## Overview

Linux 清理磁盘空间时，必须先确认**哪个挂载点**真的满了。`/`、`/home`、`/var`、`/boot`、容器数据盘、WSL 虚拟盘、Btrfs 子卷都可能是不同的容量边界。`df` 用来显示文件系统可用空间，`du` 用来统计目录树占用；`du -x` / `--one-file-system` 可以避免跨到其他挂载点。([man7.org][1])

Linux 的一个关键差异是 `/var` 的语义很复杂：它包含日志、spool、缓存、临时状态和持久应用状态。`/var/cache` 通常应可删除并由应用重建，但 `/var/lib` 是持久系统/应用数据，删除会造成数据丢失。([refspecs.linuxfoundation.org][2])

核心原则：

1. **Measure mountpoints first**：先看 `df -hT`、`df -ih`，确认是容量满还是 inode 满。
2. **Stay within one filesystem during audit**：用 `du -x` 避免误把其他挂载点算进来。
3. **Prefer tool-specific cleanup**：优先使用 `apt/dnf/zypper/paccache/apk`、`journalctl`、`docker/podman`、`flatpak/snap`、`hf/pip/npm/uv` 等官方命令。
4. **Never delete state directories blindly**：不要手删 `/var/lib/*`、`/var/lib/docker/overlay2`、`/var/lib/containers/storage`、`/var/lib/dpkg`、`/var/lib/rpm`、`/var/lib/pacman`。
5. **Treat snapshots as first-class storage users**：Btrfs/Snapper/Timeshift 快照可能让 `du` 和 `df` 看起来“不一致”。
6. **List before deleting**：报告路径、大小、风险、命令、是否可重建、是否需要停服务。

---

## When to Use

Use for:

* Linux 服务器、开发机、NAS、工作站磁盘不足。
* `/`、`/home`、`/var`、`/boot`、Docker 数据目录、Btrfs 子卷空间异常。
* APT/DNF/Zypper/Pacman/APK 包缓存清理。
* journald、传统日志、临时目录清理。
* Docker、Podman、container build cache、images、volumes 审计。
* Flatpak、Snap、旧 runtime、旧 revision 清理。
* Btrfs/Snapper/Timeshift 快照过多。
* Python/Node/Go/Rust/Conda/Playwright/Hugging Face 等开发缓存膨胀。
* 查找大文件、大目录、旧备份、模型权重、数据集、训练输出。

Do not use to:

* 自动删除用户文件、项目、数据库、照片、密钥、钱包、生产数据。
* 手动删除包管理器数据库。
* 手动删除容器 overlay/storage 内部目录。
* 未确认就 prune Docker/Podman volumes。
* 未确认就删除 Btrfs/Snapper/Timeshift 快照。
* 未确认就清空 `/tmp`、`/var/tmp`、`~/.cache`。
* 在多用户服务器上删除其他用户目录内容。

---

## Workflow

### 1. Measure disk pressure

```bash
df -hT
df -ih
findmnt -D 2>/dev/null || true
```

解释：

* `df -hT`：看挂载点、文件系统类型、总量、可用空间。
* `df -ih`：看 inode 是否耗尽。小文件、缓存、日志、邮件队列可能让 inode 先满。
* `findmnt -D`：有时比 `df` 更适合看挂载关系和空间。

`df` 的 `-h` 是 human-readable，`-i` 查看 inode，`-T` 显示文件系统类型。([man7.org][1])

---

### 2. Locate large top-level directories without crossing filesystems

```bash
sudo du -xhd1 / 2>/dev/null | sort -h
sudo du -xhd1 /var /home /usr /opt 2>/dev/null | sort -h
```

`du --max-depth` 可限制深度，`-h` 使用易读单位，`-x` / `--one-file-system` 会跳过不同文件系统上的目录，适合排查某个挂载点为什么满。([man7.org][3])

---

### 3. Inspect common Linux bloat areas

```bash
for p in \
  /var/cache \
  /var/log \
  /var/tmp \
  /tmp \
  /var/lib/docker \
  /var/lib/containers \
  /var/lib/flatpak \
  /var/lib/snapd \
  "$HOME/.cache" \
  "$HOME/.npm" \
  "$HOME/.cache/pip" \
  "$HOME/.cache/uv" \
  "$HOME/.cargo" \
  "$HOME/.cache/huggingface" \
  "$HOME/.cache/ms-playwright" \
  "$HOME/Downloads"
do
  [ -e "$p" ] && sudo du -shx "$p" 2>/dev/null
done | sort -h
```

这一步只测量，不删除。

---

### 4. Find large user-created files

```bash
find "$HOME" -xdev -type f -size +1G -printf '%s\t%TY-%Tm-%Td\t%p\n' 2>/dev/null |
  sort -n |
  numfmt --field=1 --to=iec
```

也可以按常见位置查：

```bash
du -shx "$HOME"/Downloads "$HOME"/Desktop "$HOME"/Documents "$HOME"/Videos 2>/dev/null | sort -h
```

用户文件默认属于 **medium/high risk**。旧 ISO、压缩包、录屏、导出文件可以列为候选，但不能自动删除。

---

### 5. Check deleted-but-open files

Linux 上删除文件后，如果进程仍然打开该文件，`du` 看不到它，但 `df` 可能仍显示空间未释放。常见于日志、数据库、容器、服务输出文件。可用 `lsof` 查找 open deleted files；SUSE 的支持文档也建议用 `lsof` 找仍被进程打开的已删除文件。([support.scc.suse.com][4])

```bash
sudo lsof +L1
```

如果发现某个服务持有巨大 deleted 文件，优先重启或 reload 对应服务，而不是继续删文件。

---

## Risk Groups

| Risk            | Examples                                                                     | Default action        |
| --------------- | ---------------------------------------------------------------------------- | --------------------- |
| Low             | 包下载缓存、构建缓存、可重下 runtime、旧浏览器测试二进制                                             | 列大小，优先用官方 clean/prune |
| Medium          | `/var/log` 归档日志、旧 ISO、旧安装包、旧压缩包、旧导出文件                                        | 列文件名/日期/大小，让用户确认      |
| High            | `/var/lib`、数据库、容器 volumes、Btrfs 快照、模型权重、训练输出、虚拟机镜像                           | 不自动删除                 |
| System-critical | `/var/lib/dpkg`、`/var/lib/rpm`、`/var/lib/pacman`、`/boot` 当前内核、容器 storage 内部层 | 不手动删除，使用对应工具          |

---

## Common Cleanup Targets

### 1. systemd journal

Inspect:

```bash
journalctl --disk-usage
```

Cleanup candidates:

```bash
sudo journalctl --rotate
sudo journalctl --vacuum-time=14d
sudo journalctl --vacuum-size=1G
```

`journalctl --disk-usage` 会显示 journal 文件占用；`--vacuum-size`、`--vacuum-time`、`--vacuum-files` 会清理最旧的 archived journal 文件。注意 vacuum 只影响 archived journal，active journal 不会直接被删除，所以通常先 `--rotate`。([man7.org][5])

Persistent limit example:

```ini
# /etc/systemd/journald.conf.d/size.conf
[Journal]
SystemMaxUse=1G
SystemKeepFree=2G
```

---

### 2. `/tmp` and `/var/tmp`

Prefer systemd tmpfiles:

```bash
sudo systemd-tmpfiles --clean
```

`systemd-tmpfiles` 的职责是按 `tmpfiles.d` 配置创建、删除、清理文件和目录，适合处理临时目录生命周期，而不是手动 `rm -rf /tmp/*`。([man7.org][6])

Do not blindly run:

```bash
sudo rm -rf /tmp/*
sudo rm -rf /var/tmp/*
```

原因：运行中的程序可能依赖 socket、lock、临时数据库、编辑器临时文件。

---

### 3. APT / Debian / Ubuntu

Inspect:

```bash
du -sh /var/cache/apt/archives /var/lib/apt/lists 2>/dev/null
sudo apt-get -s autoremove
```

Cleanup:

```bash
sudo apt autoclean
sudo apt clean
sudo apt autoremove
```

`apt-get clean` 会清理 `/var/cache/apt/archives` 中已下载包文件；`autoclean` 只移除无法再下载、基本无用的包文件；`autoremove` 会移除作为依赖自动安装、现在不再需要的包。`-s` / `--simulate` 可先模拟将发生的操作。([Debian Manpages][7])

Risk note:

* `apt clean`：低风险，未来安装可能重新下载。
* `apt autoremove`：中风险，必须先检查将删除的包名。
* 不要手删 `/var/lib/dpkg` 或 `/var/lib/apt`。

---

### 4. DNF / Fedora / RHEL / Rocky / AlmaLinux

Inspect:

```bash
du -sh /var/cache/dnf 2>/dev/null
dnf list --autoremove
```

Cleanup:

```bash
sudo dnf clean packages
sudo dnf clean all
sudo dnf autoremove
```

DNF 的 `clean` 用于清理 repo 临时文件；`dnf clean packages` 删除缓存包，`dnf clean all` 删除所有相关缓存；`dnf list --autoremove` 可列出 `dnf autoremove` 会处理的包。([DNF Documentation][8])

Risk note:

* `dnf clean packages/all`：低风险。
* `dnf autoremove`：中风险，先看列表。
* 不要手删 `/var/lib/rpm`。

---

### 5. Zypper / openSUSE / SLES

Inspect:

```bash
du -sh /var/cache/zypp 2>/dev/null
```

Cleanup:

```bash
sudo zypper clean
sudo zypper clean --all
```

`zypper clean` 会清理本地缓存，默认清理已下载包；`--all` 会清理包括元数据在内的缓存。([openSUSE 维基][9])

---

### 6. Pacman / Arch Linux / Manjaro

Inspect:

```bash
du -sh /var/cache/pacman/pkg 2>/dev/null
```

Preferred cleanup:

```bash
sudo paccache -r
```

Optional periodic cleanup:

```bash
sudo systemctl enable --now paccache.timer
```

Arch 的 `paccache.timer` 可周期性清理 pacman package cache，启用后按默认选项每周执行。([Arch Manual Pages][10])

Risk note:

* `paccache -r` 通常比直接清空 pacman cache 更合适。
* `pacman -Scc` 更激进，会清掉更多缓存；只在用户接受重新下载成本时使用。
* 不要手删 `/var/lib/pacman`。

---

### 7. APK / Alpine Linux

Inspect:

```bash
du -sh /var/cache/apk 2>/dev/null
```

Cleanup:

```bash
sudo apk cache clean
sudo apk -v cache clean
```

Alpine 文档说明旧包版本可能留在 cache 中，可用 `apk cache clean` 清理；`-v` 会显示更详细输出。([Alpine Linux][11])

---

### 8. Flatpak

Inspect:

```bash
du -sh /var/lib/flatpak "$HOME/.local/share/flatpak" 2>/dev/null
flatpak list --runtime
```

Cleanup:

```bash
flatpak uninstall --unused
```

Flatpak 官方文档建议用 `flatpak uninstall --unused` 移除不再使用的 runtimes 和 extensions。([Flatpak][12])

Risk note:

* unused runtimes 通常低风险。
* 不要手删 `/var/lib/flatpak` 或 `~/.local/share/flatpak` 内部对象。

---

### 9. Snap

Inspect:

```bash
du -sh /var/lib/snapd "$HOME/snap" 2>/dev/null
snap list --all
```

Limit retained revisions:

```bash
sudo snap set system refresh.retain=2
```

Remove a specific disabled old revision only after review:

```bash
sudo snap remove <snap-name> --revision=<old-disabled-revision>
```

Snap 的 `refresh.retain` 控制刷新后保留的 snap revision 数量，合法范围是 2 到 20；经典 Ubuntu LTS 默认通常保留 2 个。([Snapcraft][13])

Risk note:

* 只删除 `disabled` 的旧 revision。
* 不要手删 `/var/lib/snapd/snaps`。
* Snap snapshots 也可能占空间；自动 snapshot retention 可配置，禁用自动 snapshot 不会删除既有 snapshots。([Snapcraft][14])

---

### 10. Docker

Inspect:

```bash
docker system df
docker ps -a
docker images
docker volume ls
```

Low/medium-risk cleanup:

```bash
docker system prune
```

High-risk cleanup:

```bash
docker system prune -a --volumes
```

Docker 官方说明 `docker system prune` 会删除未使用数据；默认涉及 unused containers、networks、images、build cache，`-a` 会删除所有 unused images，`--volumes` 会 prune anonymous volumes。Volumes 可能包含数据库、对象存储、队列、开发环境状态，所以 `--volumes` 必须单独确认。([Docker Documentation][15])

Do not manually delete:

```bash
sudo rm -rf /var/lib/docker/overlay2
sudo rm -rf /var/lib/docker/volumes
```

---

### 11. Podman

Inspect:

```bash
podman system df
podman ps -a
podman images
podman volume ls
```

Cleanup:

```bash
podman system prune
```

High-risk cleanup:

```bash
podman system prune --all --volumes
```

Podman 文档说明 `podman system prune` 会移除未使用的 containers、pods、networks，并可选移除 volumes；`--all` 会删除所有 unused images。([Podman 文档][16])

---

### 12. Btrfs, Snapper, Timeshift snapshots

Inspect Btrfs:

```bash
sudo btrfs filesystem usage /
sudo btrfs subvolume list /
```

Inspect Snapper:

```bash
sudo snapper list
sudo snapper list-configs
```

Cleanup via Snapper:

```bash
sudo snapper cleanup number
sudo snapper cleanup timeline
```

Btrfs snapshots 本质上是 subvolumes；`btrfs subvolume` 命令可以创建、删除、列出 subvolumes 和 snapshots。Snapper 提供自动 snapshot cleanup 算法，用来避免快照耗尽空间。([BTRFS 文档][17])

Risk note:

* 不要在不了解布局时手动 `btrfs subvolume delete`。
* openSUSE、Fedora Silverblue/Kinoite、某些桌面发行版可能大量依赖 Btrfs snapshot。
* Timeshift 快照应通过 Timeshift GUI 或 CLI 删除，不要直接删目录。

---

## Developer Cache Cleanup

| Tool         | Inspect                         | Cleanup                                            | Risk                                                     |
| ------------ | ------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| pip          | `python -m pip cache info`      | `python -m pip cache purge`                        | Low; wheels/packages may redownload                      |
| uv           | `uv cache dir`                  | `uv cache clean`                                   | Low/medium; future installs may redownload/rebuild       |
| npm          | `npm cache verify`              | `npm cache clean --force`                          | Low; npm cache is self-healing, clean requires `--force` |
| Go           | `go env GOCACHE GOMODCACHE`     | `go clean -cache -testcache`; `go clean -modcache` | Low/medium; module cache redownload cost                 |
| Cargo/Rust   | `du -sh target ~/.cargo`        | `cargo clean` inside old projects                  | Medium; rebuild cost can be large                        |
| Conda        | `conda clean --all --dry-run`   | `conda clean --all`                                | Medium; inspect dry-run first                            |
| Playwright   | `du -sh ~/.cache/ms-playwright` | `npx playwright uninstall --all`                   | Low/medium; browsers redownload                          |
| Hugging Face | `hf cache ls`                   | `hf cache prune --dry-run`; `hf cache prune`       | Medium/high; large model redownload cost                 |

Supporting notes:

* pip provides `cache dir/info/list/remove/purge`; `purge` removes all cache items.([pip][18])
* npm’s cache defaults to `~/.npm` on POSIX systems; `npm cache verify` garbage-collects unneeded data, and `npm cache clean` requires `--force` because npm treats cache as self-healing.([npm 文档][19])
* Go’s `go clean` supports `-cache`、`-testcache`、`-modcache` for cached build/test/module data.([Go Packages][20])
* `cargo clean` removes artifacts from the target directory; without options it deletes the entire target directory for the current package.([Rust 文档][21])
* Conda `clean --all` removes index cache、lock files、unused packages、tarballs、logs, but its docs warn that package-cache cleanup does not check packages installed via symlinks back to the package cache.([Conda Documentation][22])
* Playwright stores downloaded browser binaries under `~/.cache/ms-playwright` on Linux, and browser builds can be hundreds of MB each.([Playwright][23])
* Hugging Face CLI can list、remove、prune cache entries, and supports `--dry-run` to preview expected deletion.([Hugging Face][24])

---

## Quick Commands

### Safe audit

```bash
# Filesystem pressure
df -hT
df -ih

# Top directories in root filesystem only
sudo du -xhd1 / 2>/dev/null | sort -h

# Drill down
sudo du -xhd1 /var /home /usr /opt 2>/dev/null | sort -h

# Large files in current user's home
find "$HOME" -xdev -type f -size +1G -printf '%s\t%TY-%Tm-%Td\t%p\n' 2>/dev/null |
  sort -n |
  numfmt --field=1 --to=iec

# Journal size
journalctl --disk-usage

# Deleted-but-open files
sudo lsof +L1
```

---

### Lower-risk cleanup, still requiring approval

```bash
# systemd journal
sudo journalctl --rotate
sudo journalctl --vacuum-time=14d
sudo journalctl --vacuum-size=1G

# tmpfiles
sudo systemd-tmpfiles --clean

# Debian/Ubuntu
sudo apt autoclean
sudo apt clean

# Fedora/RHEL-family
sudo dnf clean packages
sudo dnf clean all

# openSUSE/SLES
sudo zypper clean
sudo zypper clean --all

# Alpine
sudo apk cache clean

# Flatpak
flatpak uninstall --unused

# pip
python -m pip cache purge

# npm
npm cache verify
npm cache clean --force

# Go
go clean -cache -testcache

# Hugging Face, preview first
hf cache prune --dry-run
hf cache prune
```

---

### Medium/high-risk cleanup requiring explicit confirmation

```bash
# Remove unused dependency packages after reviewing package list
sudo apt-get -s autoremove
sudo apt autoremove

dnf list --autoremove
sudo dnf autoremove

# Docker: safe-ish default prune
docker system df
docker system prune

# Docker: high-risk, volumes may contain data
docker system prune -a --volumes

# Podman
podman system df
podman system prune
podman system prune --all --volumes

# Btrfs/Snapper snapshots
sudo snapper list
sudo snapper cleanup number
sudo snapper cleanup timeline

# Conda
conda clean --all --dry-run
conda clean --all

# Go module cache
go clean -modcache

# Playwright
npx playwright uninstall --all
```

---

## Linux-specific Precautions

### 1. `/var/cache` and `/var/lib` are not equivalent

`/var/cache` is usually rebuildable. `/var/lib` is persistent state. Deleting `/var/lib` content can destroy databases, package-manager state, container state, Kubernetes state, CI state, or application data.([AWS 文档][25])

Treat these as high-risk:

```text
/var/lib/docker
/var/lib/containers
/var/lib/postgresql
/var/lib/mysql
/var/lib/mariadb
/var/lib/redis
/var/lib/dpkg
/var/lib/rpm
/var/lib/pacman
/var/lib/kubelet
/var/lib/libvirt
```

---

### 2. `/boot` cleanup must use the package manager

If `/boot` is full, do not manually delete random `vmlinuz-*`、`initrd*`、`System.map-*` files. Use the distribution’s kernel package cleanup mechanism. Removing the running or fallback kernel can make the system unbootable.

Safe audit:

```bash
df -hT /boot
uname -r
ls -lh /boot
```

Then use distro-specific package tooling, not `rm`.

---

### 3. Containers need runtime-aware cleanup

Do not delete container storage internals directly:

```bash
# Bad
sudo rm -rf /var/lib/docker/overlay2
sudo rm -rf /var/lib/containers/storage
```

Use:

```bash
docker system df
docker system prune

podman system df
podman system prune
```

Volumes need special confirmation because they may contain databases or persistent app state. Docker explicitly separates volume pruning behind `--volumes`.([Docker Documentation][15])

---

### 4. Snapshots can hide reclaimed space

On Btrfs systems, deleting a large file may not free expected space if a snapshot still references the old extents. Check snapshots before concluding cleanup failed.

Useful commands:

```bash
sudo btrfs filesystem usage /
sudo btrfs subvolume list /
sudo snapper list
```

Use Snapper/Timeshift cleanup tools rather than deleting snapshot directories manually.

---

### 5. Log deletion should usually be rotation/vacuum, not `rm`

For journald:

```bash
sudo journalctl --rotate
sudo journalctl --vacuum-time=14d
```

For traditional logs:

```bash
sudo logrotate -d /etc/logrotate.conf
sudo logrotate -f /etc/logrotate.conf
```

Avoid deleting active log files while services are running. If a deleted log is still open, use `sudo lsof +L1` and restart/reload the owner service.

---

## Reporting Format

For each cleanup candidate, report:

```text
Path:
Size:
Mountpoint:
Category:
Risk:
Why it is probably safe/risky:
Cleanup command:
Rollback/re-download/rebuild cost:
Requires sudo:
Requires service restart:
Requires explicit confirmation:
```

Example:

```text
Path: /var/log/journal
Size: 5.8 GB
Mountpoint: /
Category: systemd journal
Risk: Low/medium
Why: journalctl provides official vacuum commands; active journal files require rotation first.
Cleanup command:
  sudo journalctl --rotate
  sudo journalctl --vacuum-size=1G
Rollback/re-download cost: old logs are not recoverable unless backed up.
Requires sudo: Yes
Requires service restart: No
Requires explicit confirmation: Yes
```

---

## Common Mistakes

* 不确认挂载点就开始清理，导致删了 `/home` 却发现满的是 `/var`。
* 忽略 inode：`df -h` 看起来还有空间，但 `df -ih` 已满。
* 用 `sudo rm -rf` 直接删除 `/var/lib/*`。
* 手动删除 Docker/Podman overlay/storage 目录。
* 在未确认的情况下执行 `docker system prune -a --volumes`。
* 忽略 Btrfs/Snapper/Timeshift 快照导致空间“不释放”。
* 删除 active log 文件后不重启服务，导致空间仍被 open deleted file 占用。
* 清空整个 `~/.cache`，误删应用状态、IDE 索引、模型缓存或正在使用的文件。
* 在多用户服务器上清理其他用户目录。
* 手动删除 `/boot` 里的内核文件。

---

## Recommended Linux Cleanup Order

```text
1. df -hT / df -ih：确认挂载点和 inode 状态
2. du -xhd1：找出真正的大目录
3. journalctl --disk-usage：检查 journald
4. 包管理器 cache：apt/dnf/zypper/paccache/apk
5. Flatpak/Snap unused runtimes/revisions
6. Docker/Podman system df + prune without volumes
7. 开发者缓存：pip/npm/uv/go/conda/playwright/huggingface
8. 用户 Downloads/Desktop/Documents/Videos 大文件 triage
9. Btrfs/Snapper/Timeshift snapshots
10. 高风险项：volumes、databases、VMs、models、project data，仅在明确确认后处理
```

这样设计出来的 Linux 版 skill 会比 Windows/macOS 版更分层，但更安全：它尊重发行版差异、挂载点边界、服务持有文件、容器数据、快照机制，以及 `/var/cache` 与 `/var/lib` 的根本区别。

[1]: https://man7.org/linux/man-pages/man1/df.1.html "df(1) - Linux manual page"
[2]: https://refspecs.linuxfoundation.org/FHS_3.0/fhs/ch05.html "Chapter 5. The /var Hierarchy"
[3]: https://man7.org/linux/man-pages/man1/du.1.html "du(1) - Linux manual page"
[4]: https://support.scc.suse.com/s/kb/Different-free-disk-space-reported-by-df-and-du-commands-1583239387424?utm_source=chatgpt.com "Different free disk space reported by df and du commands"
[5]: https://man7.org/linux/man-pages/man1/journalctl.1.html "journalctl(1) - Linux manual page"
[6]: https://man7.org/linux/man-pages/man8/systemd-tmpfiles.8.html "systemd-tmpfiles(8) - Linux manual page"
[7]: https://manpages.debian.org/testing/apt/apt-get.8.en.html "apt-get(8) — apt — Debian testing — Debian Manpages"
[8]: https://dnf.readthedocs.io/en/latest/command_ref.html "DNF Command Reference — DNF @DNF_VERSION@-1 documentation"
[9]: https://en.opensuse.org/Archive%3AZypper_manual "Archive:Zypper manual - openSUSE Wiki"
[10]: https://man.archlinux.org/man/paccache.8 "paccache(8) — Arch manual pages"
[11]: https://wiki.alpinelinux.org/wiki/Alpine_Package_Keeper "Alpine Package Keeper - Alpine Linux"
[12]: https://docs.flatpak.org/en/latest/using-flatpak.html "Using Flatpak - Flatpak documentation"
[13]: https://snapcraft.io/docs/how-to-guides/manage-snaps/manage-updates/ "Manage updates - Snap documentation"
[14]: https://snapcraft.io/docs/how-to-guides/manage-snaps/create-data-snapshots/?utm_source=chatgpt.com "Create data snapshots - Snap documentation"
[15]: https://docs.docker.com/reference/cli/docker/system/prune/ "docker system prune | Docker Docs"
[16]: https://docs.podman.io/en/v5.3.2/markdown/podman-system-prune.1.html "podman-system-prune — Podman  documentation"
[17]: https://btrfs.readthedocs.io/en/latest/btrfs-subvolume.html "btrfs-subvolume(8) — BTRFS  documentation"
[18]: https://pip.pypa.io/en/stable/cli/pip_cache/ "pip cache - pip documentation v26.1.2"
[19]: https://docs.npmjs.com/cli/v11/commands/npm-cache "npm-cache | npm Docs"
[20]: https://pkg.go.dev/cmd/go/internal/clean "clean package - cmd/go/internal/clean - Go Packages"
[21]: https://doc.rust-lang.org/cargo/commands/cargo-clean.html "cargo clean - The Cargo Book"
[22]: https://docs.conda.io/projects/conda/en/stable/commands/clean.html "conda clean — conda 26.5.2 documentation"
[23]: https://playwright.dev/docs/browsers "Browsers | Playwright"
[24]: https://huggingface.co/docs/huggingface_hub/en/guides/cli "Command Line Interface (CLI) · Hugging Face"
[25]: https://docs.aws.amazon.com/linux/al2023/ug/filesystem-slash-var.html "/var (Persistent Variable System Data) - Amazon Linux 2023"
