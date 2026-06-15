# Computer Care Skills

Computer Care Skills 是一组面向本机电脑管理、维护与自动化的 Codex skills。它们适合处理网络、存储、路径、权限、进程、文件监听和 macOS 工作站稳定性等问题。

它们也包含面向 Codex 本地状态维护和线程 provider 元数据同步的技能，帮助你在保留历史连续性的前提下管理长期使用后的本地状态。

这组 skills 的共同原则是：先诊断，再建议；先做只读检查，再执行可回滚的最小变更。涉及删除文件、修改系统设置、终止进程、网络配置或常驻自动化时，默认先说明范围、风险、回滚方式和验证方法。

## 适用场景

- 网络变慢、延迟不稳定、DNS 或 VPN/代理冲突。
- Windows 与 macOS 路径、UNC、SMB、`/Volumes` 路径转换或打开。
- macOS、Windows 或 Linux 磁盘空间不足、缓存膨胀、大文件和下载目录整理。
- macOS 权限、Full Disk Access、TCC、`Operation not permitted` 等访问问题。
- macOS 长期插电工作站的睡眠、唤醒、USB、音频设备和电池健康问题。
- 长时间运行的命令、脚本、服务、构建任务或下载任务监控。
- 文件变化监听、编辑后自动执行命令、重启本地服务或发送通知。

## 安装

安装全部 skills：

```bash
npx skills add VintLin/computer-care-skills
```

查看可安装的 skills：

```bash
npx skills add VintLin/computer-care-skills --list
```

只安装某一个 skill：

```bash
npx skills add VintLin/computer-care-skills --skill optimize-network
```

## Skills

| Skill | 适合处理 | 典型问题 |
| --- | --- | --- |
| `optimize-network` | 网络诊断与优化 | 网速慢、延迟高、丢包、DNS 延迟、Wi-Fi/以太网、MTU、VPN、代理、TUN 冲突 |
| `manage-paths` | 跨平台路径处理 | Windows UNC、macOS `smb://`、`/Volumes`、本地路径转换、路径打开命令 |
| `clean-storage` | macOS / Windows / Linux 存储空间清理 | 磁盘不足、缓存审计、Downloads 整理、开发工具缓存、Docker/Podman/WSL 或包管理器占用 |
| `macos-repair-permissions` | macOS 权限修复 | Full Disk Access、Files and Folders、TCC、沙盒、受保护目录访问失败 |
| `macos-configure-workstation` | macOS 工作站稳定性 | 长期插电、睡眠唤醒异常、USB/音频设备掉线、显示器睡眠、电池健康 |
| `monitor-processes` | 长任务监控 | 后台命令、脚本、服务、下载、构建任务的心跳、日志、超时和状态判断 |
| `watch-files` | 文件变化自动化 | 监听目录、变更后执行命令、重启本地服务、触发备份或通知 |
| `keep-codex-fast` | Codex 本地状态维护 | Codex 变慢、`.codex` 会话/日志/worktree/config 膨胀、Windows 扩展路径、线程元数据膨胀 |
| `codex-provider-sync` | Codex provider 元数据同步 | Codex 线程列表缺少未归档记录、`state_5.sqlite` 和 `config.toml` 的 `model_provider` 不一致、JSONL provider 元数据同步 |

## 使用方式

安装后，在 Codex 中直接描述你遇到的问题即可。Codex 会根据问题自动选择合适的 skill。

示例：

```text
我的 Mac 磁盘快满了，帮我找出可以安全清理的内容。
```

```text
把 \\server\share\project 转成 macOS Finder 能打开的路径。
```

```text
我开着 VPN 时浏览器很慢，但终端 curl 正常，帮我诊断。
```

```text
帮我监听 Downloads 目录，有新文件时运行一个脚本。
```

## 工作方式

这些 skills 会尽量遵循同一套处理流程：

1. 先收集现象、环境、路径、错误原文或指标。
2. 优先执行只读诊断，不直接修改系统或删除文件。
3. 将候选操作按风险分层，并说明为什么推荐或不推荐。
4. 对高影响操作先确认目标和范围。
5. 执行后用同一组指标或命令验证结果。
6. 输出结论、原因、风险、下一步，以及必要的回滚方式。

## 安全边界

除非你明确确认目标和范围，这些 skills 不会默认执行以下操作：

- 删除用户文件、清空废纸篓或批量执行不可逆删除。
- 终止进程、重启服务、卸载软件或改写常驻任务。
- 修改 DNS、MTU、路由、VPN、代理或系统网络服务。
- 重置 macOS TCC 权限、编辑权限数据库或绕过系统保护。
- 执行高影响清理，例如 Docker 全量 prune、删除模型缓存或删除工具链。
- 建立用于安全监控、取证监控或未授权访问的自动化。

## License

MIT License. See [LICENSE](LICENSE).
