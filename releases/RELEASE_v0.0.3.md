# Release v0.0.3

Computer Care Skills v0.0.3 expands storage and network guidance and adds Codex maintenance skills for local state cleanup and provider metadata synchronization.

## Changes

- Renamed `macos-clean-storage` to `clean-storage`.
- Added Windows storage cleanup guidance alongside macOS cleanup guidance.
- Moved platform-specific cleanup commands into `clean-storage` references.
- Added Linux storage cleanup guidance and Linux cache audit coverage.
- Expanded `optimize-network` guidance for loaded latency, PMTU/MTU, Happy Eyeballs, DoH, HTTPS/SVCB diagnostics, symptom routing, before/after reporting, and preserving always-on VPN/proxy apps during diagnosis.
- Added `codex-clean` for read-only Codex local-state inspection and safe maintenance.
- Added `codex-provider-sync` for syncing unarchived thread provider metadata with the active provider.
- Added supporting scripts, smoke tests, and agent metadata for both skills.
- Refined the Codex-facing prompts and documentation for the new workflows.

## Install

```bash
npx skills add VintLin/computer-care-skills
```

List available skills:

```bash
npx skills add VintLin/computer-care-skills --list
```
