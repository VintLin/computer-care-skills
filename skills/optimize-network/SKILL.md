---
name: optimize-network
description: Use when a user reports slow internet, unstable latency, packet loss, DNS delays, Wi-Fi or Ethernet issues, poor speedtest results, MTU/path-MTU problems, loaded latency, browser-only or terminal-only slowness, IPv4/IPv6 differences, background bandwidth contention, stale saved networks, mDNS/Bonjour/LLMNR noise, VPN-on networking, proxy/PAC/TUN overlap, or Clash/V2Ray/Xray/Mihomo routing conflicts on macOS, Windows, or Linux.
---

# Optimize Network

## Overview

Prefer reversible, minimal changes. Start with read-only diagnosis, then explain each meaningful decision with conclusion, reason, risk, next step, scope, and validation. Do not disable VPN, delete saved networks, change registry/system services, change TCP/NIC globals, disable IPv6/firewall/security tools, or kill processes unless the user explicitly asks and the impact is clearly bounded.

Do not optimize from a single speed number. Compare repeated measurements, separate direct/proxy/VPN paths, and avoid running bandwidth tests in parallel unless intentionally testing congestion or loaded latency.

## Workflow

1. Classify the symptom first: web first-load, bulk download, video call, gaming, SSH, Git/npm/pip/Docker, AI API, LAN/NAS, browser-only, terminal-only, VPN-only, or all traffic.
2. Identify OS, active interface, default route, DNS, proxy/PAC, VPN/TUN state, IPv4/IPv6 state, browser path, and available tools.
3. Run a read-only baseline: bandwidth, idle latency, loaded latency, DNS resolution and answer quality, packet loss, MTU/path-MTU, Wi-Fi/Ethernet link quality, curl timing, route/path, and active bandwidth consumers.
4. Compare paths when relevant:
   - direct vs system proxy vs explicit proxy vs VPN/TUN
   - IPv4 vs IPv6
   - browser vs curl/terminal
   - idle vs loaded network
   - LAN target vs public target
5. Classify the bottleneck:
   - Access: weak Wi-Fi, crowded channel, low negotiated rate, Ethernet negotiation, AP backhaul, router queueing.
   - DNS: slow resolver, poor CDN answer, DoH/split DNS mismatch, VPN DNS hijack conflicts, stale cache.
   - Path: packet loss, PMTU/MSS mismatch, ISP/CDN route, VPN exit path, bad node.
   - Transport/NIC: TCP retransmits, adapter errors/drops, offload/queue/driver problems.
   - Application: browser DoH, HTTP/3/QUIC, proxy extension, certificate/security filter, service TTFB.
   - Policy: enterprise VPN, NRPT/per-link DNS, MDM/GPO, firewall/EDR/content filter.
6. Apply the smallest safe fixes first.
7. Validate with the same measurements and summarize before/after numbers plus rollback.

## Platform References

Read only the relevant reference:

- Common baseline and safety: `references/common-baseline.md`
- macOS: `references/macos.md`
- Windows: `references/windows.md`
- Linux: `references/linux.md`
- Browser/app layer: `references/browser-app-layer.md`
- DNS, DoH, and split DNS: `references/dns-doh-splitdns.md`
- TCP and NIC diagnosis: `references/tcp-nic.md`
- Router SQM and bufferbloat: `references/router-sqm-bufferbloat.md`
- VPN/proxy overlap: `references/vpn-proxy.md`

Use scripts as read-only diagnostic helpers:

- macOS: `scripts/macos_network_snapshot.sh`
- Windows PowerShell: `scripts/windows_network_snapshot.ps1`
- Linux: `scripts/linux_network_snapshot.sh`

Scripts are intentionally read-only. They collect state and do not change DNS, MTU, proxy, routes, VPN, firewall, TCP, or NIC settings.

## Decision Heuristics

