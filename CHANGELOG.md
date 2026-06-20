# Changelog

## Unreleased

## v0.1.0 - 2026-06-21

**重命名（名词-动词惯例，domain 优先）**：

| 旧名称 | 新名称 | 原因 |
| --- | --- | --- |
| `diagnose-computer` | `computer-health` | "health" 比 "diagnose" 更通用易懂 |
| `optimize-network` | `network-optimize` | 统一名词-动词惯例 |
| `macos-repair-permissions` | `permissions-fix` | "fix" 短于 "repair"，非母语者更友好 |
| `clean-storage` | `storage-clean` | 统一惯例 |
| `manage-paths` | `path-convert` | "convert" 比 "manage" 更精确描述路径转换 |
| `macos-configure-workstation` | `desktop-tune` | "desktop" + "tune" 更日常、更贴近实际行为 |
| `monitor-processes` | `processes-monitor` | 统一惯例 |
| `watch-files` | `folder-watch` | "folder" 与 "path-convert" 区分清晰 |

**合并**：

- `codex-clean` + `codex-provider-sync` → `codex-optimize`（clean + sync 两个分支）

**结构重组**：

- 10 个技能 → 9 个技能
- 按金字塔分为四层：诊断与修复 / 清理与维护 / 监控与自动化 / Codex 自维护
- 所有 SKILL.md 按 writing-great-skills 原则重写：前载 leading word、合并 Common Mistakes 到工作流约束、去重去 no-op、泛化表达

## v0.0.3 - 2026-06-15

- Renamed `macos-clean-storage` to `clean-storage`.
- Added Windows storage cleanup guidance alongside macOS cleanup guidance.
- Moved platform-specific cleanup commands into `clean-storage` references.
- Added Linux storage cleanup guidance and Linux cache audit coverage.
- Expanded `optimize-network` guidance for loaded latency, PMTU/MTU, Happy Eyeballs, DoH, HTTPS/SVCB diagnostics, symptom routing, before/after reporting, and preserving always-on VPN/proxy apps during diagnosis.
- Added `codex-clean` for safe Codex local-state maintenance and read-only inspection by default.
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
