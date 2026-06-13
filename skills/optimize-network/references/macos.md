# macOS Network Optimization Reference

## Read-Only Diagnosis

Use these commands first:

```bash
sw_vers
networksetup -listallhardwareports
networksetup -getcurrentlocation
networksetup -listnetworkserviceorder
route -n get default
ifconfig
scutil --dns
scutil --proxy
netstat -rn -f inet
netstat -rn -f inet6
netstat -ib
netstat -s
system_profiler SPAirPortDataType
networkQuality -c
lsof -nP -iTCP -sTCP:LISTEN
ps -axo pid,ppid,pcpu,pmem,comm,args
```

Prefer `networkQuality -c` for a built-in structured baseline. It reports responsiveness, idle latency, throughput, interface, and latency-under-load fields in JSON. Use `speedtest-cli` only as a secondary data point because it may choose poor servers through VPN.

Useful focused variants:

```bash
networkQuality -s -c
networkQuality -I en0 -c
networkQuality -f h2 -c
networkQuality -f h3 -c
networkQuality -f L4S -c
networkQuality -f noL4S -c
```

Use `-s` when upload and download responsiveness need to be separated. Use `-I` only after identifying the interface. Use `-f` protocol flags only for a focused comparison; do not run protocol matrices as a default first pass.

Identify the Wi-Fi device before using device-specific commands. It is often `en0`, but not always:

```bash
networksetup -listallhardwareports
```

## DNS

Inspect:

```bash
networksetup -getdnsservers Wi-Fi
scutil --dns
dig apple.com +tries=1 +time=2 +stats
dig A apple.com
dig AAAA apple.com
dig HTTPS apple.com
```

Low-risk cache refresh:

```bash
dscacheutil -flushcache
```

Set Wi-Fi DNS only when system DNS is the intended resolver:

```bash
networksetup -setdnsservers Wi-Fi 223.6.6.6 223.5.5.5
```

Rollback to DHCP-provided DNS:

```bash
networksetup -setdnsservers Wi-Fi Empty
```

## MTU

Inspect:

```bash
networksetup -getMTU Wi-Fi
```

Test path MTU with DF pings. Payload + 28 bytes is the approximate IPv4 packet size:

```bash
ping -D -s 1472 -c 4 223.6.6.6
ping -D -s 1464 -c 4 223.6.6.6
```

If 1464 succeeds and 1465 or 1472 fails, 1492 is a reasonable interface MTU candidate:

```bash
networksetup -setMTU Wi-Fi 1492
```

Rollback:

```bash
networksetup -setMTU Wi-Fi 1500
```

Prefer VPN/router MTU or MSS clamp when available because a system interface MTU affects all traffic.

For UDP, QUIC, IPv6, VPN, or black-hole symptoms, read `references/pmtu-mtu.md` before recommending an MTU change.

## IPv4 and IPv6

Compare both families before disabling IPv6:

```bash
netstat -rn -f inet
netstat -rn -f inet6
curl -4 -L -o /dev/null -sS -w '%{remote_ip} %{time_total}\n' https://www.apple.com
curl -6 -L -o /dev/null -sS -w '%{remote_ip} %{time_total}\n' https://www.apple.com
```

If IPv6 is worse, first inspect DNS answers, Happy Eyeballs behavior, route, PMTU, VPN handling, firewall, and CDN selection. Do not recommend global IPv6 disablement as a first-line fix.

## Wi-Fi

Look for:

- PHY mode, channel, band, channel width.
- Signal/noise and negotiated transmit rate.
- Strong neighboring networks on the same channel.
- Roaming BSSID, AP backhaul, WPA mode, and whether 2.4/5/6 GHz SSIDs are split in a way that causes bad roaming.

Good first fixes:

- Prefer 5 GHz/6 GHz SSIDs over 2.4 GHz.
- Move closer to the AP or use Ethernet.
- Remove stale preferred networks only after listing them:

```bash
networksetup -listpreferredwirelessnetworks <wifi-device>
networksetup -removepreferredwirelessnetwork <wifi-device> "old-ssid"
```

## mDNS, AWDL, and Apple Features

mDNS/Bonjour, AWDL, AirDrop, Handoff, and Continuity can add local network chatter. Do not disable them by default. Only consider changes if the user accepts losing Apple ecosystem features or if a concrete interference symptom exists.

## Apple Privacy and Low Data Features

If Safari behaves differently from Chrome/Firefox, inspect iCloud Private Relay, Hide IP Address, Limit IP Address Tracking, browser DNS, and VPN state before changing DNS or MTU.

If a speed test looks lower only when Private Relay or Limit IP Address Tracking is active, treat it as a measurement path difference. Use a scoped comparison and explain the privacy impact before changing anything.

## VPN/Proxy

Inspect system proxy and TUN overlap:

```bash
scutil --proxy
netstat -rn -f inet
lsof -nP -iTCP -sTCP:LISTEN | egrep 'xray|mihomo|clash|v2ray|7890|10808'
```

If a system proxy points to one core and routes include fake-IP/TUN routes from another core, test for double handling before disabling anything.

## Application Timing

Use curl timing to split DNS, TCP, TLS, TTFB, and total time:

```bash
curl -L -o /dev/null -sS \
  -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} ip=%{remote_ip} http=%{http_version}\n' \
  https://www.apple.com
```