- If idle latency is normal but latency spikes during upload/download, classify as loaded-latency or bufferbloat before changing DNS.
- If DNS query time is fast but TCP, TLS, TTFB, or total HTTP time is high, do not over-optimize DNS.
- If DNS is fast but CDN IP or TTFB is poor, compare A, AAAA, HTTPS/SVCB answers and curl `remote_ip` across resolvers.
- If IPv4 and IPv6 behave differently, treat it as dual-stack routing, DNS, PMTU, VPN, or CDN behavior before disabling IPv6 globally.
- If browser and curl disagree, inspect browser Secure DNS/DoH, HTTP/3/QUIC, extensions, NetLog/HAR, cache, certificate interception, and proxy rules.
- If terminal tools are slow but browser is fast, inspect shell proxy variables, WinHTTP, WSL/Docker DNS, CLI CA certificates, and `NO_PROXY`.
- If Wi-Fi RSSI is strong but throughput is low, inspect channel width, band, MCS/NSS, BSSID roaming, AP backhaul, WPA mode, and driver.
- If Ethernet negotiates below expected speed, inspect cable, switch port, duplex, EEE, driver, and error counters.
- If adapter errors/drops increase during tests, prioritize NIC/driver/offload/queue diagnosis over DNS or VPN changes.
- If VPN/TUN is active, run separate direct, system-proxy, explicit-proxy, TUN, and browser tests before interpreting speedtest results.
- If system DNS is fully overridden by VPN or browser DoH, changing OS DNS may not affect the observed application.
- If MTR/traceroute shows loss on a single intermediate hop but later hops and the destination are clean, treat it as likely ICMP rate limiting.
- If WSL or Docker is slow while the host is normal, inspect virtualization networking, DNS tunneling, auto proxy, container DNS, registry mirror, and VPN compatibility.
- If a change improves one metric but worsens throughput, loss, or loaded latency, roll it back and keep the evidence.

## Safe Change Ladder

Use this order unless evidence points elsewhere:

0. Read-only diagnosis: routes, DNS, proxy, VPN, Wi-Fi/Ethernet, IPv4/IPv6, curl timing, adapter stats, path tests.
1. Low-risk reversible actions: flush DNS cache, switch to better link/AP, change VPN node/protocol, pause a named bandwidth-heavy task.
2. Local configuration with evidence and rollback: per-interface DNS, interface MTU, proxy bypass, Wi-Fi profile priority, low-data/metered setting.
3. High-risk system configuration: TCP globals, Windows registry/adapter advanced properties, Linux offload/ring/coalescing, firewall, IPv6 disablement, system services. Do not do this by default.
4. Network device configuration: router SQM/CAKE, channel width, WPA mode, firmware, AP backhaul, flow offload. Require user authority over the device.

Do not recommend these as first-line fixes:

- Disable IPv6 globally.
- Disable firewall or security/EDR tools globally.
- Change TCP global parameters without workload evidence.
- Change NIC offload, ring, coalescing, or power settings without packet/error evidence.
- Replace VPN or corporate DNS before checking split DNS.
- Force public DNS on corporate networks.
- Delete Wi-Fi profiles without listing them.
- Enable both router SQM and hardware flow offloading as a universal optimization.
- Interpret one speedtest result as the network baseline.

## Common Safe Fixes

- Flush DNS cache.
- Prefer Ethernet, 5 GHz, or 6 GHz over crowded 2.4 GHz.
- Add stable secondary DNS only if system DNS is in use and not overridden by VPN, DoH, or enterprise policy.
- Set interface MTU only when path-MTU evidence supports it; prefer VPN/router MSS or MTU tuning when available.
- Remove only clearly obsolete preferred Wi-Fi networks after naming them.
- Avoid duplicate VPN/TUN/proxy ownership while preserving the path the user needs.
- Recommend VPN node/protocol changes if system, link, DNS, and route baselines are already clean.

## Reporting Format

For each meaningful decision, report:

- Conclusion
- Reason
- Risk
- Next step
- Scope and validation method when changing settings

Finish with before/after metrics, exact rollback commands where possible, and any residual uncertainty.
