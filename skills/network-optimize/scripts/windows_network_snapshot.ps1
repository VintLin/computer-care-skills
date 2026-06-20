$ErrorActionPreference = "Continue"

function Section($Name) {
  Write-Output ""
  Write-Output "===== $Name ====="
}

Section "System"
Get-ComputerInfo | Select-Object OsName, OsVersion, CsName

Section "Adapters"
Get-NetAdapter | Format-Table Name, Status, LinkSpeed, InterfaceDescription, MacAddress -AutoSize
Get-NetIPConfiguration

Section "DNS"
Get-DnsClientServerAddress
Get-DnsClientNrptPolicy

Section "Proxy"
netsh winhttp show proxy
Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' |
  Select-Object ProxyEnable, ProxyServer, AutoConfigURL

Section "Routes"
Get-NetRoute -AddressFamily IPv4 | Sort-Object RouteMetric |
  Select-Object -First 60 DestinationPrefix, NextHop, InterfaceAlias, RouteMetric
Get-NetRoute -AddressFamily IPv6 | Sort-Object RouteMetric |
  Select-Object -First 60 DestinationPrefix, NextHop, InterfaceAlias, RouteMetric

Section "Wi-Fi"
netsh wlan show interfaces
netsh wlan show profiles

Section "MTU"
netsh interface ipv4 show subinterfaces

Section "Packet Loss"
ping 223.6.6.6 -n 5
ping 1.1.1.1 -n 5

Section "DNS Timing"
foreach ($Server in @("223.6.6.6", "223.5.5.5", "1.1.1.1", "8.8.8.8")) {
  $Elapsed = Measure-Command {
    Resolve-DnsName apple.com -Server $Server -ErrorAction SilentlyContinue | Out-Null
  }
  Write-Output "$Server apple.com $([math]::Round($Elapsed.TotalMilliseconds, 1)) ms"
}

Section "DNS Answers"
Resolve-DnsName apple.com -Type A -ErrorAction SilentlyContinue
Resolve-DnsName apple.com -Type AAAA -ErrorAction SilentlyContinue
Resolve-DnsName apple.com -Type HTTPS -ErrorAction SilentlyContinue

Section "Curl Timing"
if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
  curl.exe -L -o NUL -sS --max-time 15 `
    -w "dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} ip=%{remote_ip} http=%{http_version}`n" `
    https://www.microsoft.com
  curl.exe -4 -L -o NUL -sS --max-time 15 -w "ipv4 ip=%{remote_ip} total=%{time_total}`n" https://www.microsoft.com
  curl.exe -6 -L -o NUL -sS --max-time 15 -w "ipv6 ip=%{remote_ip} total=%{time_total}`n" https://www.microsoft.com
}

Section "Proxy/VPN Processes"
Get-Process | Where-Object {
  $_.ProcessName -match 'xray|v2ray|clash|mihomo|verge|tailscale|wireguard'
} | Select-Object Id, ProcessName, CPU, WorkingSet

Section "Top CPU Processes"
Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Id, ProcessName, CPU, WorkingSet

Section "Delivery Optimization"
Get-DeliveryOptimizationStatus -ErrorAction SilentlyContinue
Get-DeliveryOptimizationPerfSnapThisMonth -ErrorAction SilentlyContinue

Section "TCP and Adapter Details"
Get-NetTCPSetting -ErrorAction SilentlyContinue
netsh int tcp show global
Get-NetAdapterAdvancedProperty -ErrorAction SilentlyContinue
Get-NetAdapterPowerManagement -ErrorAction SilentlyContinue

Section "Speedtest"
if (Get-Command speedtest -ErrorAction SilentlyContinue) {
  speedtest --accept-license --accept-gdpr
} else {
  Write-Output "speedtest CLI not found"
}
