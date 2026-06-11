结论：现有 skill 的方向是对的，尤其是“只读诊断优先、最小可逆变更、变更后复测”的安全边界；但它目前偏 **macOS + Windows + VPN/proxy**，还缺少 **Linux 支持、TCP/网卡层、IPv6/双栈、浏览器 DoH、路由器/SQM/bufferbloat、应用层时延拆解、企业安全软件/策略** 等维度。建议把 skill 扩展成“终端侧 → 接入侧 → 路径侧 → 应用侧”的分层诊断框架。现有文档已覆盖 Wi‑Fi、DNS、MTU/path‑MTU、丢包、带宽测试、后台流量、旧 Wi‑Fi、mDNS/Bonjour、VPN/proxy/TUN 重叠，并要求修改前说明结论、原因、风险、下一步、范围和验证方法，这部分应保留为核心原则。

## 1. 建议新增的核心分析维度

### 1. Loaded latency / bufferbloat / SQM

现有文档有带宽、延迟和丢包，但还应单独加入“空闲延迟 vs 满载延迟”。很多“网速慢”的体感不是下载带宽低，而是上传/下载满载时排队延迟暴涨，表现为会议卡顿、网页首包慢、游戏延迟飙升。macOS 可加入 `networkQuality` 作为响应性/RPM 与容量基线；Linux/路由器侧可加入 CAKE/SQM 判断，CAKE 是 Linux qdisc，组合了 shaping、AQM、公平队列和链路层开销补偿，适合处理 bufferbloat 类问题。([keith.github.io][1])

建议新增判断规则：

| 现象                    | 可能瓶颈                         | 建议动作                                           |
| --------------------- | ---------------------------- | ---------------------------------------------- |
| Speedtest 下载高，但会议/游戏卡 | loaded latency / bufferbloat | 测空闲 ping 与满载 ping；优先在路由器启用 SQM/CAKE，而不是盲目改 DNS |
| 上传时全网变慢               | 上行队列拥塞                       | SQM 上行限速到实测上行的 85%–95% 左右再复测                   |
| VPN 下更明显              | VPN 出口或本地 TUN 队列             | 分别测直连、系统代理、TUN、浏览器代理路径                         |

### 2. IPv6 / 双栈 / Happy Eyeballs / 路由优先级

应新增 IPv4 与 IPv6 分开测速和解析：`curl -4`、`curl -6`、A/AAAA DNS 结果、IPv6 默认路由、RA、DNS64/NAT64、VPN 是否只代理 IPv4。Linux `ip route`/`ip -6 route` 可查看和管理路由，路由项还能带 MTU；若未锁定 MTU，内核可根据 Path MTU Discovery 更新路径 MTU。Windows `Get-NetIPConfiguration -All` 可采集接口、IP、DNS 等完整配置。([Debian Manpages][2])

新增判断规则：

| 现象              | 可能原因                      | 处理策略                             |
| --------------- | ------------------------- | -------------------------------- |
| 网页偶发卡住几秒后恢复     | IPv6 路径坏、AAAA 优先但不可达      | 分别测 IPv4/IPv6 DNS、ping、curl 连接时间 |
| 直连正常，VPN 后部分站点慢 | VPN 只代理 IPv4 或 IPv6 泄漏/绕过 | 检查 IPv6 默认路由、VPN TUN 路由和 DNS     |
| 只有部分 CDN 慢      | IPv4/IPv6 命中的 CDN 不同      | 比较 `remote_ip`、ASN/地理路径、TLS/TTFB |

不建议默认“关闭 IPv6”。更安全的策略是先定位是 DNS、路由、PMTU、VPN 还是 CDN 选择问题，再做局部修正。

### 3. DNS、DoH、分流 DNS、浏览器 DNS

现有文档已有 DNS 延迟与 VPN DNS 冲突，但建议扩展到 **系统 DNS、浏览器 DoH、VPN split DNS、Windows NRPT、Linux per-link DNS、macOS service DNS** 的差异。Windows DNS 客户端支持 DoH 模式，包括仅加密、优先加密回退、仅未加密等；Linux `resolvectl` 可查看全局和 per-link DNS，并能管理 LLMNR、mDNS、DNSSEC、DNS-over-TLS、flush caches 等；Windows 的 DnsClient 模块还包含缓存、解析、NRPT 规则相关命令。([Microsoft Learn][3])

建议新增检查：

| 层级      | 需要采集                                                |
| ------- | --------------------------------------------------- |
| 系统 DNS  | DNS server、search domain、split DNS、缓存状态             |
| VPN DNS | 是否 hijack DNS、fake-IP、198.18.0.0/15、DoH/DoT 上游      |
| 浏览器 DNS | Chrome/Edge/Firefox Secure DNS 是否绕过系统 DNS           |
| 企业策略    | Windows NRPT、MDM、EDR、DNS filter、公司 VPN split tunnel |
| 验证指标    | `time_namelookup`、解析 IP、是否命中代理、是否返回内网域名             |

判断规则：如果 `time_namelookup` 很低，但 `time_connect`、`time_appconnect` 或 `time_starttransfer` 高，就不要继续优化 DNS，应转向 TCP、TLS、CDN、代理或服务端路径。curl 的 `--write-out` 可输出 DNS、TCP connect、TLS、TTFB、总耗时、代理是否使用、远端 IP 等变量，适合做跨平台应用层拆解。([curl.se][4])

### 4. TCP 栈、拥塞控制、窗口自动调优

Windows 和 Linux 都应加入 TCP 层诊断，但默认只读，不应盲目套“网络优化参数”。Windows 的 TCP setting 包含自动调优、拥塞控制、ECN、Delayed ACK 等项目；Microsoft 也强调网络适配器调优取决于硬件、工作负载、服务器资源和性能目标，修改前应先评估现状。([Microsoft Learn][5])

