# Changelog

## Unreleased

## v0.0.3 - 2026-06-15

- Renamed `macos-clean-storage` to `clean-storage`.
- Added Windows storage cleanup guidance alongside macOS cleanup guidance.
- Moved platform-specific cleanup commands into `clean-storage` references.
- Added Linux storage cleanup guidance and Linux cache audit coverage.
- Expanded `optimize-network` guidance for loaded latency, PMTU/MTU, Happy Eyeballs, DoH, HTTPS/SVCB diagnostics, symptom routing, before/after reporting, and preserving always-on VPN/proxy apps during diagnosis.
- Added `keep-codex-fast` for safe Codex local-state maintenance and read-only inspection by default.
- Added `codex-provider-sync` for syncing unarchived thread provider metadata with the active provider.
- Added backup-first scripts, smoke tests, and agent metadata for the new Codex skills.

## v0.0.2 - 2026-06-11

- Added Skills CLI installation instructions to the README.
- Added `skills.sh` publishing notes.
- Added MIT license metadata.

## v0.0.1 - 2026-06-11

- Initial release of Computer Care Skills.
- Includes reusable skills for local computer care, diagnostics, and maintenance:
  `optimize-network`, `manage-paths`, `macos-clean-storage`,
  `macos-repair-permissions`, `macos-configure-workstation`,
  `monitor-processes`, and `watch-files`.
