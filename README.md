# Computer Care Skills

一组面向本机电脑管理、维护与自动化的技能。覆盖诊断、修复、清理、路径处理、工作站调优、进程监控和文件监听等场景，支持 macOS、Windows、Linux。

共同原则：先诊断，再建议；先做只读检查，再执行可回滚的最小变更。涉及删除文件、修改系统设置、终止进程、网络配置或常驻自动化时，默认先说明范围、风险、回滚方式和验证方法。

## Skills 结构

```
Computer Care
├─ 诊断与修复   ─── computer-health    network-optimize    permissions-fix
├─ 清理与维护   ─── storage-clean      path-convert        desktop-tune
├─ 监控与自动化 ─── processes-monitor  folder-watch
└─ Codex 自维护 ─── codex-optimize
```

## 安装

```bash
npx skills add VintLin/computer-care-skills
```

查看可安装的技能：

```bash
npx skills add VintLin/computer-care-skills --list
```

只安装某一个：

```bash
npx skills add VintLin/computer-care-skills --skill computer-health
```

## Skills

### 诊断与修复

| Skill | 用途 | 典型场景 |
| --- | --- | --- |
| `computer-health` | 电脑体检与性能诊断 | 电脑变慢、内存压力大、swap/pagefile 过高、CPU 饱和、温控降频、磁盘 I/O、代码 benchmark/profiler（macOS / Windows / Linux） |
| `network-optimize` | 网络诊断与优化 | 网速慢、延迟高、丢包、DNS 延迟、Wi-Fi/以太网、MTU、VPN/代理/TUN 冲突（macOS / Windows / Linux） |
| `permissions-fix` | macOS 权限修复 | Operation not permitted、Full Disk Access、TCC 权限漂移、后台任务权限拒绝 |

### 清理与维护

| Skill | 用途 | 典型场景 |
| --- | --- | --- |
| `storage-clean` | 存储空间清理 | 磁盘不足、缓存膨胀、Downloads 整理、Docker/Podman/WSL 占用、包管理器缓存（macOS / Windows / Linux） |
| `path-convert` | 跨平台路径转换 | Windows UNC ↔ macOS smb://、/Volumes 路径、路径打开、文件列表 |
| `desktop-tune` | macOS 工作站调优 | 长期插电、电池健康、睡眠/唤醒异常、USB/音频设备掉线、显示器休眠 |

### 监控与自动化

| Skill | 用途 | 典型场景 |
| --- | --- | --- |
| `processes-monitor` | 长任务进程监控 | 后台命令、脚本、构建、下载的心跳、日志、超时和状态判断 |
| `folder-watch` | 文件夹变化自动化 | 监听目录、变更后执行命令、重启本地服务、触发备份或通知 |

### Codex 自维护

| Skill | 用途 | 典型场景 |
| --- | --- | --- |
| `codex-optimize` | Codex 本地状态维护 | `.codex` 会话/日志/worktree/config 膨胀清理、线程元数据膨胀、provider 元数据同步 |

## 使用方式

安装后直接描述遇到的问题即可：

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
我的 Mac 内存看起来满了，跑代码也变慢，帮我体检并判断瓶颈。
```

```text
帮我监听 Downloads 目录，有新文件时运行一个脚本。
```

## 工作方式

这些技能遵循同一套处理流程：

1. 收集现象、环境、路径、错误原文或指标。
2. 优先执行只读诊断，不直接修改系统或删除文件。
3. 将候选操作按风险分层，说明为什么推荐或不推荐。
4. 对高影响操作先确认目标和范围。
5. 执行后用同一组指标或命令验证结果。
6. 输出结论、原因、风险、下一步，以及必要的回滚方式。

## 安全边界

除非明确确认目标和范围，这些技能不会默认执行以下操作：

- 删除用户文件、清空废纸篓或批量执行不可逆删除。
- 终止进程、重启服务、卸载软件或改写常驻任务。
- 修改 DNS、MTU、路由、VPN、代理或系统网络服务。
- 重置 macOS TCC 权限、编辑权限数据库或绕过系统保护。
- 执行高影响清理（Docker 全量 prune、删除模型缓存或删除工具链）。
- 建立用于安全监控、取证监控或未授权访问的自动化。

## License

MIT License. See [LICENSE](LICENSE).
