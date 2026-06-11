# Windows Network Optimization Reference

## Read-Only Diagnosis

Use PowerShell as Administrator only when a command requires it. Start read-only:

```powershell
Get-NetAdapter | Format-Table Name, Status, LinkSpeed, MacAddress
Get-NetIPConfiguration
Get-DnsClientServerAddress
Get-DnsClientNrptPolicy
Get-NetRoute -AddressFamily IPv4 | Sort-Object RouteMetric | Select-Object -First 30
Get-NetRoute -AddressFamily IPv6 | Sort-Object RouteMetric | Select-Object -First 30
netsh winhttp show proxy
Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' |
  Select-Object ProxyEnable, ProxyServer, AutoConfigURL
Get-NetAdapterStatistics
Get-NetTCPSetting
netsh int tcp show global
Get-Process | Sort-Object CPU -Descending | Select-Object -First 20
```

Wi-Fi details:

```powershell
netsh wlan show interfaces
netsh wlan show profiles
```

Bandwidth and responsiveness:

```powershell
winget list Ookla
speedtest --accept-license --accept-gdpr
```

If Speedtest CLI is unavailable, use browser tests cautiously and record that results are less reproducible.

Background update traffic:

```powershell
Get-DeliveryOptimizationStatus
Get-DeliveryOptimizationPerfSnapThisMonth
```

## DNS

Inspect and test:

```powershell
Resolve-DnsName apple.com
Resolve-DnsName apple.com -Type A
Resolve-DnsName apple.com -Type AAAA
Resolve-DnsName apple.com -Type HTTPS
Measure-Command { Resolve-DnsName apple.com -Server 223.6.6.6 }
Measure-Command { Resolve-DnsName apple.com -Server 223.5.5.5 }
```

Flush cache:

```powershell
Clear-DnsClientCache
```

Set DNS on a named adapter only after identifying it:

```powershell
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses 223.6.6.6,223.5.5.5
```

Rollback to DHCP DNS:

```powershell
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ResetServerAddresses
```

## MTU

Inspect:

```powershell
netsh interface ipv4 show subinterfaces
```

DF ping tests:

```powershell
ping 223.6.6.6 -f -l 1472
ping 223.6.6.6 -f -l 1464
```

Set MTU only with evidence:

```powershell
netsh interface ipv4 set subinterface "Wi-Fi" mtu=1492 store=persistent
```

Rollback:

```powershell
netsh interface ipv4 set subinterface "Wi-Fi" mtu=1500 store=persistent
```

## IPv4 and IPv6

Compare both families before disabling IPv6:

```powershell
Get-NetRoute -AddressFamily IPv4 | Sort-Object RouteMetric | Select-Object -First 30
Get-NetRoute -AddressFamily IPv6 | Sort-Object RouteMetric | Select-Object -First 30
curl.exe -4 -L -o NUL -sS -w "ip=%{remote_ip} total=%{time_total}`n" https://www.microsoft.com
curl.exe -6 -L -o NUL -sS -w "ip=%{remote_ip} total=%{time_total}`n" https://www.microsoft.com
```

If IPv6 differs, inspect DNS answers, route, PMTU, VPN handling, firewall, and CDN mapping before disabling IPv6 globally.

## Wi-Fi

From `netsh wlan show interfaces`, inspect:

- Radio type and band/channel.
- Receive/transmit rate.
- Signal percentage.
- BSSID if roaming between APs.

If a 2.4 GHz profile is preferred over 5 GHz, raise priority or remove only the stale profile after confirming the exact name:

```powershell
netsh wlan set profileorder name="SSID-5G" interface="Wi-Fi" priority=1
netsh wlan delete profile name="old-ssid"
```

## Delivery Optimization, Metered, and Power

If the network is slow during Windows Update, Microsoft Store, Xbox/Game Pass, or large app installs, inspect Delivery Optimization before blaming DNS or Wi-Fi.

If upload latency spikes while the user is not intentionally uploading, inspect Delivery Optimization peer upload, OneDrive, browser sync, game launchers, and package managers.

Check metered connection and adapter power settings before assuming a network path fault.

## Proxy and VPN

Inspect both WinHTTP and per-user proxy:

```powershell
netsh winhttp show proxy
Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' |
  Select-Object ProxyEnable, ProxyServer, AutoConfigURL
Get-NetAdapter | Where-Object {$_.InterfaceDescription -match 'TAP|TUN|Wintun|WireGuard|Tailscale|Clash|Mihomo|v2ray|xray'}
```

Avoid double capture: if a VPN TUN adapter is active and system proxy also points to another VPN core, test which path is required before disabling either one.

## Application Timing

Use curl timing to split DNS, TCP, TLS, TTFB, and total time:

```powershell
curl.exe -L -o NUL -sS `
  -w "dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} ip=%{remote_ip} http=%{http_version}`n" `
  https://www.microsoft.com
```

If browser and curl disagree, inspect browser Secure DNS, QUIC/HTTP3, proxy extensions, certificate interception, and security software before changing DNS.
