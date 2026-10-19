# SDN学习

SDN 的核心：**把“制定转发规则”和“执行转发规则”分开。**

| 职责                     | 名称                   | 例子                      |
| ------------------------ | ---------------------- | ------------------------- |
| 建立、调整路径和转发规则 | **控制平面**           | 决定去 B 的流量走哪条路径 |
| 按现有规则处理到来的数据 | **数据平面／转发平面** | 查表匹配后，从接口 2 发出 |

注意：**查表选择出口属于执行规则，也属于数据平面。** 不是只要做了判断，就叫控制平面。

在典型的控制器式 SDN 中：

```
         控制器：制定、调整规则
                   │ 下发规则
                   ▼
A ──────────── 交换机 ──────────── B
               匹配并执行规则
```

控制器是运行控制逻辑的软件，交换机按规则转发。控制与转发解耦、让网络控制可编程，是 SDN 的核心思想。[来源：ONF](https://opennetworking.org/sdn-definition/)

例如，控制器提前给交换机装好有效规则：

> 目的 MAC 是 B → 从接口 2 发出。

随后符合规则的帧到达，**交换机直接执行，不必每一帧都先问控制器。**



**流表的“匹配条件 → 动作”**

匹配条件：哪些帧适用？动作：匹配后怎样处理？

先匹配条件，再执行动作

“匹配成功”不等于“一定转发”；仅凭没发出去，也无法判断有没有匹配。



**匹配规则之间的显式优先级**

优先级高的优先执行



**持续的上报量与处理能力之间的关系**，由此解释一个控制平面的可用性风险。

业务帧很多，不一定意味着控制器收到很多Packet-In。关键还在于多少帧未匹配，以及未匹配处理是否上送。

以下模型固定“未匹配就上送”，每个未匹配帧生成一条Packet-In，并全部到达控制器，不考虑其他触发原因。它把真实系统简化成一条待处理队列。

```
上报量／秒 = 总帧数／秒 × 未匹配比例
下一秒积压 = max(0, 当前积压 + 本秒到达量 − 每秒处理能力)
```

例如每秒1000帧，其中60%未匹配，上报量就是600条/秒。若只能处理200条/秒，初始无积压时，一秒后剩400条。本例数字都是教学假设，不能当作真实设备性能。

持续上报需要交换机生成和发送消息，占用控制连接的传输能力，也需要控制器解析和决策。到达量持续超出处理能力时，消息可能排队、延迟或被限制／丢弃，新规则的建立可能受影响。已有有效规则的转发**不一定立即停止**。

这是可用性风险，不等于“看到大量Packet-In就是攻击”；正常业务变化或配置问题也可能增加上报。OpenFlow规范建议对送往控制器的数据进行QoS管控或限速，以防控制器连接遭受拒绝服务。限速可能影响合法新流量，具体取舍留到后续。



## SDN实验

环境配置

```shell
cat /etc/os-release
uname -m
nproc
free -h
df -h /
python3 --version
command -v mn ovs-vsctl ovs-ofctl
```

分别确认：

- 系统版本、CPU 架构；
- CPU 核数、内存和可用磁盘；
- Python，以及 Mininet、Open vSwitch 是否已有命令。

最后一条如果没有输出，表示没有找到这些实验命令，属于正常情况。

```shell
shanpao@shanpao-VMware20-1:~/Desktop$ cat /etc/os-release
PRETTY_NAME="Ubuntu 26.04.1 LTS"
NAME="Ubuntu"
VERSION_ID="26.04"
VERSION="26.04.1 LTS (Resolute Raccoon)"
VERSION_CODENAME=resolute
ID=ubuntu
ID_LIKE=debian
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy"
UBUNTU_CODENAME=resolute
LOGO=ubuntu-logo
shanpao@shanpao-VMware20-1:~/Desktop$ uname -m
aarch64
shanpao@shanpao-VMware20-1:~/Desktop$ nproc
2
shanpao@shanpao-VMware20-1:~/Desktop$ free -h
               total        used        free      shared  buff/cache   available
Mem:           5.3Gi       2.1Gi       2.5Gi        28Mi       910Mi       3.2Gi
Swap:          3.0Gi          0B       3.0Gi
shanpao@shanpao-VMware20-1:~/Desktop$ df -h /
Filesystem      Size  Used Avail Use% Mounted on
/dev/nvme0n1p2   19G  9.9G  7.8G  56% /
shanpao@shanpao-VMware20-1:~/Desktop$ python3 --version
Python 3.14.4
shanpao@shanpao-VMware20-1:~/Desktop$ command -v mn ovs-vsctl ovs-ofctl
```

装两个组件：

- **Mininet**：在 Ubuntu 内创建虚拟主机、链路和拓扑。
- **Open vSwitch（OVS）**：充当实验中的虚拟交换机。

在 **Ubuntu 终端**依次执行：

```shell
sudo apt update
```

完成且没有报错后，再执行：

```shell
sudo apt install mininet openvswitch-switch
```

提示是否继续时输入 `y` 并回车。密码在 Ubuntu 中自行输入，输入时不显示字符是正常的。

安装结束后执行：

```shell
mn --version
ovs-vsctl --version
sudo ovs-vsctl show
```

```shell
shanpao@shanpao-VMware20-1:~/Desktop$ mn --version
2.3.0
shanpao@shanpao-VMware20-1:~/Desktop$ ovs-vsctl --version
ovs-vsctl (Open vSwitch) 3.7.1
DB Schema 8.8.0
shanpao@shanpao-VMware20-1:~/Desktop$ sudo ovs-vsctl show
12b52b45-0a16-4cd5-9b51-a49d98c6f45f
    ovs_version: "3.7.1"
```

第一个运行测试：

```
h1 ─── s1 ─── h2
主机   交换机   主机
```

在 Ubuntu 终端执行：

```shell
sudo mn --topo single,2 --switch ovsbr --controller none --test pingall
```

这条命令会创建上述拓扑，让两台主机互相 `ping`，测试结束后自动退出并清理。`ovsbr` 使用普通二层交换方式，这一步验证基础连通性，后面再加入控制器。

```shell
shanpao@shanpao-VMware20-1:~/Desktop$ sudo mn --topo single,2 --switch ovsbr --controller none --test pingall
*** Creating network
*** Adding controller
*** Adding hosts:
h1 h2 
*** Adding switches:
s1 
*** Adding links:
(h1, s1) (h2, s1) 
*** Configuring hosts
h1 h2 
*** Starting controller

*** Starting 1 switches
s1 ...
*** Waiting for switches to connect
s1 
*** Ping: testing ping reachability
h1 -> h2 
h2 -> h1 
*** Results: 0% dropped (2/2 received)
*** Stopping 0 controllers

*** Stopping 2 links
..
*** Stopping 1 switches
s1 
*** Stopping 2 hosts
h1 h2 
*** Done
completed in 0.088 seconds
```

两台主机双向 ping 成功，`0% dropped` 表示本次测试没有丢包。日志中的 `Stopping 0 controllers` 也符合我们没有启用控制器的设置。

**查看 Mininet 中的设备与连接**。

先执行下面这条命令。这次不加 `--test pingall`，让拓扑保持运行：

```shell
sudo mn --topo single,2 --switch ovsbr --controller none
```

出现 `mininet>` 后，依次输入：

```shell
nodes
net
```

- `nodes`：列出网络节点。
- `net`：查看节点接口连接到哪里。

注意：`mininet>` 是提示符，不需要输入。想结束实验时输入 `exit`。

```shell
mininet> nodes
available nodes are: 
h1 h2 s1
mininet> net
h1 h1-eth0:s1-eth1
h2 h2-eth0:s1-eth2
s1 lo:  s1-eth1:h1-eth0 s1-eth2:h2-eth0
```

输出表明：**h1 和 h2 通过交换机 s1 相连。**

`net` 中的冒号连接一条链路两端的接口：

```shell
h1-eth0 ←→ s1-eth1
h2-eth0 ←→ s1-eth2
```

对应的拓扑就是：

```shell
h1 [eth0] ── [eth1] s1 [eth2] ── [eth0] h2
```

两台主机都叫 `eth0` 没有冲突，因为接口分别属于不同的主机。

接下来只看一个小主题：**虚拟主机的 IP 和 MAC 地址**。在当前 `mininet>` 下依次输入：

```
h1 ip addr show dev h1-eth0
h2 ip addr show dev h2-eth0
```

开头的 `h1`、`h2` 表示让对应虚拟主机执行后面的命令。

输出中重点看两处：

- `link/ether` 后面是接口的 **MAC 地址**。
- `inet` 后面是接口的 **IPv4 地址及前缀长度**，例如 `10.0.0.1/8`。

```shell
mininet> h1 ip addr show dev h1-eth0
2: h1-eth0@if7: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether d2:33:77:a5:d8:c8 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 10.0.0.1/8 brd 10.255.255.255 scope global h1-eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::d033:77ff:fea5:d8c8/64 scope link proto kernel_ll 
       valid_lft forever preferred_lft forever
mininet> h2 ip addr show dev h2-eth0
2: h2-eth0@if8: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 16:d4:11:9f:b3:85 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 10.0.0.2/8 brd 10.255.255.255 scope global h2-eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::14d4:11ff:fe9f:b385/64 scope link proto kernel_ll 
       valid_lft forever preferred_lft forever
```

现在拿到了两台主机的实际地址：

| 主机 | IPv4 地址    | MAC 地址            |
| ---- | ------------ | ------------------- |
| h1   | `10.0.0.1/8` | `d2:33:77:a5:d8:c8` |
| h2   | `10.0.0.2/8` | `16:d4:11:9f:b3:85` |

两者的 `/8` 表示网络前缀长 8 位；这里都属于 `10.0.0.0/8`。h1 可以直接通过这条局域网链路向 h2 通信。

接下来观察 **ARP 如何建立 IP → MAC 的对应关系**。在 `mininet>` 下依次执行：

```
h1 ip neigh show dev h1-eth0
h1 ping -c 1 10.0.0.2
h1 ip neigh show dev h1-eth0
```

第一条查看通信前的邻居缓存，第二条发一次 ping，第三条查看通信后的缓存。第一条可能为空，也可能已有记录，以实际输出为准。

```shell
mininet> h1 ip neigh show dev h1-eth0
mininet> h1 ping -c 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.445 ms

--- 10.0.0.2 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.445/0.445/0.445/0.000 ms
mininet> h1 ip neigh show dev h1-eth0
10.0.0.2 lladdr 16:d4:11:9f:b3:85 REACHABLE 
```

这行就是 h2 的 **IP → MAC 对应关系**：

```
10.0.0.2 lladdr 16:d4:11:9f:b3:85 REACHABLE
```

其中 `lladdr` 后面是 MAC 地址；`REACHABLE` 表示邻居可达性近期已确认。你观察到：**缓存最初为空，ping 成功后出现了这条记录**。

下一步对比交换机的表。在当前 `mininet>` 中执行：

```
sh ovs-appctl fdb/show s1
```

这里的 `sh` 表示在承载 Mininet 的 Ubuntu 中执行命令；它会查看 **s1 的 MAC 学习表**。

记住两张表的区别：

- h1 的邻居缓存：**IP → MAC**。
- s1 的 MAC 学习表：**MAC → 交换机接口**。

```shell
mininet> sh ovs-appctl fdb/show s1
 port  VLAN  MAC                Age
    1     0  d2:33:77:a5:d8:c8  277
    2     0  16:d4:11:9f:b3:85  277
```

| s1 学到的 MAC       | 所属主机 | 端口         |
| ------------------- | -------- | ------------ |
| `d2:33:77:a5:d8:c8` | h1       | 1（s1-eth1） |
| `16:d4:11:9f:b3:85` | h2       | 2（s1-eth2） |

`Age = 277` 表示距上次学习或刷新该记录约 **277 秒**。交换机根据收到帧的**源 MAC 和入端口**学习这些记录。

现在把两张表串起来：

```
h1 的邻居缓存：
10.0.0.2 → h2 的 MAC
             ↓
s1 的 MAC 学习表：
h2 的 MAC → 端口 2
```

 接下来我们把拓扑扩成三台主机，让泛洪有一个额外的观察点：

```
h1 ── s1 ── h2
       │
       h3
```

先在当前 `mininet>` 中输入：

```
exit
```

回到 Ubuntu 的普通终端后，启动新拓扑：

```
sudo mn --topo single,3 --switch ovsbr --controller none --mac
```

这里新增的 `--mac` 会让主机 MAC 地址按编号生成，方便辨认，例如 h2 是 `00:00:00:00:00:02`。

出现 `mininet>` 后执行：

```
net
sh command -v tcpdump
```

第二条检查是否已有抓包工具，用于观察通向 h3 接口的帧；没有输出也没关系。

```shell
mininet> net
h1 h1-eth0:s1-eth1
h2 h2-eth0:s1-eth2
h3 h3-eth0:s1-eth3
s1 lo:  s1-eth1:h1-eth0 s1-eth2:h2-eth0 s1-eth3:h3-eth0
mininet> sh command -v tcpdump
/usr/bin/tcpdump
```

连接正确，抓包工具也已可用。现在观察：**发给 h2 的单播帧，是否会出现在通向 h3 的链路上。**

先在 `mininet>` 中逐条执行：

```
h1 ip neigh replace 10.0.0.2 lladdr 00:00:00:00:00:02 nud permanent dev h1-eth0
h2 ip neigh replace 10.0.0.1 lladdr 00:00:00:00:00:01 nud permanent dev h2-eth0
sh ovs-appctl fdb/flush s1
```

前两条固定双方的 IP→MAC 对应关系，让这次 ping 无需 ARP；第三条清空 **s1 的 MAC 学习表**，制造目的 MAC 未知的状态。

然后

```
sh timeout 8 tcpdump -l -nn -e -i s1-eth3 -c 1 'icmp and dst host 10.0.0.2' > /tmp/sdn-flood-h3.txt 2>&1 &
sh sleep 1
h1 ping -c 1 10.0.0.2
sh sleep 8
sh cat /tmp/sdn-flood-h3.txt
```

这段操作会先监听 **s1 通向 h3 的接口**，再让 h1 ping h2。只抓目的 IP 为 h2 的 ICMP 包，最多等待 8 秒。

```shell
mininet> sh timeout 8 tcpdump -l -nn -e -i s1-eth3 -c 1 'icmp and dst host 10.0.0.2' > /tmp/sdn-flood-h3.txt 2>&1 &
mininet> sh sleep 1
mininet> h1 ping -c 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.522 ms

--- 10.0.0.2 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.522/0.522/0.522/0.000 ms
mininet> 
mininet> sh cat /tmp/sdn-flood-h3.txt
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on s1-eth3, link-type EN10MB (Ethernet), snapshot length 262144 bytes
11:19:04.439302 00:00:00:00:00:01 > 00:00:00:00:00:02, ethertype IPv4 (0x0800), length 98: 10.0.0.1 > 10.0.0.2: ICMP echo request, id 7972, seq 1, length 64
1 packet captured
1 packet received by filter
0 packets dropped by kernel
```

**详细解释**

刚才执行的是一组 **Linux 网络命令**，分为“准备实验、监听、发送、查看结果”四步。下面结合我们的拓扑逐条解释：

```
h1 ──端口1── s1 ──端口2── h2
              │
            端口3
              │
              h3
```

先区分 Mininet 命令开头的含义：

| 开头     | 在哪里执行                  |
| -------- | --------------------------- |
| `h1 ...` | 在虚拟主机 h1 中            |
| `h2 ...` | 在虚拟主机 h2 中            |
| `sh ...` | 在承载 Mininet 的 Ubuntu 中 |

**① 固定主机的 IP→MAC 对应关系**

```
h1 ip neigh replace 10.0.0.2 lladdr 00:00:00:00:00:02 nud permanent dev h1-eth0
```

意思是：告诉 h1，“通过 `h1-eth0` 联系 `10.0.0.2` 时，使用这个 MAC 地址”。

| 部分                       | 含义                                     |
| -------------------------- | ---------------------------------------- |
| `ip neigh`                 | 管理邻居表，也就是这里的 IPv4 ARP 缓存   |
| `replace`                  | 有记录就替换，没有就添加                 |
| `10.0.0.2`                 | h2 的 IP                                 |
| `lladdr 00:00:00:00:00:02` | 指定 h2 的 MAC                           |
| `nud permanent`            | 设置为永久邻居记录，不按普通动态记录老化 |
| `dev h1-eth0`              | 这条记录属于 h1 的这个接口               |

另一条方向相反：

```shell
h2 ip neigh replace 10.0.0.1 lladdr 00:00:00:00:00:01 nud permanent dev h2-eth0
```

它让 h2 知道回复 h1 时该使用哪个 MAC。

**为什么双方都设置？**这样 ping 的请求和回复都无需先发 ARP 查询，便于单独观察未知单播。这里的“永久”只针对当前邻居记录；退出并重建 Mininet 主机后不会自动保留。

**② 清空交换机的 MAC 学习表**

```shell
sh ovs-appctl fdb/flush s1
```

- `ovs-appctl`：向运行中的 OVS 发送管理命令。
- `fdb/flush s1`：清空 s1 的 MAC 学习表。

它清除的是 **交换机的 MAC→端口记录**，不会清除刚才设置在 h1、h2 上的 IP→MAC 记录。

于是我们刻意制造了这个状态：

```
h1：知道 h2 的 MAC，可以直接发单播帧。
s1：不知道 h2 的 MAC 在哪个端口，需要泛洪。
```

**③ 在通向 h3 的接口上监听**

```shell
sh timeout 8 tcpdump -l -nn -e -i s1-eth3 -c 1 'icmp and dst host 10.0.0.2' > /tmp/sdn-flood-h3.txt 2>&1 &
```

这条最长，可以拆开看：

| 部分                           | 含义                                   |
| ------------------------------ | -------------------------------------- |
| `timeout 8`                    | 最多让抓包程序运行 8 秒                |
| `tcpdump`                      | 抓取并显示接口上的包                   |
| `-l`                           | 按行及时输出，减少输出缓冲造成的等待   |
| `-nn`                          | 地址和端口使用数字显示，不转换成名称   |
| `-e`                           | 显示以太网头，包括源、目的 MAC         |
| `-i s1-eth3`                   | 监听交换机通向 h3 的接口               |
| `-c 1`                         | 抓到 1 个符合条件的包后结束            |
| `'icmp and dst host 10.0.0.2'` | 只观察目的 IP 为 h2 的 ICMP 包         |
| `> /tmp/sdn-flood-h3.txt`      | 将普通输出写入文件，覆盖该文件原有内容 |
| `2>&1`                         | 将错误及状态信息也写入同一个文件       |
| 最后的 `&`                     | 在后台运行，让我们可以继续输入 ping    |

两个退出条件是：**抓到 1 个符合条件的包，或者达到 8 秒，哪个先发生就先结束。**

这里监听的是 `s1-eth3`，所以证据是“帧出现在通向 h3 的链路上”，不能直接说 h3 的应用接收了它。

**④ 等监听启动，再发送 ping**

```shell
sh sleep 1
```

等待 1 秒，让 tcpdump 有时间开始监听，避免包先发出、监听还没开始。

```shell
h1 ping -c 1 10.0.0.2
```

让 h1 向 h2 发送 **1 次 ICMP 回显请求**。注意这里的 `-c 1` 属于 `ping`，表示发送次数；前面 tcpdump 的 `-c 1` 表示抓包数量。

随后：

```shell
sh sleep 8
sh cat /tmp/sdn-flood-h3.txt
```

等待抓包结束，再读取文件。前面的等待只是方便操作，不是网络协议的一部分。

你得到的核心输出是：

```shell
00:00:00:00:00:01 > 00:00:00:00:00:02
10.0.0.1 > 10.0.0.2: ICMP echo request
```

含义是：**源和目的分别是 h1、h2，但我们在连接 h3 的接口上观察到了这个帧。**

现在做**已知单播的对照实验**。

继续在当前 `mininet>` 中操作，**这次不清空 MAC 表**。

先执行：

```shell
h1 ping -c 1 10.0.0.2
sh ovs-appctl fdb/show s1
```

第一条让双方通信，刷新交换机的学习记录。表中应能看到 h2 的 MAC `00:00:00:00:00:02` 对应端口 `2`。

```shell
mininet> h1 ping -c 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.714 ms

--- 10.0.0.2 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.714/0.714/0.714/0.000 ms
mininet> sh ovs-appctl fdb/show s1
 port  VLAN  MAC                Age
    1     0  00:00:00:00:00:01   15
    2     0  00:00:00:00:00:02   15

```

ping 成功，s1 已学到 **h2 的 MAC → 端口 2**。

现在执行这一整段，先刷新表项，再完成抓包对照：

```shell
h1 ping -c 1 10.0.0.2
sh timeout 8 tcpdump -l -nn -e -i s1-eth3 -c 1 'icmp and dst host 10.0.0.2' > /tmp/sdn-known-h3.txt 2>&1 &
sh sleep 1
h1 ping -c 1 10.0.0.2
sh sleep 8
sh cat /tmp/sdn-known-h3.txt
```

抓包方法和上次相同，结果保存到另一个文件，方便对比。

我们的预期是：**ping 成功，但通向 h3 的接口抓不到这次发给 h2 的 ICMP 帧**，因为 s1 已能从端口 2 定向转发。

```shell
mininet> h1 ping -c 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.292 ms

--- 10.0.0.2 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.292/0.292/0.292/0.000 ms
mininet> sh timeout -s INT 6 tcpdump -l -nn -e -i s1-eth3 'icmp and dst host 10.0.0.2' > /tmp/sdn-known-h3.txt 2>&1 & sleep 1; mnexec -a $(pgrep -f 'mininet:h1' | head -n 1) ping -c 1 10.0.0.2; sleep 6; cat /tmp/sdn-known-h3.txt
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.197 ms

--- 10.0.0.2 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.197/0.197/0.197/0.000 ms
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on s1-eth3, link-type EN10MB (Ethernet), snapshot length 262144 bytes
```

这次监听启动后，ping 确实执行成功了。但文件里只有“开始监听”，**还没有结束统计**，暂时不能确认是正常结束且抓到 0 个包。

现在只执行两条检查，不用重新 ping：

```
sh pgrep -a tcpdump
sh cat /tmp/sdn-known-h3.txt
```

第一条查看抓包程序是否仍在运行；没有输出就表示没有找到该进程。

```shell
mininet> sh pgrep -a tcpdump
8267 tcpdump -l -nn -e -i s1-eth3 -c 1 icmp and dst host 10.0.0.2
8300 tcpdump -l -nn -e -i s1-eth3 icmp and dst host 10.0.0.2
mininet> sh cat /tmp/sdn-known-h3.txt
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on s1-eth3, link-type EN10MB (Ethernet), snapshot length 262144 bytes
```

找到了：**两个 tcpdump 还在运行**，所以文件里尚未出现结束统计。之前的超时安排没有按预期结束抓包，我们先收尾。

在当前 **Ubuntu 普通终端**执行：

```
sudo systemd-run --wait --pipe --collect /usr/bin/kill -TERM 8267 8300
```

这会让系统服务管理器启动一次性任务，只向这两个抓包进程发送结束信号，避免继承当前终端的标签；不修改 AppArmor 配置。[systemd 官方说明](https://www.freedesktop.org/software/systemd/man/latest/systemd-run.html)

然后执行：

```
pgrep -a tcpdump
cat /tmp/sdn-known-h3.txt
```

```shell
shanpao@shanpao-VMware20-1:~/Desktop$ sudo systemd-run --wait --pipe --collect /usr/bin/kill -TERM 8267 8300
Running as unit: run-p8425-i12319.service
          Finished with result: success
Main processes terminated with: code=exited, status=0/SUCCESS
               Service runtime: 10ms
             CPU time consumed: 3ms
                   Memory peak: 2M (swap: 0B)
shanpao@shanpao-VMware20-1:~/Desktop$ pgrep -a tcpdump
shanpao@shanpao-VMware20-1:~/Desktop$ cat /tmp/sdn-known-h3.txt
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on s1-eth3, link-type EN10MB (Ethernet), snapshot length 262144 bytes
0 packets captured
0 packets received by filter
0 packets dropped by kernel
shanpao@shanpao-VMware20-1:~/Desktop$
```

**成功，这个小实验完成了。**两个抓包进程已退出，最终统计也完整了。

两次实验形成了对照：

| s1 的状态               | h1 ping h2 | 通向 h3 的接口        |
| ----------------------- | ---------- | --------------------- |
| 不知道 h2 的 MAC 在哪里 | 成功       | 抓到发给 h2 的单播帧  |
| 已知 h2 的 MAC → 端口 2 | 成功       | 抓到 0 个符合条件的包 |

这验证了：**未知单播会泛洪；已知单播按 MAC 表定向转发。**两种情况下，帧的目的 MAC 都是 h2。
