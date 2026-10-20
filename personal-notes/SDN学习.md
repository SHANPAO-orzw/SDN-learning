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

### 实验一

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

**观察“没有转发规则时，交换机会怎样处理数据”**。

之前使用 `ovsbr`，OVS 会按普通二层交换方式学习、转发。这次改用 `ovs` 的 `secure` 模式，避免自动退回普通学习交换机行为。

Ubuntu 普通终端后执行：

```shell
sudo mn --topo single,2 --switch ovs,failMode=secure,protocols=OpenFlow13 --controller none --mac --arp
```

新增参数的含义：

| 参数                   | 用途                                              |
| ---------------------- | ------------------------------------------------- |
| `failMode=secure`      | 不因缺少控制器而自动采用普通交换行为              |
| `protocols=OpenFlow13` | 使用 OpenFlow 1.3                                 |
| `--arp`                | 预先设置主机间的静态邻居记录，排除 ARP 查询的影响 |

```shell
shanpao@shanpao-VMware20-1:~/Desktop$ sudo mn --topo single,2 --switch ovs,failMode=secure,protocols=OpenFlow13 --controller none --mac --arp
[sudo: authenticate] Password:       
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
*** Starting CLI:
```

出现 `mininet>` 后，**逐条执行**：

```shell
sh ovs-vsctl get-fail-mode s1
sh ovs-ofctl -O OpenFlow13 dump-flows s1
h1 ping -c 1 -W 2 10.0.0.2
```

前两条检查模式与流表；最后一条发送一次 ping，最多等待回复 2 秒。

```shell
mininet> sh ovs-vsctl get-fail-mode s1
secure
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
mininet> h1 ping -c 1 -W 2 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.

--- 10.0.0.2 ping statistics ---
1 packets transmitted, 0 received, 100% packet loss, time 0ms
```

这说明：**即使主机知道对方的 MAC，交换机没有转发规则，通信仍然不通。**当前流表为空，也没有配置上送控制器的规则，未匹配帧会被丢弃。

现在只添加一条“发往 h2”的规则。在 `mininet>` 下执行：

```shell
sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=100,dl_dst=00:00:00:00:00:02,actions=output:2"
```

它对应之前学过的“匹配条件 → 动作”：

| 部分                       | 含义                    |
| -------------------------- | ----------------------- |
| `priority=100`             | 规则优先级为 100        |
| `dl_dst=00:00:00:00:00:02` | 匹配目的 MAC 为 h2 的帧 |
| `actions=output:2`         | 从 s1 的端口 2 发出     |

```shell
mininet> h1 ping -c 1 -W 2 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.

--- 10.0.0.2 ping statistics ---
1 packets transmitted, 0 received, 100% packet loss, time 0ms

mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=39.120s, table=0, n_packets=1, n_bytes=98, priority=100,dl_dst=00:00:00:00:00:02 actions=output:"s1-eth2"
```

这次出现了关键变化：**ping 仍未收到回复，但去 h2 的规则已经命中了。**

流表中的：

```shell
n_packets=1
actions=output:"s1-eth2"
```

表示有 **1 个包匹配了这条规则**，规则指定从连接 h2 的接口发出。计数器证明规则被命中，但它本身不是 h2 收包的直接证据。

现在补上返回方向：目的 MAC 是 h1，就从端口 1 发出。

```shell
sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=100,dl_dst=00:00:00:00:00:01,actions=output:1"
```

然后执行：

```
h1 ping -c 1 -W 2 10.0.0.2
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

接下来我们检查：**双向规则齐全后，ping 是否成功，以及两条规则的计数器是否增加。**

```shell
mininet> sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=100,dl_dst=00:00:00:00:00:01,actions=output:1"
mininet> h1 ping -c 1 -W 2 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.519 ms

--- 10.0.0.2 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.519/0.519/0.519/0.000 ms
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=150.670s, table=0, n_packets=2, n_bytes=196, priority=100,dl_dst=00:00:00:00:00:02 actions=output:"s1-eth2"
 cookie=0x0, duration=19.132s, table=0, n_packets=1, n_bytes=98, priority=100,dl_dst=00:00:00:00:00:01 actions=output:"s1-eth1"
```

**成功！你已经完成了第一次手动下发 OpenFlow 转发规则的实验。**

三步结果可以对照起来：

| 流表状态           | ping 结果               |
| ------------------ | ----------------------- |
| 没有规则           | 失败                    |
| 只有发往 h2 的规则 | 失败，去向规则命中 1 次 |
| 补齐发往 h1 的规则 | 成功，两条规则都有命中  |

最后一次 ping 中：

```
请求：h1 → s1 → h2，命中“目的 h2 → 端口2”
回复：h2 → s1 → h1，命中“目的 h1 → 端口1”
```

所以去 h2 的计数从 **1 增至 2**，去 h1 的计数变成 **1**。

接下来验证：**转发规则仍然存在，能否用高优先级规则阻止通信？**

在当前 `mininet>` 下执行：

```shell
sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=200,dl_dst=00:00:00:00:00:02,actions=drop"
```

这条新规则是：

```
优先级 200：目的 MAC 是 h2 → 丢弃
```

原来的规则仍保留：

```
优先级 100：目的 MAC 是 h2 → 从端口 2 发出
```

然后逐条执行：

```shell
h1 ping -c 1 -W 2 10.0.0.2
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

重点看：**ping 是否成功，以及优先级 200 的规则是否出现命中计数。**

```shell
mininet> sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=200,dl_dst=00:00:00:00:00:02,actions=drop"
mininet> h1 ping -c 1 -W 2 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.

--- 10.0.0.2 ping statistics ---
1 packets transmitted, 0 received, 100% packet loss, time 0ms

mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=588.831s, table=0, n_packets=2, n_bytes=196, priority=100,dl_dst=00:00:00:00:00:02 actions=output:"s1-eth2"
 cookie=0x0, duration=457.293s, table=0, n_packets=1, n_bytes=98, priority=100,dl_dst=00:00:00:00:00:01 actions=output:"s1-eth1"
 cookie=0x0, duration=20.812s, table=0, n_packets=1, n_bytes=98, priority=200,dl_dst=00:00:00:00:00:02 actions=drop
```

这次的计数很清楚：

| 规则                         | 测试前 → 测试后 |
| ---------------------------- | --------------- |
| 优先级 100，发往 h2          | 2 → 2           |
| 优先级 100，返回 h1          | 1 → 1           |
| 优先级 200，丢弃发往 h2 的帧 | 0 → 1           |

说明这个帧**匹配成功，但执行了高优先级规则的丢弃动作**，没有再执行低优先级转发规则。

现在只删除刚添加的丢弃规则：

```shell
sh ovs-ofctl -O OpenFlow13 --strict del-flows s1 "table=0,priority=200,dl_dst=00:00:00:00:00:02"
```

`--strict` 要求匹配指定的条件和优先级，保留原来的两条转发规则。

再执行：

```shell
h1 ping -c 1 -W 2 10.0.0.2
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

把输出发来。预期通信恢复，去 h2 和返回 h1 的计数各增加 1。

```shell
mininet> sh ovs-ofctl -O OpenFlow13 --strict del-flows s1 "table=0,priority=200,dl_dst=00:00:00:00:00:02"
mininet> h1 ping -c 1 -W 2 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.308 ms

--- 10.0.0.2 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.308/0.308/0.308/0.000 ms
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=723.801s, table=0, n_packets=3, n_bytes=294, priority=100,dl_dst=00:00:00:00:00:02 actions=output:"s1-eth2"
 cookie=0x0, duration=592.263s, table=0, n_packets=2, n_bytes=196, priority=100,dl_dst=00:00:00:00:00:01 actions=output:"s1-eth1"
```

**恢复成功，整组对照完成了。**

- 优先级 200 的丢弃规则已消失。
- ping 恢复成功。
- 去 h2 的计数 **2 → 3**，返回 h1 的计数 **1 → 2**，与一次往返对应。

本次实验的分工是：

```
我们用命令下发规则
        ↓
交换机 s1 匹配规则，选择最高优先级，执行动作
```

所以完整解释是：**交换机选中高优先级丢弃规则，通信失败；原来的低优先级转发规则仍在，删除丢弃规则后，交换机重新选中转发规则，通信恢复。**

这正对应之前学过的：**查表、选择规则和执行动作都属于数据平面。**

### 实验二

**`hard_timeout`（硬超时）**：

> 给规则设置 `hard_timeout=15`，表示规则安装约 15 秒后会过期，期间即使持续有数据命中，也不会因此续期。[OVS 官方说明](https://www.openvswitch.org/support/dist-docs/ovs-ofctl.8.html)

执行：

```
sudo mn --topo single,2 --switch ovs,failMode=secure,protocols=OpenFlow13 --controller none --mac --arp
```

进入新的 `mininet>` 后，逐条执行：

```shell
net
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

