# SDN 网络安全学习资源

## Knowledge

- [ONF OpenFlow Switch Specification 1.3.2](https://opennetworking.org/wp-content/uploads/2014/10/openflow-spec-v1.3.2.pdf)
  第八、九、十课依据5.2–5.4及6.1.2核验流项匹配、指令和未匹配处理；本课简化为单条具体规则与固定兜底丢弃，不将其作为所有设备默认行为。第九课重点核验5.3：只选最高优先级匹配项，同最高优先级重叠项选择未定义。第十课核验table-miss配置、Packet-In上下文与缓存边界，简化为安装规则后另发一帧，不模拟Packet-Out。第十一课依据§6.2对控制器连接的拒绝服务风险与管控建议，队列公式和数字另标为教学模型。第十二课延续§6.2限速建议，合法消息按比例进入/被丢弃为额外流体假设，不是规范的调度保证。

- [ONF：Software-Defined Networking Definition](https://opennetworking.org/sdn-definition/)
  SDN 标准组织的架构定义，用于第七课控制与转发解耦、可编程控制的解释；以典型控制器式场景教学，不把单控制器或逐包上送当作 SDN 必要条件。

- [RFC 826：An Ethernet Address Resolution Protocol](https://www.rfc-editor.org/rfc/rfc826.html)
  ARP 原始协议文档。第五课依据 Packet Generation / Packet Reception 解释 IPv4 以太网中本地映射、请求广播与回复；先限定同一子网，不展开代理 ARP 与跨网关场景。

- [Cisco：Unicast Flooding in Switched Campus Networks](https://www.cisco.com/c/en/us/support/docs/switches/catalyst-6000-series-switches/23563-143.html)
  官方技术说明，用于核验未知单播在所属 VLAN 内、除入接口外允许转发接口的泛洪；第四课先讲正常场景，故障与限制配置以后按需阅读。

- [Cisco：Managing the MAC Address Table](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/software/release/12-2_58_se/configuration/guide/2960scg/swadmin.html)
  官方设备文档，用于核验目的 MAC 查表转发与接口映射；第二课先限于同一 VLAN 的已知单播，后续再参考源地址学习和未知单播的说明。

- [Cisco：What is a Switch vs a Router?](https://www.cisco.com/site/us/en/learn/topics/small-business/network-switch-vs-router.html)；[How Does a Switch Work?](https://www.cisco.com/site/us/en/learn/topics/small-business/network-switch-how.html)
  网络设备厂商的入门说明，用于第一课核验二层交换和跨网络路由的功能区别。以功能而非家用设备外壳名称区分，暂不引入多层交换和复杂网络划分。

- 李曼、周华春、徐琪等：《面向SDN的攻击流量分配与负载均衡机制》，《通信学报》，2025 年 3 月，DOI：10.11959/j.issn.1000-436x.2025034。[DOI 原文入口](https://doi.org/10.11959/j.issn.1000-436x.2025034)
  导师明确推荐；20 页，已初读前两页并检查首页。用于串联 SDN、DDoS、流量分配与负载均衡的学习问题。中文正文可直接提取，无需先转 Markdown；公式、表格和图需要对照原页核验。当前尚未全面评估方法和实验，不将作者报告的效果视为已独立验证。
- 徐慧、陈宏伟、宗欣露：《基于可拓论的SDN管理信息语义不匹配问题研究》，2017 年，DOI：10.12052/gdutxb.160153。[DOI 原文入口](https://doi.org/10.12052/gdutxb.160153)
  用户提供的研究背景材料，已初读前两页。用于了解 SDN 管理信息建模问题，暂不作为安全入门主线。
- [RFC 5227：IPv4 Address Conflict Detection](https://www.rfc-editor.org/rfc/rfc5227.html)
  已查阅的原始标准，用于核对同一链路中重复 IPv4 地址引发冲突的解释；作为教师核验资料，当前不要求学生阅读全文。

## Wisdom (Communities)

尚未选择；待明确实际问题与用户偏好后按需补充。

## Gaps

- 后续 SDN 第一专题前需核验其基本结构的原始资料。