建议新增采集项：

| 系统      | 只读命令                                                                      |
| ------- | ------------------------------------------------------------------------- |
| Windows | `Get-NetTCPSetting`、`netsh int tcp show global`                           |
| Linux   | `sysctl net.ipv4.tcp_congestion_control net.core.default_qdisc`、`ss -tin` |
| macOS   | `netstat -s`、`sysctl net.inet.tcp.*` 只读采样                                 |

建议规则：

* 客户端桌面环境：通常不建议直接改 TCP 全局参数。
* 高 RTT、高带宽、服务器、网关、NAS：可分析拥塞控制、窗口、队列、offload。
* 所有 TCP 参数改动必须给出回滚命令和前后指标。

### 5. 网卡、驱动、offload、队列、错误计数

现有文档只关注 Wi‑Fi 和后台流量，建议加入 Ethernet/Wi‑Fi 网卡硬件层：链路速率、双工、自协商、RSS/RPS/RFS/XPS、checksum offload、TSO/GSO/GRO/LSO、RSC、ring buffer、interrupt coalescing、EEE 节能以太网、驱动版本、错误包、丢弃包。

Windows 可用 `Get-NetAdapterStatistics` 查看 broadcast、multicast、discard、error 等统计；`Get-NetAdapterAdvancedProperty` 可读高级属性；`Get-NetAdapterPowerManagement` 可读电源管理能力；但 `Set-NetAdapterAdvancedProperty` 会设置高级属性并写入注册表，必须列为高风险变更。([Microsoft Learn][6])

Linux 可用 `ethtool` 查询和控制网卡驱动/硬件设置，包括 pause、coalescing、ring、driver、offload、channel、EEE 等；Linux 内核还提供 RSS、RPS、RFS、XPS 等扩展，RSS 可把 NIC 接收队列分散到多个 CPU。([man7.org][7])

新增判断规则：

| 现象                | 可能原因                             |
| ----------------- | -------------------------------- |
| 有线只跑 100 Mbps     | 网线/端口/自协商降速                      |
| 下载高 CPU、高丢包       | offload、RSS、驱动问题                 |
| 小包延迟高但吞吐正常        | interrupt coalescing 过大          |
| 空闲掉线或睡眠后慢         | 网卡省电/EEE/电源管理                    |
| Linux 路由器/NAS 跑不满 | 队列、IRQ 亲和、RSS/RPS/XPS、GRO/TSO 设置 |

### 6. Wi‑Fi 6E/6 GHz、信道宽度、漫游、路由器安全模式

现有文档已有 2.4 GHz 拥塞、5/6 GHz 优先，但建议更系统地加入：RSSI、噪声、SNR、MCS、NSS、信道宽度、频段、BSSID、漫游、AP backhaul、WPA 模式、低数据模式、Wi‑Fi 6E 自动模式。

Apple 建议 Wi‑Fi 6E 网络在支持设备和路由器上可使用 6 GHz 以获得更快、更可靠的连接，并建议同一路由器的 2.4/5/6 GHz 使用单一网络名称以获得最佳性能；Apple 路由器设置建议也强调使用 WPA3 Personal 或 WPA2/WPA3 Transitional，避免 WEP、TKIP、WPA/WPA2 mixed 等过时安全模式，因为会影响安全性、可靠性和性能。([苹果支持][8])

macOS 还可把 Apple Wireless Diagnostics 作为只读诊断入口，它会分析 Wi‑Fi 和互联网连接、给出问题与建议，并不会更改网络设置。([苹果支持][9])

Windows 侧可加入 `netsh wlan show interfaces`、`netsh wlan show wlanreport`；无线网络报告包含适配器、驱动版本、IPConfig、Wi‑Fi 配置文件、发现的网络、断连原因和会话信息。([Microsoft Learn][10])

Linux 侧建议用 `iw` 取代旧的 Wireless Extensions 工具；`iw` 是基于 nl80211 的无线配置 CLI，适合现代无线驱动。([wireless.docs.kernel.org][11])

### 7. 代理、PAC、WinHTTP、环境变量、浏览器差异

现有 VPN/proxy/TUN 维度很好，建议扩展为“多层代理一致性检查”：

| 层级         | 示例                                           |
| ---------- | -------------------------------------------- |
| 系统代理       | macOS networksetup、Windows Internet Settings |
| WinHTTP 代理 | Windows 服务、系统组件、部分 CLI                       |
| 浏览器代理      | Chrome/Edge/Firefox、插件                       |
| 命令行代理      | `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY`        |
| VPN/TUN    | 路由表、fake-IP、DNS hijack、透明代理                  |
| PAC        | 域名分流、内网域名、CDN 域名误判                           |

macOS `networksetup` 可列出网络服务，并设置 DNS、search domain、web proxy 等；Windows `Get-WinhttpProxy` 可显示 WinHTTP 当前代理；curl 支持通过环境变量使用代理，也能通过 `proxy_used` 输出确认请求是否经过代理。([苹果支持][12])

新增判断规则：

* 同一 URL 分别用系统浏览器、curl、指定 no-proxy、指定 proxy 测一次。
* 如果浏览器慢但 curl 快，优先检查浏览器 DoH、插件、代理扩展、QUIC/HTTP3、缓存和安全软件。
* 如果 CLI 慢但浏览器快，优先检查环境变量代理、WinHTTP、企业证书、CLI DNS。
* 如果系统代理和 TUN 同时开启，保留现有文档中的“双重捕获”判断。

### 8. 路径层：mtr、tracepath、iperf3、PMTU

建议把路径层拆成三类：可达性、路径时延/丢包、容量。Linux `tracepath` 可追踪路径并发现 MTU，且不需要超级用户；`mtr` 结合了 traceroute 和 ping，可输出响应时间和丢包；iPerf3 是主动测量最大可达带宽的工具，支持 TCP/UDP/SCTP、IPv4/IPv6，并可报告带宽、丢包等指标。([man7.org][13])

