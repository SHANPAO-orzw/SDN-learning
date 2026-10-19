# SDN 网络安全学习记录

中文 SDN 网络安全入门学习项目，按理解进度逐步学习，每次聚焦一个小主题，用解释、练习和真实实验检验理解。

## 当前进度 · 2026-10-19

- 已学习 12 个理论小主题：二层转发、MAC 学习、ARP、下一跳、控制/数据平面、规则匹配与优先级、Packet-In、控制器压力及限速代价。
- 已搭建 Ubuntu ARM64 + Mininet 2.3.0 + Open vSwitch 3.7.1 实验环境。
- 已完成最小拓扑双向 ping，以及三主机未知单播泛洪与已知单播定向转发的抓包对照。
- 下一步：手动下发 OpenFlow 转发规则；尚未完成控制器实验。
- 待巩固：跨网 ARP 字段、限速模型的定量计算。学习过不等于已全面掌握。

## 阅读入口

| 内容 | 位置 |
| --- | --- |
| 个人学习笔记（原文） | [SDN学习.md](personal-notes/SDN学习.md) |
| 互动课程入口 | [index.html](index.html) |
| 12 节课程 | [lessons/](lessons/) |
| 复习速查卡 | [reference/](reference/) |
| 学习证据与反馈 | [learning-records/](learning-records/) |
| 首次真实实验总结 | [学习记录 0025](learning-records/0025-mininet-forwarding-lab.md) |
| 阶段目标 | [MISSION.md](MISSION.md) |
| 原始参考资料 | [RESOURCES.md](RESOURCES.md) |

下载仓库 ZIP 并解压，使用浏览器打开 `index.html` 即可使用互动课程，无需额外安装课程依赖。GitHub 文件页面展示 HTML 源码；本仓库尚未启用 GitHub Pages。

课程页面是概念教学模拟；Mininet 实验运行真实 Linux 网络栈与 OVS。首个实验使用无外部控制器的二层桥模式，不把 ping 成功等同于控制器或 OpenFlow 规则实验成功。
