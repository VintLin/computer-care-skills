# Router SQM and Bufferbloat Reference

## When to Read

Read this when speedtest bandwidth is acceptable but calls, gaming, SSH, or browsing stalls under upload/download load.

## Diagnosis

Compare idle latency to loaded latency:

- Idle ping to gateway and public IP.
- Ping during a large upload.
- Ping during a large download.
- Built-in responsiveness tests such as macOS `networkQuality` when available.
- Directional tests when possible: upload-loaded latency and download-loaded latency often point to different queues.
- Protocol comparisons when relevant: HTTP/2 vs HTTP/3, required VPN/TUN path vs in-app node/mode variations, and L4S vs noL4S on macOS when supported.

Symptoms:

- Upload makes the whole network slow: upstream queueing.
- Download makes all clients lag: downstream queueing or ISP/router bufferbloat.
- VPN makes loaded latency worse: VPN exit or local TUN/proxy queueing.

## Measurement Rules

- Record idle latency, loaded latency, throughput, interface, router/VPN state, and whether upload/download ran in parallel or sequentially.
- On macOS, `networkQuality -c` provides JSON fields such as `base_rtt`, `responsiveness`, throughput, and latency-under-load values. Use `networkQuality -s -c` when separate upload/download responsiveness matters.
- Do not run multiple bandwidth tests at the same time unless intentionally testing contention.
- Do not treat a high throughput score as healthy if calls, games, SSH, or page loads stall under load.

## Router-Side Fixes

When the user controls the router, SQM/CAKE can reduce latency under load. Start with shaping rates below measured capacity, commonly around 85-95 percent, then retest. The exact value depends on the ISP link and router CPU.

## Flow Offload Conflict

Do not recommend SQM/CAKE and hardware flow offloading as universal simultaneous fixes:

- If maximum throughput is the priority, flow offloading may help.
- If latency under load is the priority, SQM/CAKE usually needs traffic to pass through the queue discipline, and offloading may bypass it.
- If SQM is enabled but loaded latency does not improve, inspect software/hardware flow offload and router CPU.

## Safety

Router changes affect every device. Require user authority over the router, name the setting, record current values, and provide rollback or a backup/export step when possible.
