# DNS, DoH, SVCB/HTTPS, and Split DNS Reference

## Diagnosis Goals

Separate DNS latency from DNS answer quality and DNS routing policy:

- Latency: how long the query takes.
- Transport: classic DNS, DoH, DoT, VPN DNS proxy, or browser Secure DNS.
- Answer quality: which A/AAAA/HTTPS/SVCB answers are returned and whether they map to a good CDN path.
- Policy: whether VPN, browser DoH, NRPT, per-link DNS, PAC, parental controls, or enterprise tools override the system resolver.

## Checks

Compare answers and timing:

```bash
dig A example.com
dig AAAA example.com
dig HTTPS example.com
dig +short A example.com @1.1.1.1
dig +short A example.com @8.8.8.8
```

For curl, always compare DNS timing with `remote_ip` and TTFB. A fast resolver that returns a poor CDN IP can still make the application slow.

## DoH and Browser Policy

DoH maps DNS queries and responses into HTTPS exchanges, so browser DNS can bypass or differ from the OS resolver. Chrome Secure DNS commonly attempts a same-provider upgrade, can fall back to regular DNS, and can be disabled or configured by parental controls or enterprise policy.

Check:

- Browser Secure DNS / DoH mode and custom provider.
- Managed browser state, enterprise policy, parental control, or security product ownership.
- Whether the browser and terminal return the same A/AAAA/HTTPS answers.
- Whether internal or split-horizon names require VPN/per-link DNS and fail only in browser DoH.

## SVCB/HTTPS Records

HTTPS/SVCB records can advertise alternative endpoints and transport parameters before connection setup. They can influence HTTP/3/QUIC availability, ECH/privacy capabilities, CDN endpoint choice, and address hints.

When browser behavior differs from curl or one resolver picks a poor CDN path, compare:

```bash
dig A example.com
dig AAAA example.com
dig HTTPS example.com
curl -L -o /dev/null -sS -w 'ip=%{remote_ip} http=%{http_version} dns=%{time_namelookup} ttfb=%{time_starttransfer} total=%{time_total}\n' https://example.com
```

Do not assume DNS is solved because query time is low. Answer content, resolver policy, and browser transport choices can still drive bad connection setup or TTFB.

## IPv4, IPv6, and Happy Eyeballs

Dual-stack clients may resolve multiple A/AAAA addresses, sort them, and race connection attempts to reduce user-visible delay. A `curl -4` or `curl -6` result is useful evidence, but it is not always the same path the browser will choose.

If IPv4 and IPv6 differ, inspect DNS answers, address ordering, route metrics, firewall/VPN handling, PMTU, and CDN mapping before disabling IPv6 globally.

## Platform Policy

- macOS: inspect `scutil --dns`, `scutil --proxy`, browser Secure DNS, and VPN DNS override.
- Windows: inspect `Get-DnsClientServerAddress`, `Get-DnsClientNrptPolicy`, browser Secure DNS, WinHTTP, and VPN adapters.
- Linux: inspect `resolvectl status`, per-link domains, NetworkManager, and `/etc/resolv.conf`.

## Rules

- If public domains resolve but corporate/internal domains fail, inspect split DNS before changing global DNS.
- If VPN is active, do not replace DNS globally until split DNS and DNS hijack behavior are understood.
- If browser DNS differs from system DNS, changing OS DNS may not affect browser results.
- If DNS lookup is fast but connect/TLS/TTFB is slow, move to path, proxy, CDN, TLS, or server timing.
- Do not force public DNS on corporate networks unless the user explicitly accepts breaking internal domains.
- Do not disable browser Secure DNS as a blanket fix; use it as a scoped comparison and preserve enterprise/security requirements.