```shell
shanpao@shanpao-VMware20-1:~/Desktop$ sudo mn --topo single,2 --switch ovs,failMode=secure,protocols=OpenFlow13 --controller none --mac --arp
[sudo: authenticate] Password:       
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
*** Starting CLI:
mininet> net
h1 h1-eth0:s1-eth1
h2 h2-eth0:s1-eth2
s1 lo:  s1-eth1:h1-eth0 s1-eth2:h2-eth0
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
mininet> 
```

拓扑正确，流表也是空的。现在让**去 h2 的规则在 15 秒后过期**，返回 h1 的规则保持有效，这样便于判断是哪条规则影响了通信。

先添加返回规则：

```shell
sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=100,dl_dst=00:00:00:00:00:01,actions=output:1"
```

接下来先读完：执行下面的限时规则后，**立即输入下一条 ping 命令**。ping 会持续约 25 秒，期间观察回复是否中断。

```shell
sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=100,hard_timeout=15,dl_dst=00:00:00:00:00:02,actions=output:2"

h1 ping -c 25 -i 1 -W 1 10.0.0.2
```

ping 结束后再查看流表：

```shell
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

**预期**：前面能收到回复，规则过期后不再收到；最后流表只剩返回 h1 的规则。

```shell
mininet> h1 ping -c 25 -i 1 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.334 ms
64 bytes from 10.0.0.2: icmp_seq=2 ttl=64 time=0.059 ms
64 bytes from 10.0.0.2: icmp_seq=3 ttl=64 time=0.123 ms
64 bytes from 10.0.0.2: icmp_seq=4 ttl=64 time=0.065 ms
64 bytes from 10.0.0.2: icmp_seq=5 ttl=64 time=0.122 ms

--- 10.0.0.2 ping statistics ---
25 packets transmitted, 5 received, 80% packet loss, time 24580ms
rtt min/avg/max/mdev = 0.059/0.140/0.334/0.100 ms
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=98.364s, table=0, n_packets=5, n_bytes=490, priority=100,dl_dst=00:00:00:00:00:01 actions=output:"s1-eth1"
```

**硬超时实验符合预期。**

- 前 5 次 ping 收到回复，之后没有回复。
- 去 h2 的限时规则已消失。
- 返回 h1 的规则仍在，计数正好是 **5 个包**。

注意：**15 秒从规则安装时开始计算，不是从 ping 开始计算。**因此，只收到 5 次回复不代表超时被设置成了 5 秒。

规则到期后，去 h2 的请求无法再按这条规则转发；即使返回规则仍在，也不足以完成往返。

下一步可以对比 **空闲超时 `idle_timeout`**：它关注“连续多久没有命中”，有新数据命中时会重新计算空闲时间。

**`idle_timeout=10` 表示：连续约 10 秒没有数据命中，规则才会过期。**每次命中都会重新计算空闲时间。[OVS 官方说明](https://www.openvswitch.org/support/dist-docs/ovs-ofctl.8.html)

沿用当前拓扑，返回 h1 的规则仍保留。先读完下面步骤，再开始操作。

添加去 h2 的规则，这次不设硬超时：

```shell
sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=100,idle_timeout=10,hard_timeout=0,dl_dst=00:00:00:00:00:02,actions=output:2"
```

**紧接着**执行：

```shell
h1 ping -c 15 -i 1 -W 1 10.0.0.2
```

它每秒发一次，持续约 14 秒。虽然总时长超过 10 秒，但相邻命中间隔不到 10 秒，预期可以持续通信。

结束后逐条执行：

```shell
sh ovs-ofctl -O OpenFlow13 dump-flows s1
sh sleep 12
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

预期第一次查看时去 h2 的规则仍在；停止发包、空闲 12 秒后，第二次查看时它已消失。

```shell
mininet> h1 ping -c 15 -i 1 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.229 ms
64 bytes from 10.0.0.2: icmp_seq=2 ttl=64 time=0.076 ms
64 bytes from 10.0.0.2: icmp_seq=3 ttl=64 time=0.172 ms
64 bytes from 10.0.0.2: icmp_seq=4 ttl=64 time=0.127 ms
64 bytes from 10.0.0.2: icmp_seq=5 ttl=64 time=0.119 ms
64 bytes from 10.0.0.2: icmp_seq=6 ttl=64 time=0.114 ms
64 bytes from 10.0.0.2: icmp_seq=7 ttl=64 time=0.091 ms
64 bytes from 10.0.0.2: icmp_seq=8 ttl=64 time=0.120 ms
64 bytes from 10.0.0.2: icmp_seq=9 ttl=64 time=0.127 ms
64 bytes from 10.0.0.2: icmp_seq=10 ttl=64 time=0.118 ms
64 bytes from 10.0.0.2: icmp_seq=11 ttl=64 time=0.061 ms
64 bytes from 10.0.0.2: icmp_seq=12 ttl=64 time=0.137 ms
64 bytes from 10.0.0.2: icmp_seq=13 ttl=64 time=0.112 ms
64 bytes from 10.0.0.2: icmp_seq=14 ttl=64 time=0.116 ms
64 bytes from 10.0.0.2: icmp_seq=15 ttl=64 time=0.097 ms

--- 10.0.0.2 ping statistics ---
15 packets transmitted, 15 received, 0% packet loss, time 14299ms
rtt min/avg/max/mdev = 0.061/0.121/0.229/0.038 ms
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=595.553s, table=0, n_packets=20, n_bytes=1960, priority=100,dl_dst=00:00:00:00:00:01 actions=output:"s1-eth1"
mininet> sh sleep 12
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=630.763s, table=0, n_packets=20, n_bytes=1960, priority=100,dl_dst=00:00:00:00:00:01 actions=output:"s1-eth1"
```

**5 次 ping 全部成功，持续约 14.3 秒**，这符合空闲超时的预期：虽然总时长超过 10 秒，但每秒都有一次命中，空闲计时不断刷新。

第一次查表时规则已经消失，**可能是 ping 结束到查表之间已空闲超过 10 秒**。我们没有记录这段间隔，所以不能精确判断过期时刻；第二次查询也只能确认它仍然不在。

两种超时的区别是：

| 设置              | 持续命中的作用                       |
| ----------------- | ------------------------------------ |
| `hard_timeout=10` | 不续期，到期仍删除                   |
| `idle_timeout=10` | 刷新空闲计时，连续空闲约 10 秒才删除 |

### 实验三

这次使用 **OVS 官方测试控制器 `ovs-testcontroller`**。它能学习 MAC 地址并下发流规则，适合先观察控制器参与转发，而且不依赖 Python 控制器框架。

接下来的分工变为：

```
控制器：接收上报，决定并下发规则
交换机：匹配规则，执行转发
```

如果没有退出，先在当前 `mininet>` 输入：

```shell
exit
```

回到 **Ubuntu 普通终端**后，逐条执行：

```shell
sudo apt update
sudo apt install --no-install-recommends openvswitch-testcontroller
```

安装完成后检查：

```shell
ovs-testcontroller --version
command -v ovs-testcontroller
```

```shell
shanpao@shanpao-VMware20-1:~/Desktop$ ovs-testcontroller --version
ovs-testcontroller (Open vSwitch) 3.7.1
OpenFlow versions 0x1:0x6
shanpao@shanpao-VMware20-1:~/Desktop$ command -v ovs-testcontroller
/usr/bin/ovs-testcontroller
```

安装成功，控制器版本是 **3.7.1**。接下来准备一个专门运行控制器的终端，称为**终端 A**。

先在 Ubuntu 普通终端执行：

```
sudo ss -ltnp 'sport = :6653'
```

- 如果只有表头、没有监听记录，继续下面步骤。
- 如果有监听记录，先把输出发来，避免重复启动。

端口空闲时执行：

```
ovs-testcontroller -O OpenFlow13 --unixctl=none -vconsole:dbg ptcp:6653:127.0.0.1
```

这条命令的含义：

| 部分                  | 作用                                       |
| --------------------- | ------------------------------------------ |
| `-O OpenFlow13`       | 使用 OpenFlow 1.3                          |
| `ptcp:6653:127.0.0.1` | 只在 Ubuntu 本机的 6653 端口等待交换机连接 |
| `-vconsole:dbg`       | 在终端显示详细日志                         |
| `--unixctl=none`      | 暂不创建额外的运行时管理套接字             |

```shell
shanpao@shanpao-VMware20-1:~/Desktop$ sudo ss -ltnp 'sport = :6653'
State    Recv-Q    Send-Q       Local Address:Port       Peer Address:Port    Process    
shanpao@shanpao-VMware20-1:~/Desktop$ ovs-testcontroller -O OpenFlow13 --unixctl=none -vconsole:dbg ptcp:6653:127.0.0.1
```

