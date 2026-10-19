# 2026-10-19 · 首次 Mininet 转发实验

## 环境与范围

Ubuntu 26.04.1 LTS / aarch64；Mininet 2.3.0；Open vSwitch 3.7.1。资源为 2 核、约 5.3 GiB 内存。使用 `ovsbr` 二层桥模式，未启用外部控制器。

## 已完成的观察

1. 两主机拓扑 h1—s1—h2 双向 ping：`0% dropped (2/2 received)`，自动测试正常清理。
2. 交互查看 nodes/net，正确解释 h1→h2 在 s1 从端口 1 进入、已知目的 MAC 时从端口 2 发出。
3. h1 邻居缓存最初为空；ping h2 成功后出现 h2 的 IP→MAC 映射。
4. 查看 s1 FDB，确认源 MAC 学习形成 MAC→端口映射。
5. 三主机拓扑使用 `--mac` 生成可辨识地址。h1/h2 分别为 10.0.0.1、10.0.0.2，MAC 分别为 00:00:00:00:00:01、00:00:00:00:00:02；h3 接 s1 端口 3。

## 泛洪与定向转发对照

固定 h1/h2 的静态邻居记录，避免 ARP 查询影响交换机学习；抓包条件为 `icmp and dst host 10.0.0.2`，监听 s1-eth3。

| 条件 | ping | s1-eth3 抓包 |
| --- | --- | --- |
| 清空 s1 MAC 学习表后 | 成功 | 捕获 1 个 h1→h2 的 ICMP echo request，目的 MAC 仍为 h2 |
| 刷新学习并确认 h2 MAC→端口 2 后 | 成功 | 最终统计 0 packets captured / 0 packets received by filter / 0 packets dropped by kernel |

实验支持：未知单播向其他允许转发端口泛洪；已知单播按 MAC 表定向转发。出现在通向 h3 的链路上，不等于 h3 应用程序接收了帧。仅两个主机时，不能只凭 h2 收到帧区分泛洪与定向转发。

## 理解检查

正确解释：h1 有有效邻居缓存、但交换机缺少 h2 MAC 表项时，h1 无需因此重新 ARP，交换机执行未知单播泛洪。未配置静态邻居记录不代表动态缓存一定为空。

## 实验排障

后台 tcpdump 未能被 timeout 或普通 sudo kill 结束。安全标签与内核日志确认 AppArmor 拒绝来自 desktop-icons-ng 标签进程的信号；换终端仍继承该标签。

经确认目标进程后，使用 systemd-run 启动一次性系统服务发送 TERM，保持 AppArmor 配置不变。服务成功、pgrep 无残留 tcpdump，随后取得完整抓包统计。此方法为本次已验证处理路径；以后需重新核对进程身份，不复用旧 PID。

## 状态与下一步

抓包进程收尾已验证；已提示退出 Mininet，但尚未收到拓扑退出输出。下一小主题：手动下发 OpenFlow 规则。控制器实验、流表安全实验和论文复现尚未开展。