建议新增路径判断：

| 测试                  | 目标                  |
| ------------------- | ------------------- |
| ping 网关             | 判断本地 Wi‑Fi/有线是否稳定   |
| ping DNS/公网 IP      | 判断 ISP 基础连通性        |
| DNS query           | 判断解析耗时              |
| curl timing         | 判断 DNS/TCP/TLS/TTFB |
| mtr/pathping        | 判断哪一跳开始抖动或丢包        |
| tracepath / DF ping | 判断 PMTU             |
| iperf3 到局域网服务器      | 区分局域网瓶颈和公网瓶颈        |

### 9. Windows 包丢失深度诊断：Pktmon

当普通 ping、pathping、adapter statistics 无法解释丢包时，可把 Windows Pktmon 加入高级诊断。Microsoft 文档建议排查包丢失时先捕获 Pktmon trace；Pktmon 可以捕获包跟踪、把本地包丢失归因到原因和代码位置，并收集包丢失统计。([Microsoft Learn][14])

这类采集应标记为：

* 高隐私敏感：可能包含域名、IP、部分流量元数据。
* 默认不启用。
* 输出前提醒用户脱敏。
* 仅在只读指标无法解释时使用。

### 10. 电源、省流量、安全软件、系统策略

建议新增“非网络栈但影响网速”的配置：

| 维度      | macOS                                 | Windows                                       | Linux                                            |
| ------- | ------------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| 省流量/低数据 | Wi‑Fi Low Data Mode、Limit IP tracking | Metered connection                            | NetworkManager metered                           |
| 电源管理    | 睡眠、低电量、Wi‑Fi 省电                       | 网卡 Power Management                           | Wi‑Fi powersave、TLP                              |
| 安全软件    | Network Extension、内容过滤                | Defender/EDR/VPN filter driver                | nftables/iptables、EDR agent                      |
| 企业策略    | MDM、配置描述文件                            | GPO、NRPT、WinHTTP                              | systemd-resolved、NetworkManager profiles         |
| 后台服务    | iCloud、Photos、系统更新                    | Delivery Optimization、OneDrive、Windows Update | apt/dnf/pacman、container image pull、snap/flatpak |

这些项不应默认修改，只应在证据明确时提示用户关闭某个范围很小的功能，并给出回滚方式。

## 2. 建议新增的跨平台只读基线

| 维度       | macOS                                                     | Windows                                                             | Linux                                                          | 采集目的                   |                 |
| -------- | --------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------- | --------------- |
| 系统与接口    | `sw_vers`、`networksetup -listallhardwareports`、`ifconfig` | `Get-NetIPConfiguration -All`、`Get-NetAdapter`                      | `uname -a`、`ip -br addr`、`nmcli dev show`                      | OS、接口、IP、DNS、网关        |                 |
| 默认路由     | `route -n get default`、`netstat -rn`                      | `Get-NetRoute`                                                      | `ip route`、`ip -6 route`                                       | 判断出口和 VPN/TUN 接管       |                 |
| DNS      | `scutil --dns`                                            | `Get-DnsClientServerAddress`、`Resolve-DnsName`、`Get-DnsClientCache` | `resolvectl status`、`resolvectl query`、`resolvectl statistics` | 系统 DNS、per-link DNS、缓存 |                 |
| 代理       | `scutil --proxy`、`networksetup -getwebproxy`              | `Get-WinhttpProxy`、系统代理                                             | `env | grep -Ei 'proxy                                         | no_proxy'`             | 发现系统/CLI/服务代理差异 |
| Wi‑Fi    | Wireless Diagnostics、RSSI/Noise/BSSID/Channel             | `netsh wlan show interfaces`、`netsh wlan show wlanreport`           | `iw dev`、`iw dev <iface> link`、`nmcli dev wifi`                | 信号、频段、速率、断连原因          |                 |
| MTU/PMTU | `ping -D -s ...`、`ifconfig`                               | `ping -f -l ...`、`netsh interface ipv4 show subinterfaces`          | `tracepath`、`ping -M do -s ...`、`ip link show`                 | 发现 VPN/PPPoE/PMTU 黑洞   |                 |
| 应用时延     | `curl -w`                                                 | `curl.exe -w`                                                       | `curl -w`                                                      | DNS/TCP/TLS/TTFB/总耗时   |                 |
| 路径丢包     | `ping`、`mtr` 如已安装                                         | `ping`、`pathping`、`Test-NetConnection`                              | `ping`、`mtr`、`tracepath`                                       | 抖动、丢包、路径变化             |                 |
| 网卡统计     | `netstat -s`、`ifconfig`                                   | `Get-NetAdapterStatistics`                                          | `ip -s link`、`ethtool -S`                                      | errors、drops、discards  |                 |
| TCP/网卡能力 | `sysctl` 只读                                               | `Get-NetTCPSetting`、`Get-NetAdapterAdvancedProperty`                | `sysctl`、`ss -tin`、`ethtool -k/-c/-g/-l`                       | offload、队列、TCP 状态      |                 |

Linux 的网络管理应兼容 NetworkManager 和 systemd-resolved：NetworkManager 是 Linux 常用网络配置工具套件，可用于桌面、服务器和移动环境；systemd-resolved 的 `resolvectl` 可读取和调整 per-link DNS、DoT、DNSSEC、mDNS、LLMNR 等状态。([NetworkManager][15])

## 3. 建议新增文件结构

现有文档已经有 `references/macos.md`、`references/windows.md`、`references/vpn-proxy.md`，以及 macOS、Windows 的只读 snapshot 脚本；建议补齐 Linux，并把通用维度拆出来。