这是正常的等待状态，控制器暂时还没有交换机连接。**保留终端 A。**

另开一个 Ubuntu 终端，称为**终端 B**，执行：

```shell
sudo mn --topo single,2 --switch ovs,failMode=secure,protocols=OpenFlow13 --controller remote,ip=127.0.0.1,port=6653 --mac --arp
```

这次把原来的 `--controller none` 换成了 `remote`：让交换机通过 OpenFlow 连接指定地址的控制器。这里的 “remote” 指控制器由 Mininet 外部运行，仍可以位于同一台 Ubuntu。

出现 `mininet>` 后，先不 ping，执行：

```shell
sh ovs-vsctl get-controller s1
sh ovs-vsctl --columns=target,is_connected list Controller
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

```shell
shanpao@shanpao-VMware20-1:~/Desktop$ sudo mn --topo single,2 --switch ovs,failMode=secure,protocols=OpenFlow13 --controller remote,ip=127.0.0.1,port=6653 --mac --arp
[sudo: authenticate] Password:       
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
c0 
*** Starting 1 switches
s1 ...
*** Starting CLI:
mininet> sh ovs-vsctl get-controller s1
ptcp:6654
tcp:127.0.0.1:6653
mininet> sh ovs-vsctl --columns=target,is_connected list Controller
target              : "tcp:127.0.0.1:6653"
is_connected        : true

target              : "ptcp:6654"
is_connected        : false
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=26.309s, table=0, n_packets=14, n_bytes=1172, priority=0 actions=CONTROLLER:128
```

**控制器连接成功了。**关键证据是：

```shell
target       : "tcp:127.0.0.1:6653"
is_connected : true
```

另一个 `ptcp:6654` 是交换机等待其他管理连接的监听入口，显示 `false` 不代表上面的控制器连接失败。

现在流表中还有一条自动安装的规则：

```shell
priority=0 actions=CONTROLLER:128
```

它是**兜底上送规则**：没有更高优先级规则匹配时，把数据上送控制器。`128` 是请求上送的数据字节数上限，**不是端口号**。

已有的 `n_packets=14` 表示它被命中了 14 次；我们还没核对报文内容，不能直接说这些都是 ping。

在**终端 B 的 `mininet>`** 下依次执行：

```shell
h1 ping -c 3 -W 1 10.0.0.2
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

```shell
mininet> h1 ping -c 3 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=2.09 ms
64 bytes from 10.0.0.2: icmp_seq=2 ttl=64 time=0.225 ms
64 bytes from 10.0.0.2: icmp_seq=3 ttl=64 time=0.043 ms

--- 10.0.0.2 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2043ms
rtt min/avg/max/mdev = 0.043/0.784/2.085/0.922 ms
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=9.787s, table=0, n_packets=2, n_bytes=196, idle_timeout=60, priority=1,icmp,in_port="s1-eth1",vlan_tci=0x0000/0x1fff,dl_src=00:00:00:00:00:01,dl_dst=00:00:00:00:00:02,nw_src=10.0.0.1,nw_dst=10.0.0.2,nw_tos=0,icmp_type=8,icmp_code=0 actions=output:"s1-eth2"
 cookie=0x0, duration=9.787s, table=0, n_packets=2, n_bytes=196, idle_timeout=60, priority=1,icmp,in_port="s1-eth2",vlan_tci=0x0000/0x1fff,dl_src=00:00:00:00:00:02,dl_dst=00:00:00:00:00:01,nw_src=10.0.0.2,nw_dst=10.0.0.1,nw_tos=0,icmp_type=0,icmp_code=0 actions=output:"s1-eth1"
 cookie=0x0, duration=212.057s, table=0, n_packets=22, n_bytes=1788, priority=0 actions=CONTROLLER:128
```

**控制器自动下发规则成功了。**你没有手动添加转发规则，但 ping 全部成功，流表新增了两条具体规则：

| 匹配的数据                       | 动作          |
| -------------------------------- | ------------- |
| h1→h2，`icmp_type=8`（回显请求） | 从端口 2 发出 |
| h2→h1，`icmp_type=0`（回显回复） | 从端口 1 发出 |

它们都是 **优先级 1、空闲超时 60 秒**。优先级 0 的上送规则仍保留，所以处理关系是：

```
匹配具体规则 → 交换机直接转发
没有具体规则匹配 → 命中兜底规则，上送控制器
```

每条具体规则计数为 **2**，而 ping 发了 **3** 次，并不矛盾：初始数据可以通过控制器的 `Packet-Out` 处理。

**如果停止通信超过 60 秒，两条具体规则都过期了，但兜底上送规则仍在、控制器也正常运行，再 ping 一定会像之前的无控制器实验那样持续失败吗？为什么？**

回答：不会，因为兜底上送规则仍在、控制器也正常运行，再ping会将消息上传到控制器处理

正确。具体规则过期后，新帧会匹配**兜底上送规则**，触发 Packet-In；控制器可以处理它，并重新下发转发规则。

因此，这和之前“没有控制器、没有上送规则”的实验不同。这里具备恢复转发的机制，但**首个 ping 是否成功仍取决于处理时延等因素**，不能保证完全不丢包。



**“控制消息日志”观察**

先准备**带日志文件的控制器**。

如果旧实验还在运行，先在终端 B 的 `mininet>` 输入 `exit`，再到终端 A 按 `Ctrl+C`。已经停止的就跳过。

在**终端 A 的普通提示符**下执行：

```shell
ovs-testcontroller -O OpenFlow13 --unixctl=none --log-file=/tmp/sdn-controller-messages.log -vconsole:info -vfile:dbg ptcp:6653:127.0.0.1
```

与之前相比，只改变了日志设置：

- 终端显示简要信息；
- 详细消息写入 `/tmp/sdn-controller-messages.log`。

```shell
shanpao@shanpao-VMware20-1:~/Desktop$ ovs-testcontroller -O OpenFlow13 --unixctl=none --log-file=/tmp/sdn-controller-messages.log -vconsole:info -vfile:dbg ptcp:6653:127.0.0.1
2026-10-20T06:30:07Z|00001|vlog|INFO|opened log file /tmp/sdn-controller-messages.log
```

日志文件已成功打开，保留**终端 A**运行。

在**终端 B 的普通提示符**下启动拓扑：

```shell
sudo mn --topo single,2 --switch ovs,failMode=secure,protocols=OpenFlow13 --controller remote,ip=127.0.0.1,port=6653 --mac --arp
```

出现 `mininet>` 后，逐条执行：

```shell
sh ovs-vsctl --columns=target,is_connected list Controller
h1 ping -c 3 -W 1 10.0.0.2
sh grep -nEi 'packet.?in|flow.?mod|packet.?out' /tmp/sdn-controller-messages.log | tail -n 25
```

最后一条只筛选近期的三类消息：

| 消息       | 方向与作用                                      |
| ---------- | ----------------------------------------------- |
| Packet-In  | 交换机 → 控制器，上报数据                       |
| Flow-Mod   | 控制器 → 交换机，修改流表                       |
| Packet-Out | 控制器 → 交换机，指示如何处理携带或引用的数据包 |

