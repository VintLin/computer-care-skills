# VPN and Proxy Overlap Reference

## Goal

Keep the user-required VPN path working while removing duplicate routing, DNS hijack, or proxy capture that adds latency.

Many users keep Clash/V2Ray/Xray/Mihomo, WireGuard, Tailscale, corporate VPN, or similar tools always on because they need them for normal network access. Do not ask them to pause, quit, or disable these apps as a default diagnostic step. Prefer read-only observation and in-app comparisons such as node, policy/rule mode, DNS mode, TUN ownership, system proxy ownership, or UDP/QUIC settings.

## Common Patterns

- System proxy only: apps that honor OS proxy use `127.0.0.1:port`; other apps may direct-connect.
- TUN only: all or selected traffic is routed through a virtual adapter.
- Mixed system proxy + TUN: sometimes useful, but often duplicates capture if two different tools are active.
- DNS hijack + system DNS: can conflict when both VPN and OS try to own DNS.

## Diagnosis

Check:

- Listening ports and owning processes.
- Default routes and fake-IP routes such as `198.18.0.0/15`.
- DNS resolvers and whether VPN overrides them.
- Whether required VPN/TUN tests, system-proxy tests, explicit-proxy tests, browser tests, and safe in-app node/mode variations differ.
- Whether direct or no-proxy tests would actually bypass the VPN path; fake-IP/TUN setups often keep using the VPN even when app-level proxy variables are disabled.
- Whether IPv4 and IPv6 follow the same policy.
- Whether UDP/QUIC follows the same path as TCP, especially for HTTP/3, gaming, voice/video, MASQUE, or WireGuard-like tunnels.
- Whether PAC rules, browser proxy extensions, shell proxy environment variables, or WinHTTP disagree.

Examples:

```bash
curl -x http://127.0.0.1:10808 -I --max-time 10 https://www.google.com/generate_204
curl -4 --noproxy '*' -I --max-time 10 https://www.apple.com
curl -6 --noproxy '*' -I --max-time 10 https://www.apple.com
```

```powershell
curl.exe -x http://127.0.0.1:10808 -I --max-time 10 https://www.google.com/generate_204
curl.exe -4 --noproxy "*" -I --max-time 10 https://www.microsoft.com
curl.exe -6 --noproxy "*" -I --max-time 10 https://www.microsoft.com
```

Use `--noproxy` only as an application-layer comparison. Do not present it as disabling the VPN/TUN path.

## Change Rules

- Do not ask the user to pause, quit, or disable an always-on VPN/proxy app unless they explicitly request that experiment and understand it may break access.
- Do not disable the only working VPN path.
- If explicit proxy works and direct global access fails, keep system proxy on.
- If a secondary TUN is in direct mode but still hijacks routes/DNS, prefer changing its ownership/routing/DNS settings inside the app while keeping the user's required VPN access available.
- If both tools must stay open for UI reasons, make only one responsible for system proxy/TUN/DNS.
- If VPN only proxies IPv4, inspect IPv6 leakage or bypass before changing DNS.
- If TCP works but UDP/QUIC stalls, inspect VPN MTU, PMTU, UDP relay support, firewall policy, and HTTP/3 fallback before changing global MTU.
- If browser and CLI disagree, compare browser DoH/proxy extension with shell proxy variables and WinHTTP.
- Persist changes only after a dynamic or reversible test succeeds.

## Validation

After changes, verify:

- Domestic direct site response.
- Global proxied site response.
- DNS latency and no packet loss.
- Route table no longer contains unwanted fake-IP/TUN routes.
- Speed/responsiveness baseline improved or at least did not regress.
