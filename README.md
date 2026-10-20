# SDN 网络安全学习记录

中文 SDN 网络安全入门学习项目，按理解进度逐步学习，每次聚焦一个小主题，用解释、练习和真实实验检验理解。

## 当前进度 · 2026-10-20

- 已学习 12 个理论小主题：二层转发、MAC 学习、ARP、下一跳、控制/数据平面、规则匹配与优先级、Packet-In、控制器压力及限速代价。
- 已搭建 Ubuntu ARM64 + Mininet 2.3.0 + Open vSwitch 3.7.1 实验环境。
- 已完成最小拓扑双向 ping，以及三主机未知单播泛洪与已知单播定向转发的抓包对照。
- 已完成手动 OpenFlow 双向转发、优先级丢弃与恢复、硬超时与空闲超时、真实控制器连接与控制消息日志观察。
- 已比较相同5次 ping 的上报增量：不安装具体规则时10条，已有有效具体规则时0条。
- 已完成上报限速对照：未限速10/10回复、限速2/10（meter丢弃8个请求）、恢复后10/10。
- 当前阶段：本轮基础实验已完成。下一步原计划进入导师论文阅读，现按学习安排暂缓，先整理复习；尚未完成论文学习或复现。
- 待巩固：跨网 ARP 字段、限速模型的定量计算。学习过不等于已全面掌握。

本轮是少量流量下的功能与机制对照，未测量控制器最大容量、真实过载或攻击检测效果。

## 阅读入口

| 内容 | 位置 |
| --- | --- |
| 个人学习笔记（原文） | [SDN学习.md](personal-notes/SDN学习.md) |
| 互动课程入口 | [index.html](index.html) |
| 12 节课程 | [lessons/](lessons/) |
| 复习速查卡 | [reference/](reference/) |
| 学习证据与反馈 | [learning-records/](learning-records/) |
| OpenFlow转发与优先级 | [0026](learning-records/0026-explicit-openflow-forwarding.md) · [0027](learning-records/0027-priority-drop-rule.md) |
| 硬超时与空闲超时 | [0028](learning-records/0028-hard-timeout.md) · [0029](learning-records/0029-idle-timeout.md) |
| 控制器与消息日志 | [0030](learning-records/0030-controller-learning.md) · [0031](learning-records/0031-openflow-message-log.md) |
| Packet-Out与上报数量对照 | [0032](learning-records/0032-noflow-packet-out.md) · [0033](learning-records/0033-packet-in-count-comparison.md) |
| 限速代价与恢复 | [0034](learning-records/0034-meter-report-limit.md) |
| 限速命令逐条说明 | [命令复习](reference/0034-command-guide.md) |
| 首次真实实验总结 | [学习记录 0025](learning-records/0025-mininet-forwarding-lab.md) |
| 阶段目标 | [MISSION.md](MISSION.md) |
| 原始参考资料 | [RESOURCES.md](RESOURCES.md) |

下载仓库 ZIP 并解压，使用浏览器打开 `index.html` 即可使用互动课程，无需额外安装课程依赖。也可以直接访问 [在线互动课程](https://shanpao-orzw.github.io/SDN-learning/)。GitHub 仓库中的 HTML 文件页展示源码，在线课程网站则可直接阅读和操作。

课程页面是概念教学模拟；Mininet 实验运行真实 Linux 网络栈与 OVS。首个实验使用无外部控制器的二层桥模式，不把 ping 成功等同于控制器或 OpenFlow 规则实验成功。