```shell
mininet> sh ovs-vsctl --columns=target,is_connected list Controller
target              : "ptcp:6654"
is_connected        : false

target              : "tcp:127.0.0.1:6653"
is_connected        : true
mininet> h1 ping -c 3 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=1.07 ms
64 bytes from 10.0.0.2: icmp_seq=2 ttl=64 time=0.176 ms
64 bytes from 10.0.0.2: icmp_seq=3 ttl=64 time=0.124 ms

--- 10.0.0.2 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2009ms
rtt min/avg/max/mdev = 0.124/0.456/1.068/0.433 ms
mininet> sh grep -nEi 'packet.?in|flow.?mod|packet.?out' /tmp/sdn-controller-messages.log | tail -n 25
69:2026-10-20T06:31:30.103Z|00051|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0xc): in_port=2 actions=FLOOD data_len=90
71:2026-10-20T06:31:30.103Z|00052|vconn|DBG|tcp:127.0.0.1:51592: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=90 in_port=1 (via no_match) data_len=90 (unbuffered)
73:2026-10-20T06:31:30.103Z|00053|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0xd): in_port=1 actions=FLOOD data_len=90
75:2026-10-20T06:31:30.103Z|00054|vconn|DBG|tcp:127.0.0.1:51592: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=70 in_port=1 (via no_match) data_len=70 (unbuffered)
77:2026-10-20T06:31:30.103Z|00055|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0xe): in_port=1 actions=FLOOD data_len=70
80:2026-10-20T06:31:30.935Z|00057|vconn|DBG|tcp:127.0.0.1:51592: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=90 in_port=1 (via no_match) data_len=90 (unbuffered)
82:2026-10-20T06:31:30.935Z|00058|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0xf): in_port=1 actions=FLOOD data_len=90
85:2026-10-20T06:31:33.047Z|00060|vconn|DBG|tcp:127.0.0.1:51592: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=70 in_port=2 (via no_match) data_len=70 (unbuffered)
87:2026-10-20T06:31:33.047Z|00061|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x10): in_port=2 actions=FLOOD data_len=70
90:2026-10-20T06:31:33.879Z|00063|vconn|DBG|tcp:127.0.0.1:51592: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=70 in_port=1 (via no_match) data_len=70 (unbuffered)
92:2026-10-20T06:31:33.880Z|00064|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x11): in_port=1 actions=FLOOD data_len=70
98:2026-10-20T06:31:40.919Z|00069|vconn|DBG|tcp:127.0.0.1:51592: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=70 in_port=2 (via no_match) data_len=70 (unbuffered)
100:2026-10-20T06:31:40.919Z|00070|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x12): in_port=2 actions=FLOOD data_len=70
103:2026-10-20T06:31:41.943Z|00072|vconn|DBG|tcp:127.0.0.1:51592: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=70 in_port=1 (via no_match) data_len=70 (unbuffered)
105:2026-10-20T06:31:41.943Z|00073|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x13): in_port=1 actions=FLOOD data_len=70
114:2026-10-20T06:31:54.464Z|00081|vconn|DBG|tcp:127.0.0.1:51592: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=98 in_port=1 (via no_match) data_len=98 (unbuffered)
116:2026-10-20T06:31:54.464Z|00082|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_FLOW_MOD (OF1.3) (xid=0x14): ADD priority=1,icmp,in_port=1,vlan_tci=0x0000/0x1fff,dl_src=00:00:00:00:00:01,dl_dst=00:00:00:00:00:02,nw_src=10.0.0.1,nw_dst=10.0.0.2,nw_tos=0,icmp_type=8,icmp_code=0 idle:60 actions=output:2
117:2026-10-20T06:31:54.464Z|00083|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x15): in_port=1 actions=output:2 data_len=98
120:2026-10-20T06:31:54.465Z|00085|vconn|DBG|tcp:127.0.0.1:51592: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=98 in_port=2 (via no_match) data_len=98 (unbuffered)
122:2026-10-20T06:31:54.465Z|00086|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_FLOW_MOD (OF1.3) (xid=0x16): ADD priority=1,icmp,in_port=2,vlan_tci=0x0000/0x1fff,dl_src=00:00:00:00:00:02,dl_dst=00:00:00:00:00:01,nw_src=10.0.0.2,nw_dst=10.0.0.1,nw_tos=0,icmp_type=0,icmp_code=0 idle:60 actions=output:1
123:2026-10-20T06:31:54.465Z|00087|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x17): in_port=2 actions=output:1 data_len=98
126:2026-10-20T06:31:56.791Z|00089|vconn|DBG|tcp:127.0.0.1:51592: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=70 in_port=2 (via no_match) data_len=70 (unbuffered)
128:2026-10-20T06:31:56.791Z|00090|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x18): in_port=2 actions=FLOOD data_len=70
131:2026-10-20T06:31:57.815Z|00092|vconn|DBG|tcp:127.0.0.1:51592: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=70 in_port=1 (via no_match) data_len=70 (unbuffered)
133:2026-10-20T06:31:57.815Z|00093|vconn|DBG|tcp:127.0.0.1:51592: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x19): in_port=1 actions=FLOOD data_len=70
```

**这次直接观察到了三类控制消息。**先只看日志第 **114、116、117 行**，它们对应 h1→h2 的请求：

| 消息       | 日志关键内容                            | 作用                                          |
| ---------- | --------------------------------------- | --------------------------------------------- |
| Packet-In  | `received ... in_port=1 (via no_match)` | 交换机没有具体规则匹配，把数据上报控制器      |
| Flow-Mod   | `sent ... ADD ... actions=output:2`     | 控制器安装“这类数据从端口 2 发出”的规则       |
| Packet-Out | `sent ... actions=output:2 data_len=98` | 控制器指示交换机把当前上报的数据从端口 2 发出 |

这里 `received` 和 `sent` 都是**站在控制器的角度**说的。

第 **120、122、123 行**则对应 h2→h1 的回复，过程相同，出口变成端口 1。

关键区别是：

```
Flow-Mod：改流表，让后续匹配的数据有规则可用。
Packet-Out：指示交换机处理当前这份数据。
```

所以，“安装规则”和“把当前包发出去”是两个不同操作；这次日志把它们分别显示出来了。

关键是分清两个东西：**当前这个包**，以及**交换机里的规则表**。

假设 h1 发出的第一个 ping 请求叫 **P1**。

**第一步：P1 到达交换机，但没有具体规则匹配。**

交换机命中兜底规则，发送 Packet-In，把 P1 的内容上报给控制器：

```
h1 发出 P1 → 交换机 → Packet-In → 控制器
```

这次日志写着：

```
unbuffered
```

意思是：**交换机没有为这个上报包提供一个可供控制器后续引用的缓存编号。**因此，不能假定交换机还存着一份 P1，等装完规则后自动接着转发。

**第二步：控制器发送 Flow-Mod，安装规则。**

控制器决定去 h2 的数据应该从端口 2 发出，于是发送：

```
Flow-Mod：添加“符合这些条件 → 从端口 2 发出”
```

交换机的规则表发生了变化：

| 原来         | 现在                       |
| ------------ | -------------------------- |
| 没有对应规则 | 有了“去 h2 → 端口 2”的规则 |

但这个动作处理的是**规则表**。它本身不能证明 P1 已经被发送出去。

之后到来的 P2、P3，可以匹配这条规则直接转发：

```
P2 到达 → 查到规则 → 从端口 2 发出
P3 到达 → 查到规则 → 从端口 2 发出
```

**第三步：控制器用 Packet-Out 处理当前的 P1。**

本次控制器另外发送了：

```
Packet-Out：携带 P1，要求交换机从端口 2 发出
```

你的日志里：

```
actions=output:2 data_len=98
```

表示这条消息携带了 **98 字节的数据**，并指定出口为端口 2。

把整个过程放在一起：

```
当前包 P1：
上报控制器 → 控制器用 Packet-Out 把它交回交换机发送

后续包 P2、P3：
到达交换机 → 匹配 Flow-Mod 安装的规则 → 直接转发
```

**第一个包 P1**：

**① P1 到达时，转发规则还不存在。**

```
P1 到达交换机 → 找不到具体转发规则 → Packet-In 上报控制器
```

注意：**P1 此时没有匹配到后来才安装的转发规则。**

**② 控制器发送 Flow-Mod，给交换机加规则。**

```
规则表新增：“目的为 h2 → 从端口 2 发出”
```

你说的“匹配成功就能按规则发出去”，适用于**现在到达并查表的包**。但 **Flow-Mod 不会仅因为规则装好了，就自动让之前上报的 P1 再查一次表。**

**③ 所以控制器另外发送 Packet-Out，处理 P1。**

在你这次日志里，它的意思是：

> “交换机，这是刚才那个 P1 的数据，请你现在从端口 2 发出去。”

**Packet-Out 是控制器发给交换机的指令，真正把业务帧发给 h2 的仍然是交换机。**

随后，第二个包 P2 到达：

```
P2 到达交换机 → 已有规则 → 匹配成功 → 直接从端口 2 发出
```

这时不需要再上报，也不需要再等 Packet-Out。

可以把两者记成：

| 消息           | 本次实验里的作用               |
| -------------- | ------------------------------ |
| **Flow-Mod**   | 给交换机写下处理规则           |
| **Packet-Out** | 告诉交换机怎样处理当前这一个包 |

还有一点：“匹配成功”表示选中了规则；要看动作是什么。之前你已经验证过，**匹配到 `drop` 规则也会被丢弃**，并不保证发出或收到。

**规则不会生成数据包，也不会自动把之前上报的包重新送入转发流程。**

所以这次实验中：

- **Flow-Mod**：装好规则，供后续到达的包匹配。
- **Packet-Out**：携带刚才的 P1，并指示交换机从端口 2 发出。
- **后续的 P2、P3**：直接匹配已有规则，由交换机转发，不再需要 Packet-Out。

这次只改变控制器的一个行为：**处理上报的包，但不安装具体转发规则**。

正常情况下，控制器会：

```
收到 Packet-In → 下发 Flow-Mod ＋ 用 Packet-Out 处理当前包
```

