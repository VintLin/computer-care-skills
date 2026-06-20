# PMTU and MTU Reference

## When to Read

Read this when large transfers hang, HTTP/3/QUIC or UDP apps fail while TCP works, VPN/TUN performance is inconsistent, IPv6 behaves differently from IPv4, or DF ping / tracepath suggests an MTU problem.

## Core Model

MTU is a local link/interface size. PMTU is the largest packet size that works across a path. VPN, PPPoE, tunnels, QUIC/MASQUE, IPv6, and middleboxes can all change the effective path.

Do not lower a global interface MTU from one failed ping size. First decide which path fails:

- TCP vs UDP/QUIC.
- IPv4 vs IPv6.
- Required VPN/TUN/proxy path vs safe in-app variations.
- One destination/CDN vs many destinations.
- One interface vs all interfaces.

RFC 8899 Datagram PLPMTUD is the right mental model for UDP-like transports: use probe packets, destination feedback, black-hole detection, and conservative size reduction instead of trusting one ICMP result or one failed probe.

## Read-Only Checks

macOS:

```bash
networksetup -getMTU Wi-Fi
ping -D -s 1472 -c 4 1.1.1.1
ping -D -s 1464 -c 4 1.1.1.1
curl --http2 -L -o /dev/null -sS -w 'http=%{http_version} total=%{time_total}\n' https://example.com
curl --http3 -L -o /dev/null -sS -w 'http=%{http_version} total=%{time_total}\n' https://example.com
```

Linux:

```bash
ip link show
tracepath example.com
ping -M do -s 1472 -c 4 1.1.1.1
ping -M do -s 1464 -c 4 1.1.1.1
```

Windows:

```powershell
netsh interface ipv4 show subinterfaces
ping 1.1.1.1 -f -l 1472
ping 1.1.1.1 -f -l 1464
```

VPN/proxy:

```bash
curl -x http://127.0.0.1:10808 --http2 -L -o /dev/null -sS -w 'proxy http=%{http_version} total=%{time_total}\n' https://example.com
curl -x http://127.0.0.1:10808 --http3 -L -o /dev/null -sS -w 'proxy http=%{http_version} total=%{time_total}\n' https://example.com
```

Use the actual local proxy port or VPN path the user relies on. Do not ask the user to quit or pause the VPN/proxy app just to get a direct comparison; use direct/no-proxy only when the user explicitly wants that experiment or when the app provides a safe bypass/rule-mode comparison.

## Interpretation

- DF ping failure can be ICMP filtering, target policy, path MTU, VPN encapsulation overhead, or local firewall behavior.
- IPv6 routers do not fragment packets in the path; Packet Too Big handling and application probing matter.
- QUIC/HTTP/3 uses UDP and may expose PMTU or UDP-blocking issues that HTTP/2 over TCP hides.
- VPNs add encapsulation overhead. Prefer the VPN client's MTU/MSS controls when available.
- If only one CDN or service fails, compare destination, resolver, HTTP version, and VPN exit before changing host MTU.

## Change Rules

- Prefer application/VPN/router MSS or MTU tuning over global interface MTU when the failing path is scoped.
- Set interface MTU only with repeated evidence, a named interface, expected affected traffic, and rollback command.
- Do not tune MTU while bandwidth tests, VPN reconnects, package installs, or large downloads are running unless testing that exact workload.
- After a change, re-run the same TCP, UDP/QUIC, IPv4/IPv6, VPN/proxy-path tests and compare before/after.
