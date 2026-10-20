# 限速实验命令与输出说明

本说明对应学习记录0034。仅用于隔离的Mininet实验拓扑；meter1、s1及规则匹配均属于该实验，不是通用主机配置。

## 关机与重启

Ubuntu普通终端：sudo poweroff正常关机，sudo reboot重启。先在Mininet终端输入exit清理拓扑，再在控制器前台终端按Ctrl+C。若桌面会话阻止关机，使用Ubuntu系统菜单正常关机，不直接强制断电。mininet>下的命令前缀h1表示在虚拟主机执行，sh表示在承载Mininet的Ubuntu执行。

## 建立限速器

```text
sh ovs-ofctl -O OpenFlow13 add-meter s1 "meter=1,pktps,burst,stats,bands=type=drop,rate=1,burst_size=1"
```

ovs-ofctl通过OpenFlow管理交换机；-O OpenFlow13选择1.3协议；add-meter给s1创建meter；meter=1是编号；pktps以包/秒计量；burst启用突发额度；stats开启统计；bands说明超额处理；type=drop超额丢弃；rate=1为每秒1包的速率；burst_size=1为1包突发额度。不是固定每个自然秒必须放行恰好1个包，短测结果受到达时序和初始额度影响。

## 为请求绑定meter并上送

```text
sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=10,icmp,in_port=1,nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0,actions=meter:1,controller(reason=no_match,max_len=128)"
```

此处展示的是修正后的最终配置。priority为优先级；icmp限制协议；in_port为入端口；nw_src/nw_dst为源/目的IPv4；icmp_type8/code0为回显请求。多个条件共同匹配。先meter检查，允许的包再上送，超额的包不继续执行上送。

reason=no_match是本次为兼容ovs-testcontroller而显式设置的OVS扩展原因标签，不意味着这条具体流项未命中。最初CONTROLLER:128在此具体流项产生via action上报，实验观察到控制器收到两个包却没有对应Packet-Out；修正原因标签后允许的两个请求才得到回复。

max_len=128是协议动作中的请求长度参数，非端口或限速值。OVS2.7及之后不再按该参数截短上报，通常上送完整包；本轮实际日志为98字节，不能把128当作当前版本实际生效的截断上限。

## 发送测试流量

```text
h1 ping -c 10 -i 0.2 -W 1 10.0.0.2
```

h1在虚拟主机执行；-c10发送10次回显请求；-i0.2发送间隔0.2秒、约每秒5次；-W1设置等待回复的超时参数，不是请求间隔；末尾是目标IP。10 transmitted是发了10次，2 received是收2个回复，80% packet loss是8次请求未收到回复。seq1、seq6是已收到回复对应的请求序号，time为该次往返时间。

## 配置与统计

```text
sh ovs-ofctl -O OpenFlow13 dump-meters s1
sh ovs-ofctl -O OpenFlow13 meter-stats s1
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

dump-meters查看meter参数；meter-stats查看累计计量结果；dump-flows查看OpenFlow规则，不等同于普通MAC学习表。

meter:1是编号；flow_count:1是1条流项引用它；packet_in_count是进入meter的累计包数，不是Packet-In消息数量；byte_in_count为对应字节；duration为meter存在时长；bands下packet_count是该band处理的累计包数，在本次唯一drop band中就是丢弃包数。

修正后本轮meter输入10→20、drop8→16，新增输入10、新增丢弃8。计数累计，需前后相减。流项n_packets表示匹配次数，不能单独证明接收主机收到。匹配计数10而meter丢8并不矛盾。

## 正常恢复

```text
sh ovs-ofctl -O OpenFlow13 --strict del-flows s1 "table=0,priority=10,icmp,in_port=1,nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0"
sh ovs-ofctl -O OpenFlow13 del-meters s1 "meter=1"
```

先严格按完整匹配条件与优先级删除本实验流项，再删除meter1，不清空其他规则。dump-meters只返回标题是没有meter配置。dump-flows保留priority0上送规则，复测10发10收表示当前通信恢复。

## 终端输入输出符号

`>`将标准输出写入文件，已有文件会被覆盖；`>>`追加；`2>&1`把错误/诊断输出送到当前标准输出的目标；末尾`&`后台运行；`|`把前一命令的标准输出交给下一命令。之前使用后台tcpdump出现过信号权限问题，勿不加核对地重用历史后台命令和PID。

## 参考

- https://www.openvswitch.org/support/dist-docs/ovs-ofctl.8.html
- https://docs.openvswitch.org/en/latest/ref/ovs-actions.7/
