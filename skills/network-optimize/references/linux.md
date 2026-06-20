# Linux Network Optimization Reference

## Read-Only Diagnosis

Start with commands that work across common desktop and server distributions:

```bash
uname -a
cat /etc/os-release 2>/dev/null
ip -br addr
ip -s link
ip route
ip -6 route
resolvectl status 2>/dev/null
resolvectl statistics 2>/dev/null
cat /etc/resolv.conf 2>/dev/null
nmcli dev status 2>/dev/null
nmcli con show --active 2>/dev/null
env | grep -Ei '^(http|https|all|no)_proxy='
ss -s
ss -tin state established | head -100
```

Use `scripts/linux_network_snapshot.sh` for a read-only first pass when shell access is available.

## DNS and Split DNS

Inspect global and per-link DNS before changing `/etc/resolv.conf`:

```bash
resolvectl status
resolvectl query example.com
resolvectl query internal.example.com
```

If NetworkManager owns the interface:

```bash
nmcli dev show
nmcli con show --active
```

Do not replace global DNS while a VPN, Tailscale, ZeroTier, corporate profile, or systemd-resolved per-link domain is active until split DNS behavior is understood.

## IPv4 and IPv6

Compare routes and application timing:

```bash
ip route
ip -6 route
curl -4 -L -o /dev/null -sS -w '%{remote_ip} %{time_total}\n' https://example.com
curl -6 -L -o /dev/null -sS -w '%{remote_ip} %{time_total}\n' https://example.com
```

Do not disable IPv6 globally as a first-line fix. First decide whether the failure is Happy Eyeballs behavior, DNS answer quality, route, PMTU, firewall, VPN, or CDN mapping.

## Wi-Fi

Prefer modern `iw` and NetworkManager data:

```bash
iw dev
iw dev <iface> link
nmcli dev wifi list
```

If signal is strong but throughput is poor, inspect band, channel width, rate, roaming BSSID, AP backhaul, and power saving.

## MTU and PMTU

```bash
ip link show
tracepath example.com
ping -M do -s 1472 -c 4 1.1.1.1
ping -M do -s 1464 -c 4 1.1.1.1
```

`ip link set ... mtu` is a real interface change. Treat it as local configuration requiring evidence and rollback.

For UDP, QUIC, IPv6, VPN, or black-hole symptoms, read `references/pmtu-mtu.md` before recommending an MTU change. Prefer VPN/router MSS or MTU controls when the failing path is scoped to a tunnel.

## NIC and TCP

Only read by default:

```bash
sysctl net.ipv4.tcp_congestion_control net.core.default_qdisc
ip -s link
ethtool <iface>
ethtool -S <iface>
ethtool -k <iface>
ethtool -c <iface>
ethtool -g <iface>
ethtool -l <iface>
```

Treat offload, ring, coalescing, queue, and congestion-control changes as high-risk. Require packet/error evidence, expected effect, rollback, and before/after validation.

## WSL, Docker, and Containers

If host networking is normal but development tools are slow:

- WSL: inspect `networkingMode`, `dnsTunneling`, `autoProxy`, generated `resolv.conf`, Windows proxy, VPN, and Hyper-V firewall.
- Docker: inspect Docker Desktop proxy, registry mirror, container DNS, VPN compatibility, and IPv6.
- Kubernetes: inspect pod DNS config, CoreDNS pods, endpoints, and whether CoreDNS receives queries.
