---
name: macos-configure-workstation
description: Use when a macOS laptop or desktop is used as a mostly plugged-in workstation and the user reports battery health concerns, sleep/wake instability, USB device dropouts, audio device disappearance, display sleep issues, or always-on setup needs.
---

# macOS Configure Workstation

## Overview

Tune a plugged-in macOS workstation for stable daily use without sacrificing portability. Separate observation, reversible power settings, hardware reliability, and background monitoring.

## When to Use

Use for:

- macOS laptop kept on AC power most of the time
- Battery micro-cycling or charge limit questions
- USB microphone, audio interface, hub, keyboard, display, or dock disappearing after sleep
- Sleep/wake, DarkWake, or Power Nap instability
- Need for an always-available workstation with safe battery behavior

Do not apply permanent power changes without confirming the user wants desktop-style behavior.

## Diagnosis

Collect evidence first:

```bash
pmset -g custom
pmset -g assertions
pmset -g log | grep -E "Sleep |Wake |DarkWake" | tail -40
system_profiler SPPowerDataType
system_profiler SPUSBDataType
ioreg -r -c AppleSmartBattery -l | grep -E "CycleCount|MaxCapacity|Temperature|IsCharging"
```

For disappearing USB/audio devices:

```bash
system_profiler SPAudioDataType
ioreg -r -c IOUSBHostDevice -l | grep -A 20 "<device-name>"
```

## Safe Change Ladder

1. Prefer built-in battery charge optimization or 80 percent limit when available.
2. Use a powered USB hub for fragile devices before writing recovery automation.
3. Keep display sleep separate from system sleep.
4. If the user wants always-on AC behavior, adjust only AC power settings.
5. Add monitoring or self-healing only after the device failure is reproducible.

Example AC-only sleep change:

```bash
sudo pmset -c sleep 0
pmset -g custom
```

Rollback:

```bash
sudo pmset -c sleep 1
```

Use the user's previous value if it was not `1`.

## Hardware Notes

- USB 1.1 and older audio devices are more likely to drop during sleep/wake.
- Powered hubs are more reliable than bus-powered hubs for microphones and audio interfaces.
- Hub chipsets that support software port cycling can recover devices without unplugging them.

## Reporting

For each recommendation, state:

- Current evidence
- Change scope: battery, sleep, USB, audio, monitoring
- Risk to portability or power use
- Rollback command
- Verification command

## Common Mistakes

- Do not disable sleep globally when only AC power should change.
- Do not change battery settings based on generic advice if the Mac already manages charging well.
- Do not build a daemon before checking whether a powered hub or sleep setting fixes the issue.
- Do not assume every wake issue is USB; check power assertions and logs.