```text
optimize-network/
  SKILL.md
  references/
    common-baseline.md
    macos.md
    windows.md
    linux.md
    wifi.md
    dns-doh-splitdns.md
    tcp-nic.md
    mtu-pmtu.md
    vpn-proxy.md
    router-sqm-bufferbloat.md
    browser-app-layer.md
    privacy-and-safety.md
  scripts/
    macos_network_snapshot.sh
    windows_network_snapshot.ps1
    linux_network_snapshot.sh
    curl_timing_matrix.sh
    compare_before_after.py
```

其中 `linux_network_snapshot.sh` 建议默认只读，采集：

```bash
#!/usr/bin/env bash
set -u

echo "## OS"
uname -a
cat /etc/os-release 2>/dev/null || true

echo "## Interfaces"
ip -br addr
ip -s link

echo "## Routes"
ip route
ip -6 route

echo "## DNS"
resolvectl status 2>/dev/null || true
resolvectl statistics 2>/dev/null || true
cat /etc/resolv.conf 2>/dev/null || true

echo "## NetworkManager"
nmcli dev status 2>/dev/null || true
nmcli con show --active 2>/dev/null || true

echo "## Proxy env"
env | grep -Ei '^(http|https|all|no)_proxy=' || true

echo "## Wi-Fi"
iw dev 2>/dev/null || true
for i in /sys/class/net/*; do
  iface="$(basename "$i")"
  iw dev "$iface" link 2>/dev/null || true
done

echo "## TCP"
sysctl net.ipv4.tcp_congestion_control 2>/dev/null || true
sysctl net.core.default_qdisc 2>/dev/null || true
ss -tin state established 2>/dev/null | head -100 || true

echo "## NIC offload/statistics"
for i in /sys/class/net/*; do
  iface="$(basename "$i")"
  [ "$iface" = "lo" ] && continue
  echo "### $iface"
  ethtool "$iface" 2>/dev/null || true
  ethtool -S "$iface" 2>/dev/null | head -80 || true
  ethtool -k "$iface" 2>/dev/null || true
done
```

## 4. 建议的配置变更分级

| 等级      | 类型      | 示例                                                                                          | 是否默认执行    |
| ------- | ------- | ------------------------------------------------------------------------------------------- | --------- |
| Level 0 | 只读诊断    | 路由、DNS、proxy、Wi‑Fi、curl timing、adapter stats                                                | 是         |
| Level 1 | 低风险可逆   | flush DNS cache、切换 5/6 GHz、换 VPN 节点、暂停明确后台下载                                                | 需说明后执行    |
| Level 2 | 局部配置    | 设置 per-interface DNS、调整 MTU、代理 bypass、Wi‑Fi 6E 自动模式、关闭低数据模式                                 | 需证据 + 回滚  |
| Level 3 | 高风险系统配置 | Windows adapter advanced property、Linux offload/ring/coalescing、TCP 拥塞控制、禁用 IPv6、改注册表、改系统服务 | 默认不执行     |
| Level 4 | 网络设备配置  | 路由器 SQM/CAKE、信道宽度、WPA 模式、固件升级、AP backhaul                                                   | 需用户确认设备权限 |

Windows 的 adapter advanced property 修改会写入注册表；Linux `ip link set ... mtu` 会直接修改接口 MTU；`ethtool` 可修改 offload、ring、coalescing 等驱动/硬件行为，因此这类操作必须作为高风险变更处理，并提供 rollback。([Microsoft Learn][16])

## 5. 建议加入 skill 的新启发式规则

可直接加入 `Decision Heuristics`：

```markdown
- If idle latency is normal but latency spikes during upload/download, classify as loaded-latency/bufferbloat before changing DNS.
- If DNS lookup is fast but TCP/TLS/TTFB is slow, do not over-optimize DNS; inspect route, proxy, CDN, TLS, or server timing.
- If IPv4 and IPv6 behave differently, treat it as dual-stack routing/DNS/PMTU before disabling IPv6 globally.
- If browser and curl results differ, inspect browser Secure DNS/DoH, extensions, proxy settings, HTTP/3/QUIC, and security filters.
- If CLI tools are slow but browser is fast, inspect environment proxy variables, WinHTTP proxy, shell DNS, and corporate certificates.
- If Wi-Fi RSSI is strong but throughput is low, inspect channel width, band, MCS/NSS, BSSID roaming, AP backhaul, WPA mode, and driver.
- If Ethernet negotiates below expected speed, inspect cable, switch port, duplex, EEE, driver, and error counters.
- If adapter errors/drops increase during tests, prioritize NIC/driver/offload/queue diagnosis over DNS or VPN.
- If VPN/TUN is active, run separate direct, system-proxy, TUN, and browser tests before interpreting speedtest results.
- If system DNS is fully overridden by VPN or browser DoH, changing OS DNS may not affect the observed application.
- If a change touches TCP globals, registry, offload, MTU, IPv6, firewall, EDR, or router firmware, require explicit scope, rollback, and before/after validation.
```

## 6. 建议更新后的 skill 描述

```yaml
name: optimize-network
description: Diagnose and safely optimize network performance on macOS, Windows, and Linux, including Wi-Fi/Ethernet link quality, DNS/DoH/split DNS, IPv4/IPv6 routing, MTU/path-MTU/MSS, packet loss, bandwidth and loaded latency, TCP/NIC offload and queueing, background bandwidth users, stale preferred networks, mDNS/Bonjour/LLMNR noise, browser-vs-system networking, router SQM/bufferbloat, and VPN/proxy/PAC/TUN overlap. Use when the user asks to analyze slow internet, unstable latency, DNS issues, Wi-Fi interference, Ethernet speed limits, speedtest results, VPN-on networking, Clash/V2Ray/Xray/Mihomo routing conflicts, browser-only slowness, or improving network speed while keeping VPN and rollback safety.
```

