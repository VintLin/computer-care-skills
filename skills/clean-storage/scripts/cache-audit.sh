#!/usr/bin/env bash
# cache-audit.sh - Measure common developer cache sizes on macOS or Linux
# Usage: bash scripts/cache-audit.sh

set -euo pipefail

echo "=== Developer Cache Audit ==="
echo "Date: $(date '+%Y-%m-%d %H:%M')"
echo "OS: $(uname -s)"
echo ""

declare -a names=()
declare -a paths=()

add_candidate() {
  names+=("$1")
  paths+=("$2")
}

case "$(uname -s)" in
  Darwin)
    add_candidate "uv" "$HOME/Library/Caches/uv"
    add_candidate "Homebrew" "$HOME/Library/Caches/Homebrew"
    add_candidate "pip" "$HOME/Library/Caches/pip"
    add_candidate "npm" "$HOME/.npm/_cacache"
    add_candidate "cargo registry" "$HOME/.cargo/registry/cache"
    add_candidate "rustup" "$HOME/.rustup/toolchains"
    add_candidate "sccache" "$HOME/Library/Caches/Mozilla.sccache"
    add_candidate "Playwright" "$HOME/Library/Caches/ms-playwright"
    add_candidate "huggingface" "$HOME/.cache/huggingface"
    add_candidate "Docker Desktop" "$HOME/Library/Containers/com.docker.docker/Data"
    ;;
  Linux)
    add_candidate "uv" "$HOME/.cache/uv"
    add_candidate "pip" "$HOME/.cache/pip"
    add_candidate "npm" "$HOME/.npm"
    add_candidate "cargo registry" "$HOME/.cargo/registry/cache"
    add_candidate "rustup" "$HOME/.rustup/toolchains"
    add_candidate "sccache" "$HOME/.cache/sccache"
    add_candidate "Playwright" "$HOME/.cache/ms-playwright"
    add_candidate "huggingface" "$HOME/.cache/huggingface"
    add_candidate "go build cache" "$HOME/.cache/go-build"
    add_candidate "go module cache" "$HOME/go/pkg/mod"
    add_candidate "conda packages" "$HOME/.conda/pkgs"
    add_candidate "APT packages" "/var/cache/apt/archives"
    add_candidate "DNF cache" "/var/cache/dnf"
    add_candidate "Zypper cache" "/var/cache/zypp"
    add_candidate "Pacman packages" "/var/cache/pacman/pkg"
    add_candidate "APK cache" "/var/cache/apk"
    add_candidate "Flatpak user" "$HOME/.local/share/flatpak"
    add_candidate "Flatpak system" "/var/lib/flatpak"
    add_candidate "Snap system" "/var/lib/snapd"
    ;;
  *)
    echo "Unsupported OS for this audit script. Use the platform reference for manual commands."
    exit 0
    ;;
esac

total_kb=0
measured=0

for i in "${!names[@]}"; do
  name="${names[$i]}"
  path="${paths[$i]}"
  if [ -d "$path" ]; then
    size_human=$(du -shx "$path" 2>/dev/null | cut -f1 || true)
    size_kb=$(du -skx "$path" 2>/dev/null | cut -f1 || true)
    if [ -z "$size_kb" ]; then
      printf "%-20s %8s  %s\n" "$name" "unread" "$path"
      continue
    fi
    total_kb=$((total_kb + size_kb))
    measured=$((measured + 1))
    printf "%-20s %8s  %s\n" "$name" "$size_human" "$path"
  fi
done

echo ""
total_gb=$(awk "BEGIN { printf \"%.1f\", $total_kb / 1048576 }")
echo "Total: ${total_gb} GB"
echo "Measured directories: ${measured}"
