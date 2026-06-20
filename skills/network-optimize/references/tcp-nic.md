# TCP and NIC Diagnosis Reference

## When to Read

Read this when bandwidth is low despite normal DNS, adapter counters increase during tests, Ethernet negotiates below expected speed, packet loss appears local, or the host is a server/router/NAS.

## Read-Only Signals

- Link speed and duplex.
- Error, drop, discard, and retransmit counters.
- TCP retransmits, RTT, congestion window, send/receive queue.
- Offload settings, ring size, channels/queues, interrupt coalescing, EEE/power management.
- Driver version and recent driver or OS updates.

## Platform Commands

Windows:

```powershell
Get-NetAdapter
Get-NetAdapterStatistics
Get-NetAdapterAdvancedProperty
Get-NetAdapterPowerManagement
Get-NetTCPSetting
netsh int tcp show global
```

Linux:

```bash
ip -s link
ss -s
ss -tin state established
sysctl net.ipv4.tcp_congestion_control net.core.default_qdisc
ethtool <iface>
ethtool -S <iface>
ethtool -k <iface>
```

macOS:

```bash
ifconfig
netstat -s
netstat -ib
sysctl net.inet.tcp 2>/dev/null
```

## Rules

- Desktop clients usually should not receive global TCP tuning.
- Do not change TCP globals, registry values, offload, ring, coalescing, RSS/RPS/XPS, or EEE without evidence and rollback.
- If Ethernet runs at 100 Mbps on a gigabit network, inspect cable, switch port, dock, adapter, and auto-negotiation first.
- If small-packet latency is bad but throughput is high, inspect interrupt coalescing and queueing before DNS.
- If adapter errors/drops rise during a test, fix the local link or driver path before changing resolvers or VPN nodes.
