# 能定位路径错误，但路径起点仍需巩固

在当前目录 /home/student、目标文件 /home/student/sdn/logs/controller.log 的场景中，用户正确判断 cat logs/controller.log 的失败来自路径不对，并提出切换目录和指定路径两种思路。但给出的 cd /sdn、cat ../logs/controller.log、cat /sdn/logs/controller.log 均未指向题设目标，显示根目录 /、相对目录以及上级目录 .. 的语义尚不稳定。后续以路径定位任务巩固，不重教 cd/ls/cat 的定义，也不将尚未验证的纠正效果记为掌握。