## 7. 推荐的最终诊断顺序

```text
1. 明确目标
   - 慢的是网页、下载、会议、游戏、SSH、包管理器、Docker、AI API，还是全部应用？

2. 采集只读基线
   - OS、接口、默认路由、DNS、proxy、VPN/TUN、Wi‑Fi/Ethernet、IPv4/IPv6、后台流量。

3. 分层测量
   - 网关 ping
   - 公网 IP ping
   - DNS 查询
   - curl timing
   - IPv4 vs IPv6
   - direct vs proxy vs VPN/TUN
   - idle vs loaded latency
   - path/mtr/tracepath
   - iperf3，如有可控测试端

4. 分类瓶颈
   - 接入层：Wi‑Fi、有线、驱动、路由器、信道、EEE
   - 解析层：DNS、DoH、split DNS、缓存
   - 路径层：路由、MTU、PMTU、丢包、ISP、VPN 出口
   - 传输层：TCP、拥塞控制、offload、队列
   - 应用层：浏览器、代理、HTTP/TLS、CDN、服务端 TTFB
   - 策略层：企业 VPN、EDR、防火墙、MDM/GPO

5. 只做最小可逆修复
   - 先缓存/链路/代理路径/节点选择
   - 再 DNS/MTU/per-interface 配置
   - 最后才是 TCP、offload、注册表、系统服务、路由器固件

6. 同指标复测
   - before/after 必须包含：带宽、idle latency、loaded latency、DNS、curl timing、丢包、路径、VPN/direct 对比。
```

优先落地顺序：先补 `linux.md` 和 `linux_network_snapshot.sh`，再补 `dns-doh-splitdns.md`、`tcp-nic.md`、`router-sqm-bufferbloat.md`、`browser-app-layer.md`。这样 skill 会从“常见网络修复”升级为“跨 macOS / Windows / Linux 的证据驱动网络诊断与安全优化”。

[1]: https://keith.github.io/xcode-man-pages/networkQuality.8.html "networkQuality(8)"
[2]: https://manpages.debian.org/testing/iproute2/ip-route.8.en.html "ip-route(8) — iproute2 — Debian testing — Debian Manpages"
[3]: https://learn.microsoft.com/en-us/windows-server/networking/dns/doh-client-support "Secure DNS Client over HTTPS (DoH) on Windows Server 2022 | Microsoft Learn"
[4]: https://curl.se/docs/manpage.html "curl - How To Use"
[5]: https://learn.microsoft.com/en-us/powershell/module/nettcpip/get-nettcpsetting?view=windowsserver2025-ps "Get-NetTCPSetting (NetTCPIP) | Microsoft Learn"
[6]: https://learn.microsoft.com/en-us/powershell/module/netadapter/get-netadapterstatistics?view=windowsserver2025-ps "Get-NetAdapterStatistics (NetAdapter) | Microsoft Learn"
[7]: https://man7.org/linux/man-pages/man8/ethtool.8.html "ethtool(8) - Linux manual page"
[8]: https://support.apple.com/en-asia/102285 "Use Wi-Fi 6E networks with Apple devices - Apple Support"
[9]: https://support.apple.com/guide/mac-help/use-wireless-diagnostics-mchlf4de377f/mac "Use Wireless Diagnostics on your Mac - Apple Support (NZ)"
[10]: https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-wlan "netsh wlan | Microsoft Learn"
[11]: https://wireless.docs.kernel.org/en/latest/en/users/documentation/iw.html "About iw — Linux Wireless  documentation"
[12]: https://support.apple.com/guide/remote-desktop/about-networksetup-apdd0c5a2d5/mac "About networksetup in Remote Desktop - Apple Support"
[13]: https://man7.org/linux/man-pages/man8/tracepath.8.html "tracepath(8) - Linux manual page"
[14]: https://learn.microsoft.com/en-us/troubleshoot/windows-client/networking/diagnose-packet-loss "Diagnose Packet Loss - Windows Client | Microsoft Learn"
[15]: https://networkmanager.dev/ " NetworkManager "
[16]: https://learn.microsoft.com/en-us/powershell/module/netadapter/set-netadapteradvancedproperty?view=windowsserver2025-ps "Set-NetAdapterAdvancedProperty (NetAdapter) | Microsoft Learn"

----

有。你现有文档已经覆盖了 macOS/Windows、Wi‑Fi、DNS、MTU、丢包、带宽、后台流量、VPN/proxy/TUN，并且有“只读诊断优先、最小可逆变更、复测验证”的安全原则；下一步建议补的是**误判防护、应用层协议、虚拟化/容器、路由器高级特性、企业策略和隐私功能**。

## 1. 加一个“症状入口”，不要只按 OS 入口诊断

现在的 workflow 是先识别 OS 和接口，再做基线。建议在最前面加一个“用户体感分类”，因为不同慢法对应完全不同的瓶颈：

| 症状                                        | 优先怀疑                                                     |
| ------------------------------------------- | ------------------------------------------------------------ |
| 网页首开慢，但下载速度正常                  | DNS、TCP/TLS、HTTP/3 fallback、代理、浏览器插件              |
| 视频会议卡、游戏延迟高                      | loaded latency、bufferbloat、Wi‑Fi 抖动、上行拥塞            |
| Speedtest 很快，但 GitHub/npm/pip/Docker 慢 | 代理规则、CDN、IPv6、SNI/HTTP3、registry mirror              |
| 只有浏览器慢，curl 正常                     | 浏览器 DoH、QUIC/HTTP3、扩展、NetLog、缓存、证书/安全软件    |
| 只有终端慢，浏览器正常                      | shell proxy env、WinHTTP、WSL/Docker DNS、CLI CA 证书        |
| 开 VPN 后内网域名异常                       | split DNS、NRPT、systemd-resolved per-link DNS、VPN DNS hijack |
| 局域网 NAS/SSH 慢                           | 有线协商速率、网卡 offload、交换机、AP backhaul、MTU         |

