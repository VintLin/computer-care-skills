# Browser and Application Layer Reference

## When to Read

Read this when a browser, CLI, SaaS app, API client, Git/npm/pip/Docker, or one protocol is slow while the rest of the network seems healthy.

## Browser vs Curl

If browser is slow but curl is fast, inspect:

- Browser Secure DNS/DoH.
- HTTPS/SVCB records, address hints, and CDN endpoint selection.
- HTTP/3/QUIC over UDP 443.
- Proxy extensions, PAC files, or per-browser proxy settings.
- Cache, service workers, and extensions.
- Certificate interception, content filters, EDR, or antivirus.
- NetLog or HAR only after warning about sensitive data.

If terminal is slow but browser is fast, inspect:

- `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`.
- Windows WinHTTP proxy.
- CLI CA certificate store.
- WSL/Docker/container DNS and proxy inheritance.
- Package registry mirror or CDN mapping.

## HTTP Version Matrix

Run only what the local curl supports:

```bash
curl --http1.1 -L -o /dev/null -sS -w 'http=%{http_version} total=%{time_total} ip=%{remote_ip}\n' https://example.com
curl --http2 -L -o /dev/null -sS -w 'http=%{http_version} total=%{time_total} ip=%{remote_ip}\n' https://example.com
curl --http3 -L -o /dev/null -sS -w 'http=%{http_version} total=%{time_total} ip=%{remote_ip}\n' https://example.com
```

If HTTP/3 is slower or intermittent, inspect VPN, firewall, router QoS/SQM, PMTU, UDP proxy support, and browser QUIC settings before changing DNS.

If HTTPS/SVCB answers advertise HTTP/3, ECH, or alternative endpoints, compare browser behavior with curl carefully. Curl may not use the same DNS path, HTTPS record handling, cache, or Happy Eyeballs policy as the browser.

## Browser Logs

- DevTools Network HAR: useful for page resource timing.
- Chrome/Edge NetLog: useful for DNS, proxy, TLS, QUIC, socket reuse, and certificate issues.

HAR and NetLog may include URLs, cookies, tokens, headers, internal hostnames, and proxy metadata. Do not ask for raw uploads without a redaction step.

## macOS Apple Privacy Features

If Safari differs from Chrome/Firefox or speedtest changes only in Safari:

- Inspect iCloud Private Relay, Hide IP Address, Limit IP Address Tracking, VPN state, and browser DNS.
- Treat Private Relay as a measurement path difference before changing DNS or MTU.
- Do not recommend disabling privacy features globally; use scoped comparisons and explain the privacy impact.
