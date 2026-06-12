# macOS Storage Cleanup Reference

## Read-Only Baseline

Measure pressure first:

```bash
df -h /
diskutil info / | sed -n '/Volume Free Space/p;/Container Free Space/p'
du -sh ~/Library/Caches ~/Downloads ~/Desktop ~/Documents ~/.cache 2>/dev/null | sort -rh
```

Use the bundled cache audit when available:

```bash
bash scripts/cache-audit.sh
```

The script is read-only. It measures common developer caches such as Homebrew, uv, pip, npm, cargo, rustup, sccache, Playwright, Hugging Face, and Docker Desktop data.

## User File Triage

List large user-created files before proposing deletion:

```bash
find ~/Downloads ~/Desktop ~/Documents ~/Movies -type f -size +500M -print0 2>/dev/null |
  xargs -0 du -h 2>/dev/null |
  sort -rh |
  head -50
```

Treat old installers, `.dmg`, `.pkg`, `.zip`, screen recordings, exports, and duplicate archives as medium risk. Do not delete based only on age.

## Disposable Cache Targets

| Area | Inspect | Cleanup note |
| --- | --- | --- |
| Homebrew | `~/Library/Caches/Homebrew` | Prefer `brew cleanup --prune=all`; run `brew cleanup -n` first when estimating impact |
| uv | `~/Library/Caches/uv` | `uv cache prune` is safer; `uv cache clean` removes all cache entries |
| pip | `~/Library/Caches/pip` | `python -m pip cache info`; `python -m pip cache purge` |
| npm | `~/.npm/_cacache` | `npm cache verify`; `npm cache clean --force` only when reclaiming space |
| Go | `go env GOCACHE GOMODCACHE` | `go clean -cache`; `go clean -modcache` is broader |
| cargo | `~/.cargo/registry/cache` | Prefer reporting size; toolchain/project impact varies |
| rustup | `~/.rustup/toolchains` | Remove only named unused toolchains |
| Playwright | `~/Library/Caches/ms-playwright` | Prefer `npx playwright uninstall --all` only after confirming projects can reinstall browsers |
| Hugging Face | `~/.cache/huggingface` | Use `hf cache ls`, `hf cache prune`, or dry-run removal where possible |
| Docker Desktop | `~/Library/Containers/com.docker.docker/Data` | Start with `docker system df`; volumes are high risk |

## Safer Cleanup Commands

These still require approval:

```bash
brew cleanup --prune=all
uv cache prune
python -m pip cache purge
npm cache clean --force
go clean -cache
npx playwright uninstall --all
hf cache prune
docker system prune
```

Require stronger explicit confirmation:

```bash
go clean -modcache
docker system prune -a
docker system prune -a --volumes
rm -rf <specific-reviewed-path>
```

## macOS-Specific Precautions

- Do not delete `~/Library/Application Support` or `~/Library/Containers` directories just because they are large; they often contain databases and user state.
- Do not empty Trash without listing expected impact and getting confirmation.
- Do not remove `.photoslibrary`, `.musiclibrary`, `.imovielibrary`, virtual machines, sparse bundles, or project directories as cache.
- If APFS snapshots appear to dominate space, report them separately and use Time Machine/APFS-aware commands rather than manual deletion.
- If a package manager, Docker build, model download, training job, or IDE indexing process is active, avoid deleting its cache during the run.

## Good Default Order

1. Report volume pressure with `df -h /`.
2. Audit common caches with `scripts/cache-audit.sh` and targeted `du`.
3. List large files in Downloads/Desktop/Documents/Movies.
4. Propose low-risk tool-managed cache pruning first.
5. Propose Docker cleanup only after `docker system df`.
6. Leave user files and application state untouched unless the user selects exact targets.
7. Re-run the same free-space and cache-size measurements.