加上 `--noflow` 后，它仍可发送 Packet-Out，但不再安装具体转发规则。[OVS 官方说明](https://www.openvswitch.org/support/dist-docs/ovs-testcontroller.8.html)

先收尾旧实验：

1. **终端 B**：在 `mininet>` 输入 `exit`。
2. **终端 A**：按 `Ctrl+C` 停止旧控制器。

然后在**终端 A**启动新控制器：

```shell
ovs-testcontroller -O OpenFlow13 --noflow --unixctl=none --log-file=/tmp/sdn-controller-noflow.log -vconsole:info -vfile:dbg ptcp:6653:127.0.0.1
```

在**终端 B**重建拓扑：

```shell
sudo mn --topo single,2 --switch ovs,failMode=secure,protocols=OpenFlow13 --controller remote,ip=127.0.0.1,port=6653 --mac --arp
```

出现 `mininet>` 后，逐条执行：

```shell
h1 ping -c 3 -W 1 10.0.0.2
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

```shell
mininet> h1 ping -c 3 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=1.21 ms
64 bytes from 10.0.0.2: icmp_seq=2 ttl=64 time=0.519 ms
64 bytes from 10.0.0.2: icmp_seq=3 ttl=64 time=1.51 ms
--- 10.0.0.2 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2046ms
rtt min/avg/max/mdev = 0.519/1.078/1.512/0.415 ms
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=21.404s, table=0, n_packets=20, n_bytes=1760, priority=0 actions=CONTROLLER:128
```

这正好体现了 **Packet-Out 的作用**：**没有具体转发规则，也可以由控制器逐包指示交换机转发。**

本次预期路径是：

```
每个请求或回复到达交换机
        ↓
兜底规则 → Packet-In 上报控制器
        ↓
控制器发送 Packet-Out
        ↓
交换机按这一次的指令发出该包
```

Packet-Out 的指令只处理这份数据，**不会自动留下供下一包使用的转发规则**，因此下一包还需要再次上报。

现在用日志核实。在 `mininet>` 执行：

```shell
sh grep -nE 'OFPT_PACKET_IN.*total_len=98|OFPT_PACKET_OUT.*data_len=98' /tmp/sdn-controller-noflow.log | tail -n 12
```

```shell
mininet> sh grep -nE 'OFPT_PACKET_IN.*total_len=98|OFPT_PACKET_OUT.*data_len=98' /tmp/sdn-controller-noflow.log | tail -n 12
110:2026-10-20T07:58:44.194Z|00076|vconn|DBG|tcp:127.0.0.1:40870: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=98 in_port=1 (via no_match) data_len=98 (unbuffered)
112:2026-10-20T07:58:44.194Z|00077|vconn|DBG|tcp:127.0.0.1:40870: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x13): in_port=1 actions=output:2 data_len=98
115:2026-10-20T07:58:44.194Z|00079|vconn|DBG|tcp:127.0.0.1:40870: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=98 in_port=2 (via no_match) data_len=98 (unbuffered)
117:2026-10-20T07:58:44.194Z|00080|vconn|DBG|tcp:127.0.0.1:40870: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x14): in_port=2 actions=output:1 data_len=98
120:2026-10-20T07:58:45.195Z|00082|vconn|DBG|tcp:127.0.0.1:40870: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=98 in_port=1 (via no_match) data_len=98 (unbuffered)
122:2026-10-20T07:58:45.195Z|00083|vconn|DBG|tcp:127.0.0.1:40870: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x15): in_port=1 actions=output:2 data_len=98
125:2026-10-20T07:58:45.196Z|00085|vconn|DBG|tcp:127.0.0.1:40870: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=98 in_port=2 (via no_match) data_len=98 (unbuffered)
127:2026-10-20T07:58:45.196Z|00086|vconn|DBG|tcp:127.0.0.1:40870: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x16): in_port=2 actions=output:1 data_len=98
135:2026-10-20T07:58:46.239Z|00091|vconn|DBG|tcp:127.0.0.1:40870: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=98 in_port=1 (via no_match) data_len=98 (unbuffered)
137:2026-10-20T07:58:46.240Z|00092|vconn|DBG|tcp:127.0.0.1:40870: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x18): in_port=1 actions=output:2 data_len=98
140:2026-10-20T07:58:46.240Z|00094|vconn|DBG|tcp:127.0.0.1:40870: received: OFPT_PACKET_IN (OF1.3) (xid=0x0): cookie=0x0 total_len=98 in_port=2 (via no_match) data_len=98 (unbuffered)
142:2026-10-20T07:58:46.240Z|00095|vconn|DBG|tcp:127.0.0.1:40870: sent (Success): OFPT_PACKET_OUT (OF1.3) (xid=0x19): in_port=2 actions=output:1 data_len=98
```

这次能直接看出 **Packet-Out 是一次性的发包指令**。

三轮日志都重复了同样的过程：

| 时间       | 请求方向                            | 回复方向                            |
| ---------- | ----------------------------------- | ----------------------------------- |
| `07:58:44` | 入端口 1 → 上报 → 指示从端口 2 发出 | 入端口 2 → 上报 → 指示从端口 1 发出 |
| `07:58:45` | 同上                                | 同上                                |
| `07:58:46` | 同上                                | 同上                                |

**上一轮已经发送过 Packet-Out，下一轮仍然再次出现 Packet-In。**结合流表中没有具体转发规则，这说明 Packet-Out 没有替后续包留下转发规则。

现在这样区分：

- **Packet-Out**：“把这份数据从端口 2 发出去。”
- **Flow-Mod**：“在流表中加入规则，让以后符合条件的数据从端口 2 发出去。”

现在已验证两种方式：

| 方式           | 后续匹配包怎样转发                     |
| -------------- | -------------------------------------- |
| 安装具体规则   | 交换机直接按规则转发                   |
| 不安装具体规则 | 每次上报，控制器用 Packet-Out 指示转发 |



**比较两种方式的 Packet-In 数量**

先测当前的 **`--noflow` 模式**：固定发送 5 次 ping，比较前后的 Packet-In 数量，不提高发送速率。

在**终端 B 的 `mininet>`** 下，逐条执行：

**① 记录测试前的计数：**

```
sh grep -cE 'received: OFPT_PACKET_IN .*total_len=98 in_port=[12] .*data_len=98' /tmp/sdn-controller-noflow.log
```

它统计日志中符合本次 ping 帧长度、来自端口 1 或 2 的 Packet-In。

**② 发送 5 次 ping：**

```
h1 ping -c 5 -i 1 -W 1 10.0.0.2
```

**③ 再读一次计数：**

```
sh grep -cE 'received: OFPT_PACKET_IN .*total_len=98 in_port=[12] .*data_len=98' /tmp/sdn-controller-noflow.log
```

我们关注的是：

```
本轮新增上报数 = 测试后计数 − 测试前计数
```

若请求和回复都逐包上报，**5 次成功的 ping 预期新增 10 条 Packet-In**，因为一次 ping 包含一个请求和一个回复。

```shell
mininet> sh grep -cE 'received: OFPT_PACKET_IN .*total_len=98 in_port=[12] .*data_len=98' /tmp/sdn-controller-noflow.log
6
mininet> h1 ping -c 5 -i 1 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=1.01 ms
64 bytes from 10.0.0.2: icmp_seq=2 ttl=64 time=0.366 ms
64 bytes from 10.0.0.2: icmp_seq=3 ttl=64 time=1.46 ms
64 bytes from 10.0.0.2: icmp_seq=4 ttl=64 time=0.710 ms
64 bytes from 10.0.0.2: icmp_seq=5 ttl=64 time=1.52 ms
--- 10.0.0.2 ping statistics ---
5 packets transmitted, 5 received, 0% packet loss, time 4079ms
rtt min/avg/max/mdev = 0.366/1.013/1.521/0.439 ms
mininet> sh grep -cE 'received: OFPT_PACKET_IN .*total_len=98 in_port=[12] .*data_len=98' /tmp/sdn-controller-noflow.log
16
```

第一组结果明确：

```
新增 Packet-In = 16 − 6 = 10 条
```

对应 **5 个请求＋5 个回复**。这说明能 ping 通，但每轮通信都需要控制器参与。

现在准备第二组：

**允许控制器安装具体规则**。

先在终端 B 输入 `exit`，再到终端 A 按 `Ctrl+C`。

在**终端 A**执行，注意这次去掉了 `--noflow`，并换了日志文件：

```
ovs-testcontroller -O OpenFlow13 --unixctl=none --log-file=/tmp/sdn-controller-withflows.log -vconsole:info -vfile:dbg ptcp:6653:127.0.0.1
```

在**终端 B**启动拓扑：

```
sudo mn --topo single,2 --switch ovs,failMode=secure,protocols=OpenFlow13 --controller remote,ip=127.0.0.1,port=6653 --mac --arp
```

出现 `mininet>` 后执行：

```
h1 ping -c 3 -W 1 10.0.0.2
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

