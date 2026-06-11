#!/usr/bin/env bash
set -u

section() {
  printf '\n===== %s =====\n' "$1"
}

section "System"
uname -a 2>/dev/null || true
cat /etc/os-release 2>/dev/null || true

section "Tools"
for tool in ip resolvectl nmcli iw ethtool ss curl dig tracepath mtr speedtest; do
  command -v "$tool" || true
done

section "Interfaces"
ip -br addr 2>/dev/null || true
ip -s link 2>/dev/null || true

section "Routes"
ip route 2>/dev/null || true
ip -6 route 2>/dev/null || true

section "DNS"
resolvectl status 2>/dev/null || true
resolvectl statistics 2>/dev/null || true
cat /etc/resolv.conf 2>/dev/null || true

section "NetworkManager"
nmcli dev status 2>/dev/null || true
nmcli con show --active 2>/dev/null || true

section "Proxy Environment"
env | grep -Ei '^(http|https|all|no)_proxy=' || true

section "Wi-Fi"
iw dev 2>/dev/null || true
for path in /sys/class/net/*; do
  iface="$(basename "$path")"
  iw dev "$iface" link 2>/dev/null || true
done

section "MTU and PMTU"
ip link show 2>/dev/null || true
if command -v tracepath >/dev/null 2>&1; then
  tracepath -m 8 1.1.1.1 2>/dev/null || true
fi

section "Packet Loss"
for host in 223.6.6.6 1.1.1.1; do
  ping -c 5 -i 0.2 "$host" 2>/dev/null || true
done

section "DNS Timing"
if command -v dig >/dev/null 2>&1; then
  for server in 223.6.6.6 223.5.5.5 1.1.1.1 8.8.8.8; do
    printf '%s apple.com ' "$server"
    dig @"$server" apple.com +tries=1 +time=2 +stats 2>/dev/null |
      awk '/Query time:/ {print $4 " ms"; found=1} END {if (!found) print "timeout"}'
  done
fi

section "Curl Timing"
if command -v curl >/dev/null 2>&1; then
  curl -L -o /dev/null -sS --max-time 15 \
    -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} ip=%{remote_ip} http=%{http_version}\n' \
    https://www.apple.com 2>/dev/null || true
fi

section "TCP"
sysctl net.ipv4.tcp_congestion_control 2>/dev/null || true
sysctl net.core.default_qdisc 2>/dev/null || true
ss -s 2>/dev/null || true
ss -tin state established 2>/dev/null | head -100 || true

section "NIC Offload and Statistics"
if command -v ethtool >/dev/null 2>&1; then
  for path in /sys/class/net/*; do
    iface="$(basename "$path")"
    [ "$iface" = "lo" ] && continue
    printf '\n### %s\n' "$iface"
    ethtool "$iface" 2>/dev/null || true
    ethtool -S "$iface" 2>/dev/null | head -80 || true
    ethtool -k "$iface" 2>/dev/null || true
  done
fi
