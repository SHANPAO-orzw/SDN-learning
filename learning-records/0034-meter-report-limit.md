# 对合法 ICMP 请求上报限速的代价

日期：2026-10-20。

## 准备与范围

双主机secure/OpenFlow13、静态邻居，控制器按教学配置--noflow。用户确认tcp:127.0.0.1:6653连接true；meter-features显示max_meter200000、max_bands1，支持drop及kbps/pktps/burst/stats。

仅对h1→h2的ICMP echo request在CONTROLLER输出前计量，不称整个控制连接聚合限速，不模拟攻击或控制器过载。

## 未限速基线

用户dump-flows仅priority0 CONTROLLER:128，随后h1 ping -c10 -i0.2 -W1 h2，10发10收、0%丢包，1842ms。

## 待验证步骤

补充日志证据：基线98字节上报均via no_match并有Packet-Out；限速轮09:12:49.611及09:12:50.645出现恰好两条98字节in_port1的via action Packet-In，无对应Packet-Out摘录。支持除meter丢弃外存在测试控制器对不同上报原因处理的兼容变量；未直接获取3.7.1源码分支，不把内部原因断言为已源码确认。拟仅将同一priority10规则的controller动作原因显式改成no_match（OVS扩展），保留meter参数后重测，用累计meter计数差值。原因标签是显式配置，不表示该规则真的未命中。

实际配置与异常：最初add-flow返回OFPMMFC_INVALID_METER，meter-stats为空、只剩兜底；该轮ping全通不算限速结果。随后用户创建meter1成功，dump-meters证实pktps/burst/stats/drop rate1 burst_size1。引用规则成功后，用户ping10次全部失败；meter输入10包980字节，drop band8包784字节，flow_count1；priority10规则命中10包，兜底计数64。只能认定meter丢弃8包，另外2包未被该band丢弃，不能把100%ping失败全归因meter。当前怀疑具体CONTROLLER action的Packet-In reason=action与ovs-testcontroller处理条件不兼容，待日志/版本源码核对。需修复后重新计数，再做恢复对照。

修正后重测已完成：strict mod-flows将同一规则controller动作原因显式改成no_match，其他meter参数不变。用户meter测试前输入10/drop8，测试后输入20/drop16；本轮输入10、drop8。相同10次ping中seq1/6回复，2收、80%丢包、1850ms。未被band丢弃的2个请求对应2个成功回复，与该轮meter统计一致。支持当前限速规则降低此类请求的上送量且造成合法ping损失；不声称测试过控制器满载或队列保护效果。

恢复已验证：用户严格删除本实验priority10 ICMP请求规则，再删除meter1；相同10次ping全部回复、0%丢包、1819ms；dump-meters无meter配置，dump-flows仅剩原有priority0 CONTROLLER:128，89包8158字节。未限速10/10、修正兼容性后的限速2/10（meter本轮丢8）、移除限速后10/10，对照及配置恢复完成。

最终解释反馈：用户指出限速减少请求每秒发送数量，并可能造成正常通信丢包或延迟。代价方向正确，需纠正发送端/上送入口区别：h1仍按原方式发送10个请求，meter在交换机丢8个，减少允许上送控制器的此类请求；本轮验证丢包，没有验证排队额外延迟，不能由本数据推广成所有限速均增加延迟。已反馈该区别，发送量与允许上报量可在论文阅读时结合场景间隔复核。

这一轮入门实验的实际操作计划已完成。没有进行高强度压力、攻击检测、控制器容量标定或队列测量。后续整理学习结果并衔接导师论文阅读，不再无期限增加前置实验。控制器与Mininet进程尚无停止证据，需正常退出收尾。
