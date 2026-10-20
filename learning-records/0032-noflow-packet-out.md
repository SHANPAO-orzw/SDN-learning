# 不安装具体转发规则时的通信

日期：2026-10-20。教学配置为ovs-testcontroller --noflow，OpenFlow13、127.0.0.1:6653，独立日志/tmp/sdn-controller-noflow.log；双主机secure拓扑、--mac --arp。

用户实测h1 ping h2三次全部成功，0%丢包。随后dump-flows仅一条priority0 actions=CONTROLLER:128，计数20包1760字节，没有具体转发规则。

用户随后提供日志110–142行：07:58:44、45、46三轮，每轮in_port1的98字节Packet-In后有output2的Packet-Out，in_port2的98字节Packet-In后有output1的Packet-Out，共6组、12条消息。时间及方向与3次ping请求/回复相符；摘录只筛选长度和类型，未独立解码ICMP字段，保留该证据边界。结合本轮流表无具体流项，支持连续各轮由控制器通过Packet-Out处理，没有凭上一轮留下的具体规则直接转发。

不把兜底计数20包全部当作ping、不单凭时延推断路径，不将低速三次ping称作压力实验。理解检查通过：用户独立解释“因为没有具体转发规则，所以每次由控制器逐包指示交换机转发”，结合前述P1不会由新规则自动生成的判断，已能解释本实验Packet-Out与Flow-Mod作用区别。下一步可进入固定少量流量下的上报数量对照，再考虑受控限速，不立即做高强度压力。
