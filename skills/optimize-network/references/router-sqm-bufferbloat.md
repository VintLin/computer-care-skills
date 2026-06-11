# Router SQM and Bufferbloat Reference

## When to Read

Read this when speedtest bandwidth is acceptable but calls, gaming, SSH, or browsing stalls under upload/download load.

## Diagnosis

Compare idle latency to loaded latency:

- Idle ping to gateway and public IP.
- Ping during a large upload.
- Ping during a large download.
- Built-in responsiveness tests such as macOS `networkQuality` when available.

Symptoms:

- Upload makes the whole network slow: upstream queueing.
- Download makes all clients lag: downstream queueing or ISP/router bufferbloat.
- VPN makes loaded latency worse: VPN exit or local TUN/proxy queueing.

## Router-Side Fixes

When the user controls the router, SQM/CAKE can reduce latency under load. Start with shaping rates below measured capacity, commonly around 85-95 percent, then retest. The exact value depends on the ISP link and router CPU.

## Flow Offload Conflict

Do not recommend SQM/CAKE and hardware flow offloading as universal simultaneous fixes:

- If maximum throughput is the priority, flow offloading may help.
- If latency under load is the priority, SQM/CAKE usually needs traffic to pass through the queue discipline, and offloading may bypass it.
- If SQM is enabled but loaded latency does not improve, inspect software/hardware flow offload and router CPU.

## Safety

Router changes affect every device. Require user authority over the router, name the setting, record current values, and provide rollback or a backup/export step when possible.