这 3 次是**预热通信，用于建立规则**，不计入后面正式比较的 5 次 ping。

预热成功，两条 **优先级 1、空闲超时 60 秒**的具体规则都已建立。

为了避免聊天期间规则过期，我们先再预热一次，随后连续完成计数。**先读完，再逐条执行，期间不要停留超过 60 秒。**

**① 预热，不计入正式测试：**

```shell
h1 ping -c 2 -W 1 10.0.0.2
```

**② 读取测试前计数：**

```shell
sh grep -cE 'received: OFPT_PACKET_IN .*total_len=98 in_port=[12] .*data_len=98' /tmp/sdn-controller-withflows.log
```

**③ 正式发送同样的 5 次 ping：**

```shell
h1 ping -c 5 -i 1 -W 1 10.0.0.2
```

**④ 读取测试后计数和流表：**

```shell
sh grep -cE 'received: OFPT_PACKET_IN .*total_len=98 in_port=[12] .*data_len=98' /tmp/sdn-controller-withflows.log
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

```shell
mininet> h1 ping -c 2 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=1.30 ms
64 bytes from 10.0.0.2: icmp_seq=2 ttl=64 time=0.439 ms

--- 10.0.0.2 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1003ms
rtt min/avg/max/mdev = 0.439/0.867/1.295/0.428 ms
mininet> sh grep -cE 'received: OFPT_PACKET_IN .*total_len=98 in_port=[12] .*data_len=98' /tmp/sdn-controller-withflows.log
4
mininet> h1 ping -c 5 -i 1 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.364 ms
64 bytes from 10.0.0.2: icmp_seq=2 ttl=64 time=0.035 ms
64 bytes from 10.0.0.2: icmp_seq=3 ttl=64 time=0.157 ms
64 bytes from 10.0.0.2: icmp_seq=4 ttl=64 time=0.130 ms
64 bytes from 10.0.0.2: icmp_seq=5 ttl=64 time=0.068 ms

--- 10.0.0.2 ping statistics ---
5 packets transmitted, 5 received, 0% packet loss, time 4129ms
rtt min/avg/max/mdev = 0.035/0.150/0.364/0.115 ms
mininet> sh grep -cE 'received: OFPT_PACKET_IN .*total_len=98 in_port=[12] .*data_len=98' /tmp/sdn-controller-withflows.log
4
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=23.457s, table=0, n_packets=6, n_bytes=588, idle_timeout=60, priority=1,icmp,in_port="s1-eth1",vlan_tci=0x0000/0x1fff,dl_src=00:00:00:00:00:01,dl_dst=00:00:00:00:00:02,nw_src=10.0.0.1,nw_dst=10.0.0.2,nw_tos=0,icmp_type=8,icmp_code=0 actions=output:"s1-eth2"
 cookie=0x0, duration=23.456s, table=0, n_packets=6, n_bytes=588, idle_timeout=60, priority=1,icmp,in_port="s1-eth2",vlan_tci=0x0000/0x1fff,dl_src=00:00:00:00:00:02,dl_dst=00:00:00:00:00:01,nw_src=10.0.0.2,nw_dst=10.0.0.1,nw_tos=0,icmp_type=0,icmp_code=0 actions=output:"s1-eth1"
 cookie=0x0, duration=1159.279s, table=0, n_packets=29, n_bytes=2334, priority=0 actions=CONTROLLER:128
```

**两组对照完成了：同样的业务量，产生了不同的上报量。**

| 控制器模式       | 正式测试          | 新增 Packet-In |
| ---------------- | ----------------- | -------------- |
| 不安装具体规则   | 5 次 ping，全成功 | `16 − 6 = 10`  |
| 已有有效具体规则 | 5 次 ping，全成功 | `4 − 4 = 0`    |

第二组里，交换机直接匹配请求、回复规则并转发，因此这些包不必再次上报控制器。

这就把之前的理论验证出来了：**控制器的上报负担，不只取决于业务包数量，还取决于这些包是否需要上送。**本次测的是上报数量，尚未测控制器的最大处理能力。

**有有效具体规则时，交换机直接匹配并转发，不需要这轮控制器交互。**



**OVS 的限速方式**

这次只对 **h1 发往 h2 的 ping 请求，在上送控制器前限速**，观察合法请求是否也会被丢弃。每轮只发 10 个请求。

我们使用 OpenFlow 的 **meter（计量限速器）**：超过设定速率的包可被丢弃。[OVS 官方说明](https://www.openvswitch.org/support/dist-docs/ovs-ofctl.8.html)

先准备环境：

1. **终端 B**：输入 `exit`。
2. **终端 A**：按 `Ctrl+C`。
3. 在**终端 A**启动不安装具体规则的控制器：

```shell
ovs-testcontroller -O OpenFlow13 --noflow --unixctl=none --log-file=/tmp/sdn-controller-meter.log -vconsole:info -vfile:dbg ptcp:6653:127.0.0.1
```

在**终端 B**重建拓扑：

```shell
sudo mn --topo single,2 --switch ovs,failMode=secure,protocols=OpenFlow13 --controller remote,ip=127.0.0.1,port=6653 --mac --arp
```

出现 `mininet>` 后执行：

```shell
sh ovs-vsctl --columns=target,is_connected list Controller
sh ovs-ofctl -O OpenFlow13 meter-features s1
```

```shell
shanpao@shanpao-VMware20-1:~/Desktop$ sudo mn --topo single,2 --switch ovs,failMode=secure,protocols=OpenFlow13 --controller remote,ip=127.0.0.1,port=6653 --mac --arp
[sudo: authenticate] Password:       
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
c0 
*** Starting 1 switches
s1 ...
*** Starting CLI:
mininet> sh ovs-vsctl --columns=target,is_connected list Controller
target              : "tcp:127.0.0.1:6653"
is_connected        : true

target              : "ptcp:6654"
is_connected        : false
mininet> sh ovs-ofctl -O OpenFlow13 meter-features s1
OFPST_METER_FEATURES reply (OF1.3) (xid=0x2):
max_meter:200000 max_bands:1 max_color:0
band_types: drop
capabilities: kbps pktps burst stats
```

控制器已连接，交换机也支持我们需要的功能：

- `pktps`：按每秒包数计量；
- `drop`：丢弃超额包；
- `stats`：查看计量与丢弃统计。

先做**未限速基线**。在当前 `mininet>` 中逐条执行：

```shell
sh ovs-ofctl -O OpenFlow13 dump-flows s1
h1 ping -c 10 -i 0.2 -W 1 10.0.0.2
```

第一条确认流表状态；第二条发送 **10 个请求，间隔 0.2 秒，约每秒 5 个**。

```shell
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=171.199s, table=0, n_packets=20, n_bytes=1592, priority=0 actions=CONTROLLER:128
mininet> h1 ping -c 10 -i 0.2 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=1.02 ms
64 bytes from 10.0.0.2: icmp_seq=2 ttl=64 time=1.74 ms
64 bytes from 10.0.0.2: icmp_seq=3 ttl=64 time=0.914 ms
64 bytes from 10.0.0.2: icmp_seq=4 ttl=64 time=0.964 ms
64 bytes from 10.0.0.2: icmp_seq=5 ttl=64 time=0.461 ms
64 bytes from 10.0.0.2: icmp_seq=6 ttl=64 time=1.39 ms
64 bytes from 10.0.0.2: icmp_seq=7 ttl=64 time=0.473 ms
64 bytes from 10.0.0.2: icmp_seq=8 ttl=64 time=0.401 ms
64 bytes from 10.0.0.2: icmp_seq=9 ttl=64 time=0.429 ms
64 bytes from 10.0.0.2: icmp_seq=10 ttl=64 time=0.387 ms

--- 10.0.0.2 ping statistics ---
10 packets transmitted, 10 received, 0% packet loss, time 1842ms
rtt min/avg/max/mdev = 0.387/0.817/1.738/0.447 ms
```

基线已确认：**10 发、10 收，没有丢包。**

现在在 `mininet>` 中逐条执行。

**① 创建限速器：每秒 1 个包，允许 1 个包的突发量，超额丢弃并记录统计。**

```shell
sh ovs-ofctl -O OpenFlow13 add-meter s1 "meter=1,pktps,burst,stats,bands=type=drop,rate=1,burst_size=1"
```

**② 只让 h1→h2 的 ping 请求经过它，再上送控制器：**

```shell
sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=10,icmp,in_port=1,nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0,actions=meter:1,CONTROLLER:128"
```

处理顺序是：

```
匹配请求 → meter 检查
             ├─ 允许：上送控制器
             └─ 超额：在交换机处丢弃
