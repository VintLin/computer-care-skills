#!/usr/bin/env bash
set -u

section() {
  printf '\n===== %s =====\n' "$1"
}

wifi_device() {
  networksetup -listallhardwareports 2>/dev/null |
    awk '/Hardware Port: Wi-Fi/{getline; sub("Device: ", ""); print; exit}'
}

wifi_service() {
  networksetup -listallnetworkservices 2>/dev/null |
    sed '1d; s/^\*//' |
    awk 'tolower($0) ~ /^wi-?fi$/ {print; exit}'
}

WIFI_DEVICE="$(wifi_device)"
WIFI_SERVICE="$(wifi_service)"

section "System"
sw_vers 2>/dev/null || true
uname -a 2>/dev/null || true

section "Tools"
for tool in networkQuality speedtest speedtest-cli dig lsof curl mtr tracepath; do
  command -v "$tool" || true
done

section "Interfaces"
networksetup -listallhardwareports 2>/dev/null || true
ifconfig 2>/dev/null || true

section "Network Services"
networksetup -getcurrentlocation 2>/dev/null || true
networksetup -listnetworkserviceorder 2>/dev/null || true

section "DNS"
scutil --dns 2>/dev/null || true
if [ -n "$WIFI_SERVICE" ]; then
  networksetup -getdnsservers "$WIFI_SERVICE" 2>/dev/null || true
else
  printf 'Wi-Fi network service not found\n'
fi

section "Proxy"
scutil --proxy 2>/dev/null || true

section "Routes"
route -n get default 2>/dev/null || true
netstat -rn -f inet 2>/dev/null | sed -n '1,120p' || true
netstat -rn -f inet6 2>/dev/null | sed -n '1,120p' || true

section "Wi-Fi"
system_profiler SPAirPortDataType 2>/dev/null || true
if [ -n "$WIFI_DEVICE" ]; then
  networksetup -listpreferredwirelessnetworks "$WIFI_DEVICE" 2>/dev/null || true
else
  printf 'Wi-Fi hardware device not found\n'
fi

section "MTU"
if [ -n "$WIFI_SERVICE" ]; then
  networksetup -getMTU "$WIFI_SERVICE" 2>/dev/null || true
else
  printf 'Wi-Fi network service not found\n'
fi

section "Packet Loss"
for host in 223.6.6.6 1.1.1.1; do
  ping -c 5 -i 0.2 "$host" 2>/dev/null || true
done

section "DNS Timing"
for server in 223.6.6.6 223.5.5.5 1.1.1.1 8.8.8.8; do
  printf '%s apple.com ' "$server"
  dig @"$server" apple.com +tries=1 +time=2 +stats 2>/dev/null | awk '/Query time:/ {print $4 " ms"; found=1} END {if (!found) print "timeout"}'
done

section "DNS Answers"
for type in A AAAA HTTPS; do
  dig "$type" apple.com +tries=1 +time=2 +short 2>/dev/null || true
done

section "Curl Timing"
if command -v curl >/dev/null 2>&1; then
  curl -L -o /dev/null -sS --max-time 15 \
    -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} ip=%{remote_ip} http=%{http_version}\n' \
    https://www.apple.com 2>/dev/null || true
  curl -4 -L -o /dev/null -sS --max-time 15 -w 'ipv4 ip=%{remote_ip} total=%{time_total}\n' https://www.apple.com 2>/dev/null || true
  curl -6 -L -o /dev/null -sS --max-time 15 -w 'ipv6 ip=%{remote_ip} total=%{time_total}\n' https://www.apple.com 2>/dev/null || true
fi

section "Listening Proxy Ports"
lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | egrep 'COMMAND|xray|mihomo|clash|v2ray|verge|10808|7890|7897|9090' || true

section "Top Network Processes"
nettop -P -L 1 -x -J bytes_in,bytes_out 2>/dev/null | head -80 || true

section "Network Quality"
if [ "${SKIP_BANDWIDTH:-0}" = "1" ]; then
  printf 'Skipped because SKIP_BANDWIDTH=1\n'
else
  networkQuality -c -M 30 2>/dev/null || networkQuality -v 2>/dev/null || true
fi

section "TCP Stats"
netstat -s 2>/dev/null | sed -n '1,160p' || true
