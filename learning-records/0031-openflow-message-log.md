# 直接观察 Packet-In、Flow-Mod 与 Packet-Out

日期：2026-10-20。

ovs-testcontroller3.7.1在127.0.0.1:6653前台运行，OpenFlow13，详细日志写入/tmp/sdn-controller-messages.log。Mininet双主机secure/OpenFlow13、remote、--mac --arp；用户输出证实控制器连接true，ping3次全部成功。

## 用户日志证据

日志114行：06:31:54.464Z，控制器received OFPT_PACKET_IN，in_port=1、via no_match、total_len/data_len98、unbuffered。

116行：控制器sent OFPT_FLOW_MOD ADD，priority1，匹配h1→h2 ICMP echo request（type8/code0、源/目的IPv4和MAC、入端口1等），idle60，output2。

117行：控制器sent OFPT_PACKET_OUT，in_port1、output2、data_len98，处理当前上送数据。

120/122/123行：反向ICMP echo reply（type0/code0、h2→h1、入端口2）同样出现Packet-In→Flow-Mod ADD output1→Packet-Out output1。

日志视角是控制器：received为交换机发来，sent为发往交换机。sent(Success)说明发送成功，不单独证明交换机应用规则；结合此前自动流表及本次ping判断，不能把日志发送回显当作所有后续帧路径的完整证据。

背景70/90字节Packet-In及FLOOD Packet-Out未在摘录中解析载荷，不称其均为ARP、攻击或本轮ping。初始ping前的背景流量可能已帮助控制器学习MAC，因此不宣称首次ICMP请求一定先泛洪。

## 下一步理解检查

用户最初混淆P1上报前的未匹配与规则安装后的匹配。分时序解释后，用户正确回答：只写入规则、未再交回原包时，新规则不能凭空生成原包。已确认该小点，完整的Packet-Out/Flow-Mod区别仍应结合后续对照巩固，不直接认定全部掌握。

区分Flow-Mod安装未来可匹配的规则与Packet-Out处理当前数据；本次unbuffered且Flow-Mod未通过buffer_id引用原包，观察到另发Packet-Out。不将两条消息总要成对出现推广到所有OpenFlow实现。
