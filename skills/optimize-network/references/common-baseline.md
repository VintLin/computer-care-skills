# Common Network Baseline

## Symptom Intake

Ask or infer what is slow before running fixes:

- Web first-load: DNS, TCP/TLS, HTTP/3 fallback, proxy, browser extension.
- Video call or game latency: loaded latency, bufferbloat, Wi-Fi jitter, upload queueing.
- Fast speedtest but slow Git/npm/pip/Docker: proxy rule, CDN, IPv6, registry mirror, VPN exit.
- Browser slow but curl fast: browser DoH, QUIC/HTTP3, extension, cache, certificate or security filter.
- Terminal slow but browser fast: shell proxy variables, WinHTTP, WSL/Docker DNS, CLI certificates.
- VPN active and internal domains fail: split DNS, NRPT, per-link DNS, VPN DNS hijack. Preserve the required VPN app; do not ask the user to pause or quit it by default.
- LAN/NAS/SSH slow: Ethernet negotiation, Wi-Fi backhaul, switch/AP, offload, MTU.

## Measurement Order

Prefer repeated and comparable measurements:

1. Ping the gateway to test the local link.
2. Ping a public IP to test basic ISP reachability.
3. Measure idle latency and loaded latency/responsiveness before treating bandwidth as the primary score.
4. Query DNS and record transport/policy, A/AAAA/HTTPS answers, answer IPs, and query time.
5. Run curl timing for the target URL.
6. Compare IPv4 and IPv6 when dual stack exists.
7. Compare required VPN/TUN path, system proxy, explicit proxy, browser path, and safe in-app node/mode/rule variations when VPN is active. Use direct/no-proxy only when it will not break required access or the user explicitly asks for that experiment.
8. Use mtr/pathping/traceroute/tracepath only after the basic layers point to a path problem.

## Loaded Latency and Responsiveness

Loaded latency is the user-visible delay when the network is already doing work. Treat it as a separate baseline from idle ping and throughput.

- macOS: prefer `networkQuality -c` for JSON output; use `-s` to separate upload and download responsiveness, `-I <interface>` to bind a link, and `-f h1|h2|h3|L4S|noL4S` only for focused protocol comparisons.
- Windows/Linux: use Speedtest loaded-latency output when available, or run controlled ping-to-gateway/public-IP samples during a known upload/download.
- Record idle latency, loaded latency, throughput, interface, VPN/proxy state, node/mode/rule state, and test direction so before/after numbers are comparable.
- If loaded latency is bad but idle latency and DNS are normal, prioritize queueing, background uploads, router SQM/CAKE, Wi-Fi airtime, VPN exit queueing, or local TUN/proxy contention.

## Curl Timing

Use this shape for application-layer timing:

```bash
curl -L -o /dev/null -sS \
  -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} ip=%{remote_ip} http=%{http_version} proxy=%{proxy_used}\n' \
  https://example.com
```

Interpretation:

- High `time_namelookup`: DNS resolver, DoH, split DNS, or cache.
- High `time_connect`: route, proxy, firewall, SYN loss, IPv6 reachability.
- High `time_appconnect`: TLS inspection, proxy, certificate, server or CDN.
- High `time_starttransfer`: server, CDN, proxy exit, app backend.
- High `time_total` only: download throughput, congestion, server size, throttling.

## Path Interpretation

- Treat intermediate-hop loss as suspicious only if loss continues to later hops and the destination.
- Do not claim ISP packet loss from one ICMP-rate-limited hop.
- Prefer destination loss, application timing, and repeated tests over one traceroute snapshot.
- Do not infer a universal MTU from one DF ping. Separate TCP, UDP/QUIC, IPv4, IPv6, and VPN-encapsulated paths before changing any interface MTU.

## Privacy

Packet captures, NetLog, HAR, DNS cache dumps, route tables, and VPN logs can contain domains, internal hostnames, IPs, cookies, tokens, proxy metadata, and corporate identifiers. Warn before collecting them, keep collection scoped, and ask the user to redact before sharing raw logs.