```

**③ 重复相同测试，再查看统计：**

```shell
h1 ping -c 10 -i 0.2 -W 1 10.0.0.2
sh ovs-ofctl -O OpenFlow13 meter-stats s1
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

```shell
mininet> sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=10,icmp,in_port=1,nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0,actions=meter:1,CONTROLLER:128"
OFPT_ERROR (OF1.3) (xid=0x6): OFPMMFC_INVALID_METER
OFPT_FLOW_MOD (OF1.3) (xid=0x6): ADD priority=10,icmp,in_port="s1-eth1",nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0 actions=meter:1,CONTROLLER:128
mininet> h1 ping -c 10 -i 0.2 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=2.71 ms
64 bytes from 10.0.0.2: icmp_seq=2 ttl=64 time=1.61 ms
64 bytes from 10.0.0.2: icmp_seq=3 ttl=64 time=1.65 ms
64 bytes from 10.0.0.2: icmp_seq=4 ttl=64 time=0.470 ms
64 bytes from 10.0.0.2: icmp_seq=5 ttl=64 time=0.393 ms
64 bytes from 10.0.0.2: icmp_seq=6 ttl=64 time=0.595 ms
64 bytes from 10.0.0.2: icmp_seq=7 ttl=64 time=0.429 ms
64 bytes from 10.0.0.2: icmp_seq=8 ttl=64 time=0.392 ms
64 bytes from 10.0.0.2: icmp_seq=9 ttl=64 time=0.380 ms
64 bytes from 10.0.0.2: icmp_seq=10 ttl=64 time=1.28 ms
--- 10.0.0.2 ping statistics ---
10 packets transmitted, 10 received, 0% packet loss, time 1846ms
rtt min/avg/max/mdev = 0.380/0.990/2.708/0.753 ms
mininet> sh ovs-ofctl -O OpenFlow13 meter-stats s1
OFPST_METER reply (OF1.3) (xid=0x2):
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=377.418s, table=0, n_packets=62, n_bytes=5652, priority=0 actions=CONTROLLER:128
```

原因明确了：**交换机中没有可用的 meter 1，因此引用它的规则被拒绝了。**

证据是：

- `OFPMMFC_INVALID_METER`：引用的 meter 无效。
- `meter-stats` 为空。
- 流表仍只有原来的兜底上送规则。

所以刚才 **10 次 ping 全成功，不能视为限速后的结果**。

现在先单独创建限速器：

```
sh ovs-ofctl -O OpenFlow13 add-meter s1 "meter=1,pktps,burst,stats,bands=type=drop,rate=1,burst_size=1"
```

然后检查它是否真正存在：

```
sh ovs-ofctl -O OpenFlow13 dump-meters s1
```

```shell
mininet> h1 ping -c 10 -i 0.2 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
--- 10.0.0.2 ping statistics ---
10 packets transmitted, 0 received, 100% packet loss, time 1868ms
mininet> sh ovs-ofctl -O OpenFlow13 meter-stats s1
OFPST_METER reply (OF1.3) (xid=0x2):
meter:1 flow_count:1 packet_in_count:10 byte_in_count:980 duration:75.406s bands:
0: packet_count:8 byte_count:784
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=22.141s, table=0, n_packets=10, n_bytes=980, priority=10,icmp,in_port="s1-eth1",nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0 actions=meter:1,CONTROLLER:128
 cookie=0x0, duration=769.960s, table=0, n_packets=64, n_bytes=5792, priority=0 actions=CONTROLLER:128
```

限速器生效了，但**当前结果还不能解释为“限速丢掉了全部请求”**：

| 统计                      | 数量 |
| ------------------------- | ---- |
| 进入 meter 的请求         | 10   |
| 被 meter 的丢弃 band 丢弃 | 8    |
| 没被这个 band 丢弃        | 2    |
| ping 收到的回复           | 0    |

注意，meter 的 `packet_in_count` 指**进入限速器的包数**，不是控制器收到的 Packet-In 数量。

另外两个请求为什么也没有回复，需要继续查。我们新增的显式上送规则可能改变了 Packet-In 的原因字段，导致测试控制器没有按之前的方式处理；目前只是待验证原因。

先不重复 ping，在 `mininet>` 执行：

```shell
sh grep -nE 'OFPT_PACKET_IN.*total_len=98|OFPT_PACKET_OUT.*data_len=98' /tmp/sdn-controller-meter.log | tail -n 12
```

日志证实：**另外 2 个请求已上报控制器，但没有对应的 Packet-Out**。它们标为 `via action`，而之前正常处理的是 `via no_match`。

我之前的上送写法引入了额外的兼容性变量，需修正后重测，不能把这次 100% 失败都归因于限速。

保持 meter 不变，只修改这条规则的上报原因：

```shell
sh ovs-ofctl -O OpenFlow13 --strict mod-flows s1 "table=0,priority=10,icmp,in_port=1,nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0,actions=meter:1,controller(reason=no_match,max_len=128)"
```

