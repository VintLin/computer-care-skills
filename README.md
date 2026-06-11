# Computer Care Skills

这一组 skills 面向本机电脑管理、维护与自动化。它们用于先诊断、再给出最小可回滚操作，避免在没有证据和确认的情况下修改系统设置、删除文件、终止进程或安装常驻服务。

## Installation

Install all skills:

```bash
npx skills add VintLin/computer-care-skills
```

List available skills before installing:

```bash
npx skills add VintLin/computer-care-skills --list
```

Install one skill:

```bash
npx skills add VintLin/computer-care-skills --skill optimize-network
```

This repository is public and can be discovered by the Skills CLI from GitHub:

```text
https://github.com/VintLin/computer-care-skills
```

## 用途

适合放入这里的 skill 应该满足两个条件：

- 面向本机环境管理，例如网络、存储、路径、权限、进程、文件监听或工作站稳定性。
- 能被复用到多次任务，而不是只服务某一次临时排查。

不适合放入这里的内容：

- 特定业务项目的目录规则、账号规则或发布流程。
- 安全绕过、权限规避、取证监控或未授权访问。
- 需要先安装常驻服务才能工作的重型自动化方案。

## 命名规范

- 使用英文短横线命名。
- 通用 skill 采用「动词 + 对象」结构，例如 `optimize-network`、`manage-paths`。
- 系统专属 skill 采用「系统 + 动词 + 对象」结构，例如 `macos-clean-storage`、`macos-repair-permissions`。
- 平台词统一使用 `macos`、`windows`；除非只讨论具体硬件，否则避免把能力命名为 `macbook`。
- 同一概念使用同一词：`network`、`storage`、`paths`、`permissions`、`processes`、`files`、`workstation`。
- `SKILL.md` 的 `description` 只写触发条件，并以 `Use when...` 开头。

## Skills

| Skill | 用途 | 典型场景 |
| --- | --- | --- |
| `optimize-network` | 网络诊断与安全优化 | 网速慢、延迟高、DNS/MTU/Wi-Fi/VPN/TUN 问题 |
| `manage-paths` | 路径转换与打开命令 | Windows UNC、macOS `/Volumes`、`smb://`、本地路径转换 |
| `macos-clean-storage` | macOS 存储空间审计与清理建议 | 磁盘不足、缓存膨胀、Downloads 整理、大文件排查 |
| `macos-repair-permissions` | macOS 权限修复 | Full Disk Access、TCC、`Operation not permitted` |
| `macos-configure-workstation` | macOS 工作站稳定性 | 常插电、睡眠唤醒、USB/音频设备掉线、电池健康 |
| `monitor-processes` | 后台进程与长任务监控 | 长命令、脚本、服务、构建任务的心跳、日志和超时 |
| `watch-files` | 文件变化监听自动化 | 目录监听、变更触发命令、重启服务、通知前置设计 |

## Publishing on skills.sh

`skills.sh` discovers public GitHub repositories through the Skills CLI. A user can install this repository with `npx skills add VintLin/computer-care-skills`; anonymous install telemetry may then make the skills appear on `skills.sh` pages and leaderboards.

Each skill is defined by its own `SKILL.md` file under `skills/<name>/`. Helper scripts and references stay next to the skill that owns them.

## 使用原则

1. 先读真实环境：命令帮助、系统状态、路径、路由、进程、磁盘大小、权限错误原文。
2. 区分只读诊断和变更动作；能只读就先只读。
3. 对删除、权限、网络、进程、常驻服务等变更，说明范围、风险、回滚和验证方式。
4. 保留用户指定路径、命名和业务规则，不自行猜测映射。
5. 输出结论时给证据：路径、数值、命令结果、前后对比或失败原因。

## SKILL.md 结构

每个 skill 的主文档尽量保持同一风格：

1. `frontmatter`
   - `name` 与目录名一致。
   - `description` 以 `Use when...` 开头，只描述触发条件。
2. `# Title`
   - 标题与 skill 名一致，但使用可读大小写。
3. `## Overview`
   - 说明能力边界和核心判断原则。
4. `## When to Use`
   - 写清适用场景和不适用场景。
5. `## Workflow`
   - 从只读诊断到变更、验证的步骤。
6. `## Quick Commands`、`## Helper Script` 或 `## Quick Reference`
   - 只放可审查、可解释、范围明确的命令或脚本。
7. `## Common Mistakes`
   - 列出高风险误用和常见误判。

## 安全边界

默认不要直接执行以下操作，除非用户明确确认目标和范围：

- 删除用户文件、清空废纸篓或批量执行 `rm -rf`。
- 杀进程、重启服务、卸载软件或改写常驻任务。
- 修改 DNS、MTU、路由、VPN、代理或系统网络服务。
- 重置 macOS TCC 权限、编辑权限数据库或要求用户绕过系统保护。
- 执行高影响清理，例如 Docker 全量 prune、删除模型缓存或删除工具链。

## 维护规则

- 新增 skill 时先判断平台边界：通用能力用「动词 + 对象」，系统专属能力用「系统 + 动词 + 对象」。
- 主 `SKILL.md` 保持轻量；长参考、脚本和模板放入 `references/`、`scripts/` 或 `templates/`。
- 不把能力描述绑定到特定助手或运行平台；只有工具名本身不可替代时才保留品牌词。
- 脚本默认只读；如果脚本会修改系统或文件，文件名、说明和正文必须明确标出。

## License

MIT License. See [LICENSE](LICENSE).
