# DNS, DoH, and Split DNS Reference

## Diagnosis Goals

Separate DNS latency from DNS answer quality and DNS routing policy:

- Latency: how long the query takes.
- Answer quality: which A/AAAA/HTTPS/SVCB answers are returned.
- Policy: whether VPN, browser DoH, NRPT, per-link DNS, PAC, or enterprise tools override the system resolver.

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