这是 OVS 支持的显式原因设置，用于本次测试控制器的兼容性对照。**标签写成 `no_match`，不代表这条规则没有匹配成功。**[OVS 官方说明](https://docs.openvswitch.org/en/latest/ref/ovs-actions.7/)

逐条执行：

```shell
sh ovs-ofctl -O OpenFlow13 meter-stats s1
h1 ping -c 10 -i 0.2 -W 1 10.0.0.2
sh ovs-ofctl -O OpenFlow13 meter-stats s1
```

```shell
mininet> sh ovs-ofctl -O OpenFlow13 --strict mod-flows s1 "table=0,priority=10,icmp,in_port=1,nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0,actions=meter:1,controller(reason=no_match,max_len=128)"
mininet> sh ovs-ofctl -O OpenFlow13 meter-stats s1
OFPST_METER reply (OF1.3) (xid=0x2):
meter:1 flow_count:1 packet_in_count:10 byte_in_count:980 duration:1231.960s bands:
0: packet_count:8 byte_count:784
mininet> h1 ping -c 10 -i 0.2 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.999 ms
64 bytes from 10.0.0.2: icmp_seq=6 ttl=64 time=1.51 ms
--- 10.0.0.2 ping statistics ---
10 packets transmitted, 2 received, 80% packet loss, time 1850ms
rtt min/avg/max/mdev = 0.999/1.256/1.514/0.257 ms
mininet> sh ovs-ofctl -O OpenFlow13 meter-stats s1
OFPST_METER reply (OF1.3) (xid=0x2):
meter:1 flow_count:1 packet_in_count:20 byte_in_count:1960 duration:1247.131s bands:
0: packet_count:16 byte_count:1568
```

**这轮限速结果与统计一致了：**

| 本轮统计      | 计算      | 结果      |
| ------------- | --------- | --------- |
| 进入 meter    | `20 − 10` | 10 个请求 |
| 被 meter 丢弃 | `16 − 8`  | 8 个请求  |
| ping 收到回复 | —         | 2 个      |

这证明了一个实际代价：**限制上报数量时，正常的 ping 请求也可能被丢弃。**本次没有测控制器过载，因此还不能声称验证了过载保护效果。

最后恢复配置。在 `mininet>` 下逐条执行：

**① 只删除本实验的限速规则：**

```shell
sh ovs-ofctl -O OpenFlow13 --strict del-flows s1 "table=0,priority=10,icmp,in_port=1,nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0"
```

**② 删除 meter 1：**

```shell
sh ovs-ofctl -O OpenFlow13 del-meters s1 "meter=1"
```

**③ 复测并检查配置：**

```shell
h1 ping -c 10 -i 0.2 -W 1 10.0.0.2
sh ovs-ofctl -O OpenFlow13 dump-meters s1
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

```shell
mininet> sh ovs-ofctl -O OpenFlow13 --strict del-flows s1 "table=0,priority=10,icmp,in_port=1,nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0"
mininet> sh ovs-ofctl -O OpenFlow13 del-meters s1 "meter=1"
mininet> h1 ping -c 10 -i 0.2 -W 1 10.0.0.2
PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=0.811 ms
64 bytes from 10.0.0.2: icmp_seq=2 ttl=64 time=1.74 ms
64 bytes from 10.0.0.2: icmp_seq=3 ttl=64 time=1.03 ms
64 bytes from 10.0.0.2: icmp_seq=4 ttl=64 time=0.467 ms
64 bytes from 10.0.0.2: icmp_seq=5 ttl=64 time=1.43 ms
64 bytes from 10.0.0.2: icmp_seq=6 ttl=64 time=1.80 ms
64 bytes from 10.0.0.2: icmp_seq=7 ttl=64 time=0.820 ms
64 bytes from 10.0.0.2: icmp_seq=8 ttl=64 time=1.69 ms
64 bytes from 10.0.0.2: icmp_seq=9 ttl=64 time=0.983 ms
64 bytes from 10.0.0.2: icmp_seq=10 ttl=64 time=0.966 ms

--- 10.0.0.2 ping statistics ---
10 packets transmitted, 10 received, 0% packet loss, time 1819ms
rtt min/avg/max/mdev = 0.467/1.173/1.803/0.435 ms
mininet> sh ovs-ofctl -O OpenFlow13 dump-meters s1
OFPST_METER_CONFIG reply (OF1.3) (xid=0x2):
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
 cookie=0x0, duration=2203.837s, table=0, n_packets=89, n_bytes=8158, priority=0 actions=CONTROLLER:128
```

最后一组结果是：

| 状态     | ping 回复                 |
| -------- | ------------------------- |
| 未限速   | 10/10                     |
| 限速生效 | 2/10，meter 丢弃 8 个请求 |
| 移除限速 | 10/10                     |

你也确认了 meter 为空、限速规则消失，配置恢复完成。

h1 **仍然发送了 10 个请求**，发送方式没有改变。

交换机的 meter 丢弃了 8 个，只有 2 个获准上送控制器。

因此，**控制器收到的请求减少了，但正常通信也损失了 8 次请求**。

### 实验代码总结

**1. 先分清命令在哪执行**

```shell
h1 ping ...
sh ovs-ofctl ...
```

| 开头       | 含义                            |
| ---------- | ------------------------------- |
| `h1`       | 让虚拟主机 h1 执行后面的命令    |
| `sh`       | 在承载 Mininet 的 Ubuntu 中执行 |
| `mininet>` | 提示符，不需要输入              |

`ovs-ofctl` 是通过 OpenFlow 管理交换机的命令行工具。例如：

```
sh ovs-ofctl -O OpenFlow13 dump-flows s1
```

拆开就是：

```
sh                  在 Ubuntu 中执行
ovs-ofctl           使用 OpenFlow 管理工具
-O OpenFlow13       使用 OpenFlow 1.3
dump-flows          查看流表
s1                  操作的交换机
```

**2. 创建 meter：规定怎样限速**

```shell
sh ovs-ofctl -O OpenFlow13 add-meter s1 "meter=1,pktps,burst,stats,bands=type=drop,rate=1,burst_size=1"
```

引号把整段配置作为一个参数交给程序。里面各项是：

| 配置              | 意思                  |
| ----------------- | --------------------- |
| `add-meter s1`    | 在 s1 上创建限速器    |
| `meter=1`         | 限速器编号为 1        |
| `pktps`           | 按包/秒计量           |
| `burst`           | 允许一定突发量        |
| `stats`           | 开启统计              |
| `bands=type=drop` | 超额时采取丢弃处理    |
| `rate=1`          | 设定速率为每秒 1 个包 |
| `burst_size=1`    | 突发额度为 1 个包     |

它不是“每个自然秒必定放行恰好一个包”。短时间内放行多少，还受到包的到达时刻和突发额度影响。

**创建 meter 本身不会让所有流量自动限速**，还需要流规则引用它。

**3. 添加规则：规定哪些包经过 meter**

我们最终使用的规则是：

```shell
sh ovs-ofctl -O OpenFlow13 add-flow s1 "priority=10,icmp,in_port=1,nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0,actions=meter:1,controller(reason=no_match,max_len=128)"
```

前半部分都是匹配条件：

| 字段                      | 意思                                     |
| ------------------------- | ---------------------------------------- |
| `priority=10`             | 优先级为 10，高于原来优先级 0 的兜底规则 |
| `icmp`                    | 匹配 ICMP 数据                           |
| `in_port=1`               | 从 s1 的端口 1 进入                      |
| `nw_src=10.0.0.1`         | 源 IP 为 h1                              |
| `nw_dst=10.0.0.2`         | 目的 IP 为 h2                            |
| `icmp_type=8,icmp_code=0` | ICMP 回显请求，也就是 ping 请求          |

这些条件需要**同时满足**。

后面的动作是：

```shell
actions=meter:1,controller(...)
```

处理顺序为：

```
匹配成功
   ↓
经过 meter 1
   ├─ 超额：丢弃
   └─ 允许：上送控制器
```

`reason=no_match` 是我们为兼容测试控制器而显式设置的上报原因标签，**不代表这条规则真的没有匹配成功**。

`max_len=128` 也不是端口号或限速值。它是上报长度参数；但 OVS 2.7 之后不再按它截短上报，所以不能把它理解成你当前版本实际生效的 128 字节限制。[OVS 动作说明](https://docs.openvswitch.org/en/latest/ref/ovs-actions.7/)

**4. ping 的输入与输出**

```shell
h1 ping -c 10 -i 0.2 -W 1 10.0.0.2
```

| 参数       | 意思                             |
| ---------- | -------------------------------- |
| `-c 10`    | 发送 10 个请求                   |
| `-i 0.2`   | 相邻请求间隔 0.2 秒，约每秒 5 个 |
| `-W 1`     | 设置等待回复的超时参数           |
| `10.0.0.2` | 目标 IP                          |

你的限速结果是：

```
10 packets transmitted, 2 received, 80% packet loss
```

即：发送了 10 次请求，收到 2 个回复，8 次没有收到回复。

```shell
icmp_seq=6 ... time=1.51 ms
```

表示收到了第 6 次请求的回复，这一次往返用时约 1.51 毫秒。

**5. meter 输出怎样读**

```
meter:1 flow_count:1 packet_in_count:20 byte_in_count:1960
bands:
0: packet_count:16 byte_count:1568
```

| 字段                      | 意思                                 |
| ------------------------- | ------------------------------------ |
| `meter:1`                 | 当前查看 meter 1                     |
| `flow_count:1`            | 有 1 条流规则引用它                  |
| `packet_in_count:20`      | 累计有 20 个包进入 meter             |
| `byte_in_count:1960`      | 这些包合计 1960 字节                 |
| band 的 `packet_count:16` | 本实验的丢弃 band 累计丢弃了 16 个包 |

**这里的 `packet_in_count` 不是控制器的 Packet-In 消息数量。**

因为计数会累计，我们要做减法：

```
本轮进入：20 − 10 = 10
本轮丢弃：16 − 8 = 8
```

所以本轮有 2 个请求没有被 meter 丢弃，与收到 2 个回复相符。

**6. 删除配置，为什么分两步**

```shell
sh ovs-ofctl -O OpenFlow13 --strict del-flows s1 "table=0,priority=10,icmp,in_port=1,nw_src=10.0.0.1,nw_dst=10.0.0.2,icmp_type=8,icmp_code=0"
```

它先删除**引用 meter 的那条规则**。`--strict` 要求严格匹配指定条件与优先级，避免把其他规则一起删除。

然后：

```shell
sh ovs-ofctl -O OpenFlow13 del-meters s1 "meter=1"
```

删除 meter 本身。

最后 `dump-meters` 只显示标题，没有配置；`dump-flows` 只剩兜底规则，ping 恢复 10 发 10 收，就完成了恢复验证。

之前日志命令里的符号也可以这样记：

| 符号       | 作用                               |
| ---------- | ---------------------------------- |
| `>`        | 输出写入文件，覆盖原内容           |
| `>>`       | 输出追加到文件末尾                 |
| `2>&1`     | 错误、诊断信息也写到标准输出的目标 |
| `|`        | 把前一个命令的输出交给后一个命令   |
| 末尾的 `&` | 在后台运行                         |

**流规则，就是交换机流表里的一条“什么数据适用、适用后怎么处理”的记录。**我们之前学过的“匹配条件 → 动作”，就是它的核心。

你已经亲手添加过这一条：

```
priority=100,dl_dst=00:00:00:00:00:02 actions=output:2
```

翻译成人话是：

> 如果帧的目的 MAC 是 h2，就从交换机端口 2 发出去；这条规则的优先级是 100。

一条规则可以拆成：

| 部分     | 回答的问题             | 这个例子       |
| -------- | ---------------------- | -------------- |
| 匹配条件 | 哪些帧适用？           | 目的 MAC 是 h2 |
| 优先级   | 多条规则都适用时选谁？ | 100            |
| 动作     | 选中后怎样处理？       | 从端口 2 发出  |
| 计数器   | 有多少包命中过它？     | `n_packets`    |

**“流表”是一张表，“流规则”是表中的一条记录。**一个规则也可以匹配很多包，不是每个包都要建立一条规则。

回到刚才的限速规则，它的意思是：

```
符合条件的 h1→h2 ping 请求
          ↓
命中这条规则，规则计数增加
          ↓
执行动作：先经过 meter
          ├─ 8 个超额，被丢弃
          └─ 2 个获准上报控制器
```

因此，**`n_packets=10` 表示 10 个包匹配了规则，不表示 10 个包都转发成功。**匹配之后，动作仍然可以是丢弃或限速。