这部分可以让 skill 更像“网络问诊”，而不是直接跑命令。

## 2. 补 HTTP/3 / QUIC / UDP 443 诊断

前面提到过 curl timing，但还应明确把 **HTTP/1.1、HTTP/2、HTTP/3/QUIC** 分开测。HTTP/3 是 HTTP 语义在 QUIC 上的映射，而 HTTP/3 通常使用 UDP 443；如果网络、公司防火墙、路由器 QoS、VPN 或代理对 UDP 443 处理不好，就会出现“浏览器首开慢、curl 正常、刷新后变快”的现象。([IETF Datatracker](https://datatracker.ietf.org/doc/rfc9114/?utm_source=chatgpt.com))

建议加入测试矩阵：

```bash
# 基础 timing
curl -L -o /dev/null -s -w \
'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} ip=%{remote_ip} http=%{http_version}\n' \
https://example.com

# 强制 HTTP/1.1
curl --http1.1 -L -o /dev/null -s -w '%{http_version} %{time_total}\n' https://example.com

# 强制 HTTP/2
curl --http2 -L -o /dev/null -s -w '%{http_version} %{time_total}\n' https://example.com

# HTTP/3，仅在本机 curl 支持 HTTP/3 时使用
curl --http3 -L -o /dev/null -s -w '%{http_version} %{time_total}\n' https://example.com
```

启发式规则：

```markdown
- If browser is slow but curl over HTTP/1.1 or HTTP/2 is fast, test HTTP/3/QUIC and UDP/443 handling.
- If HTTP/3 is slower or intermittently fails, inspect VPN, firewall, router QoS/SQM, UDP proxy support, and browser QUIC settings before changing DNS.
```

## 3. 补浏览器 NetLog / HAR 作为高级诊断

很多网页慢不是系统网络慢，而是浏览器层的问题。Chromium 的 NetLog 是 Chrome 网络栈的事件日志机制，Microsoft 也说明 NetLog 内置于 Chromium-based browsers，例如 Edge、Chrome、Electron，可用于诊断 HAR 或 Fiddler 不够用的场景。([Chromium](https://www.chromium.org/developers/design-documents/network-stack/netlog/?utm_source=chatgpt.com))

建议加入：

| 场景                        | 工具                                                     |
| --------------------------- | -------------------------------------------------------- |
| 浏览器慢、curl 快           | Chrome/Edge `chrome://net-export` 或 `edge://net-export` |
| 页面资源慢                  | DevTools Network HAR                                     |
| TLS/证书/代理/DoH/QUIC 异常 | NetLog                                                   |
| WebSocket/SSE/API 慢        | DevTools + NetLog                                        |
| 只某个 SaaS 慢              | NetLog + curl timing + DNS/IP 对比                       |

安全提示也要写进去：NetLog/HAR 可能包含 URL、cookie、token、请求头、内网域名，默认不要让 skill 要求用户上传原始日志，应先提示脱敏。

## 4. 补 Apple iCloud Private Relay / Limit IP Address Tracking

macOS 侧建议单独加入“Apple 隐私网络功能”检查。Apple 说明 Private Relay 会保护 Safari 浏览、DNS 解析查询和不安全 HTTP app traffic；Apple 也说明 Private Relay 的设计可能影响 speed test 显示，因为很多测速会开多条并行连接来取得最高结果，而 Private Relay 使用单一安全连接。([Apple Developer](https://developer.apple.com/icloud/prepare-your-network-for-icloud-private-relay/?utm_source=chatgpt.com))

建议加入 macOS 判断：

```markdown
- If macOS Safari is slower than Chrome/Firefox, inspect iCloud Private Relay, Hide IP Address, Limit IP Address Tracking, browser DNS, and VPN state.
- If speedtest appears lower only with Private Relay enabled, treat it as a measurement-path difference before changing DNS or MTU.
- Do not ask the user to disable Private Relay globally; test with a scoped comparison and explain privacy impact.
```

## 5. 补 Windows Delivery Optimization

Windows 后台流量不只是 Windows Update。Delivery Optimization 是 Windows 10/11 的分发优化机制，支持从 Microsoft CDN、LAN peers、cache 等来源获取内容；Microsoft 文档也提供了前后台下载带宽策略，以及 PowerShell cmdlet 监控当前 Delivery Optimization jobs。([Microsoft Learn](https://learn.microsoft.com/en-us/windows/deployment/do/waas-delivery-optimization?utm_source=chatgpt.com))

建议加入 Windows 只读采集：

```powershell
Get-DeliveryOptimizationStatus
Get-DeliveryOptimizationPerfSnapThisMonth
```

启发式规则：

```markdown
- If Windows network is slow during updates, Store downloads, Xbox/Game Pass installs, or large app updates, inspect Delivery Optimization before blaming DNS or Wi-Fi.
- If upload latency spikes while Windows is idle, check Delivery Optimization peer upload and cloud sync tools.
```

## 6. 补“计量连接 / 低数据模式 / 省电模式”

这类配置会影响系统更新、后台同步、包管理器预取、云同步，容易被用户描述成“网速不稳定”。Apple 的 Low Data Mode 会按 Wi‑Fi 网络记住偏好；Windows 有 metered connection；NetworkManager 也有 metered connection 属性。([苹果支持](https://support.apple.com/en-us/102433?utm_source=chatgpt.com))

建议加入：

| 系统             | 检查项                                                       |
| ---------------- | ------------------------------------------------------------ |
| macOS / iOS 生态 | Low Data Mode、iCloud 同步、Private Relay                    |
| Windows          | Metered connection、Delivery Optimization、Battery saver     |
| Linux            | NetworkManager metered、Wi‑Fi powersave、TLP/power-profiles-daemon |

Linux 侧还应检查 Wi‑Fi powersave，因为 Ubuntu Core/NetworkManager 文档说明 Wi‑Fi Powersave 会在空闲后暂停无线电活动，再周期性唤醒检查 AP 是否有排队包；这可能影响交互式延迟。([Ubuntu Documentation](https://documentation.ubuntu.com/core/explanation/system-snaps/network-manager/how-to-guides/configure-the-snap/wifi-powersave/?utm_source=chatgpt.com))

## 7. 补 WSL / Docker / 容器网络

对 AI 工程师、开发者尤其重要。Windows 上 WSL 有 mirrored networking、DNS tunneling、autoProxy、Hyper‑V firewall 等行为；Microsoft 文档说明 DNS tunneling 通过虚拟化功能响应 WSL 内 DNS 请求，目标是提升 VPN 和复杂网络场景兼容性。Docker Desktop 也有独立的 VM、代理、firewall、endpoint visibility、host/container 路由行为。([Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/networking?utm_source=chatgpt.com))

建议把“开发环境慢”单独作为 skill 分支：

```markdown
- If Windows host network is normal but WSL is slow, inspect WSL networkingMode, dnsTunneling, autoProxy, generated resolv.conf, Windows proxy, VPN, and Hyper-V firewall.
- If Docker pull/build is slow, inspect Docker Desktop proxy mode, registry mirror, container DNS, host proxy, VPN compatibility, and IPv6.
- If Kubernetes service DNS is slow or broken, inspect CoreDNS health, endpoints, namespace, and pod DNS config.
```

Kubernetes 官方 DNS debug 文档也强调要先检查 Pod 内本地 DNS 配置、DNS pod 是否运行、endpoint 是否暴露、CoreDNS 是否收到/处理查询等。([Kubernetes](https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/?utm_source=chatgpt.com))

## 8. 补 DNS“响应质量”，不只看 DNS 延迟

现在文档已经有 DNS latency，但还应补 **DNS answer quality**：同一个域名，不同 DNS resolver 可能返回不同 CDN、不同 IPv4/IPv6、不同 HTTPS/SVCB 记录。RFC 9460 定义了 SVCB 和 HTTPS DNS 记录，可为 HTTP origin 等服务提供连接所需信息，包括替代 endpoint 和传输协议配置。([IETF Datatracker](https://datatracker.ietf.org/doc/html/rfc9460?utm_source=chatgpt.com))

建议加入 DNS 对比输出：

```bash
dig A example.com
dig AAAA example.com
dig HTTPS example.com
dig +short A example.com @1.1.1.1
dig +short A example.com @8.8.8.8
```

判断规则：

```markdown
- If DNS lookup is fast but returned CDN IP is far away or unstable, classify as DNS answer/CDN mapping issue, not DNS latency issue.
- If HTTPS/SVCB/AAAA differs across resolvers, compare actual curl remote_ip and TTFB before choosing a resolver.
```

## 9. 补 Windows NRPT / Linux per-link DNS / 企业 split DNS

企业 VPN、Tailscale、ZeroTier、Always On VPN、MDM/GPO 经常使用按域名分流 DNS。Windows NRPT 可以给指定 namespace 添加 DNS 解析策略，例如指定某个域名使用特定 DNS server；systemd-resolved 也支持全局和 per-link DNSSEC、DNS-over-TLS 等配置。([Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/dnsclient/add-dnsclientnrptrule?view=windowsserver2025-ps&utm_source=chatgpt.com))

建议加入：

```powershell
# Windows
Get-DnsClientNrptPolicy
Get-DnsClientServerAddress
Resolve-DnsName internal.example.com
# Linux
resolvectl status
resolvectl query internal.example.com
```

规则：

```markdown
- If public domains resolve but corporate/internal domains fail, inspect split DNS before changing global DNS.
- If VPN is active, do not replace DNS globally until NRPT/per-link DNS behavior is understood.
```

## 10. 补 MTR / traceroute 解释规则，避免误报

MTR/traceroute 的中间跳丢包很容易误判。APNIC 的 traceroute/MTR 解释文章指出，单个中间 hop 出现 packet loss 或 RTT 增加，可能只是该 hop 限制 TTL exceeded ICMP 响应；如果后续 hop 和最终目的地正常，通常不代表真实转发丢包。([APNIC Blog](https://blog.apnic.net/2022/03/28/how-to-properly-interpret-a-traceroute-or-mtr/?utm_source=chatgpt.com))

建议加入：

```markdown
- Treat loss on an intermediate hop as suspicious only if the loss continues to later hops and the destination.
- Do not claim ISP packet loss from a single ICMP-rate-limited hop.
- Prefer destination loss, application timing, and repeated tests over one traceroute snapshot.
```

## 11. 补路由器“硬件 offload vs SQM”的冲突

前面提过 SQM/bufferbloat，但还应明确：在 OpenWrt 等路由器上，硬件 flow offloading 和 SQM/QoS 常常不能同时发挥作用。OpenWrt SQM 文档说明 SQM 与 hardware flow offloading 不兼容；OpenWrt flow offloading 文档也说明硬件 flow offloading 会绕过 QoS traffic controls 来获得高吞吐。([OpenWrt](https://openwrt.org/docs/guide-user/network/traffic-shaping/sqm?utm_source=chatgpt.com))

建议加入：

```markdown
- If router SQM is enabled but loaded latency does not improve, inspect software/hardware flow offloading.
- If maximum throughput is the priority, flow offloading may help; if latency under load is the priority, SQM/CAKE usually needs offloading disabled.
- Do not recommend both as a universal optimization.
```

## 12. 补防火墙、内容过滤、抓包层

高级网络问题需要识别 host firewall、WFP、pf、nftables、EDR/VPN filter driver。Windows `netsh trace` 可捕获详细网络流量和 trace events 用于诊断；Linux nftables 是 Netfilter 项目用于 packet filtering、NAT、packet mangling 的框架；Apple 也提醒 macOS 的 PF 被系统服务使用，不能把它当作稳定 API 随意操作。([Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-trace?utm_source=chatgpt.com))

建议分级：

| 等级     | 工具                                                         | 默认行为   |
| -------- | ------------------------------------------------------------ | ---------- |
| 只读     | Windows Firewall profile、Linux `nft list ruleset`、macOS PF status | 可执行     |
| 诊断抓包 | `netsh trace`、tcpdump、Wireshark、Pktmon、NetLog            | 需隐私提示 |
| 修改规则 | firewall、pf、nftables、EDR/VPN filter                       | 默认不改   |

## 13. 补 socket/TCP 连接态分析

Linux 上 `ss` 可以显示 socket statistics，并且比 netstat 显示更多 TCP/state 信息；这对判断连接是否卡在 SYN-SENT、重传、拥塞窗口、RTT、send/receive queue 很有用。([man7.org](https://man7.org/linux/man-pages/man8/ss.8.html?utm_source=chatgpt.com))

建议 Linux 加：

```bash
ss -tin state established
ss -s
```

判断规则：

```markdown
- If bandwidth is low but RTT is normal, inspect TCP retransmits, cwnd, send-q/recv-q, and app backpressure.
- If many connections stay in SYN-SENT, inspect firewall, proxy, DNS answer, IPv6 reachability, or blocked destination.
```

## 14. 补“同站点多维对照矩阵”

建议 skill 固定输出一个对照矩阵，而不是只跑一次测速：

```text
目标 URL:
- direct + IPv4
- direct + IPv6
- system proxy + IPv4
- system proxy + IPv6
- VPN/TUN + IPv4
- VPN/TUN + IPv6
- browser + HTTP/2
- browser + HTTP/3
- curl + HTTP/1.1
- curl + HTTP/2
- curl + DoH resolver A
- curl + DoH resolver B
```

curl/libcurl 支持 DoH URL 配置，但 curl 文档说明 DoH lookup 不继承 parent transfer 的 proxy options，这意味着“主请求走代理、DoH 请求不走同一个代理”的场景会造成诊断误差。([curl.se](https://curl.se/libcurl/c/CURLOPT_DOH_URL.html?utm_source=chatgpt.com))

## 15. 补“不要优化”的规则

这个很重要。很多网络优化 skill 会过度改系统参数，应该明确禁止：

```markdown
Do not recommend these as first-line fixes:
- Disable IPv6 globally.
- Disable firewall globally.
- Disable EDR/security software.
- Change TCP global parameters without workload evidence.
- Change NIC offload/ring/coalescing without packet/error evidence.
- Replace VPN DNS before checking split DNS.
- Force public DNS on corporate networks.
- Delete Wi-Fi profiles without listing them.
- Enable both router SQM and hardware flow offloading as a universal fix.
- Interpret one speedtest result as the network baseline.
```

## 16. 建议直接加入 SKILL.md 的新增段落

可以把下面这一段作为增量放进 `Decision Heuristics` 后面：

```markdown
## Misdiagnosis Guards

- First classify the symptom: web first-load, bulk download, video call, gaming, SSH, Git/npm/pip/Docker, AI API, LAN/NAS, or all traffic.
- If browser and curl disagree, inspect browser Secure DNS/DoH, HTTP/3/QUIC, extensions, NetLog, cache, certificate interception, and proxy rules.
- If terminal tools are slow but browser is fast, inspect shell proxy variables, WinHTTP proxy, WSL/Docker DNS, CLI CA certificates, and no_proxy.
- If macOS Safari behaves differently, inspect iCloud Private Relay, Hide IP Address, Limit IP Address Tracking, and VPN state before changing DNS.
- If Windows is slow during updates or app installs, inspect Delivery Optimization jobs and bandwidth policy.
- If WSL or Docker is slow while the host is normal, inspect virtualization networking, DNS tunneling, auto proxy, Docker Desktop proxy mode, and VPN compatibility.
- If DNS is fast but CDN IP/TTFB is bad, compare A/AAAA/HTTPS/SVCB answers across resolvers and compare remote_ip.
- If MTR shows loss on a single intermediate hop but later hops are clean, treat it as likely ICMP rate limiting, not confirmed packet loss.
- If loaded latency is high and router SQM is enabled, inspect hardware/software flow offloading conflicts.
- If packet capture, NetLog, HAR, or trace logs are requested, warn that they may contain domains, tokens, cookies, internal IPs, and proxy metadata.
```

## 17. 建议新增 reference 文件

在前面建议的目录之外，再补这些：

```text
references/
  app-symptom-classification.md
  browser-http3-netlog.md
  apple-private-relay-low-data.md
  windows-delivery-optimization.md
  wsl-docker-container-networking.md
  dns-answer-quality-svcb-https.md
  enterprise-split-dns-nrpt-resolved.md
  traceroute-mtr-interpretation.md
  firewall-filter-capture.md
  do-not-optimize.md
```

最值得优先补的是这 5 个：

1. `browser-http3-netlog.md`
2. `wsl-docker-container-networking.md`
3. `windows-delivery-optimization.md`
4. `apple-private-relay-low-data.md`
5. `dns-answer-quality-svcb-https.md`

这样这个 skill 会更适合真实复杂环境：不只解决“Wi‑Fi 慢 / DNS 慢 / VPN 慢”，还能处理“浏览器慢但命令行快”“WSL 慢但 Windows 快”“Docker pull 慢”“HTTP/3 慢”“企业 split DNS 异常”“路由器 SQM 没效果”等高频难题。
