---
sidebar_position: 21
title: 算子、编译与运行时优化
description: GEMM 分块、融合、FlashAttention、CUDA Graph、动态形状与关键路径
---

# 算子、编译与运行时优化

局部 kernel 优化要回答两个问题：它为什么快，以及它是否位于请求关键路径。前者需要理解数据复用与硬件，后者需要端到端轨迹。

## 1. GEMM 分块：复用与驻留的权衡

对 $C_{M\times N}=A_{M\times K}B_{K\times N}$ 做 $m\times n$ 输出 tile、深度 $k$ 分块，一种理想化读写量为：

$$V=2MK\frac{N}{n}+2KN\frac{M}{m}+2MN$$

局部存储需求近似：

$$S=2mk+2kn+4mn$$

具体系数随数据类型、累加器、双缓冲和布局改变，但核心权衡不变：更大 tile 减少重读，却增加工作集、减少可驻留块数，并可能降低内存级并行和 occupancy。

最优 tile 不是越大越好，而是在数据流量、寄存器/shared memory、并发块和尾块浪费之间选择。

## 2. 并行访问与归约

- Bank conflict：多个线程同时访问同一 bank 的不同地址，会串行化；padding 或 swizzle 可改变映射。
- Coalescing：线程访问连续地址更容易合并事务，但布局改变可能影响后续计算。
- Warp 归约：减少同步和 shared memory 使用，但实现依赖 warp 宽度与数据类型。
- 拆分归约：提高并行度，同时增加临时结果、二次归约和通信；还会改变浮点舍入顺序。

数值可复现性不能只靠“同一公式”。并行顺序、原子累加、归约树和融合位置都会影响低位结果。

## 3. 算子融合主要节省数据移动

例如连续执行多个逐元素变换，朴素实现每个算子都写回再读取中间张量。融合后可在一个 kernel 内完成，降低：

- 中间张量分配与显存峰值；
- DRAM/L2 读写；
- kernel launch 和同步；
- 框架 dispatcher 开销。

书稿一个激活链示例将中间流量从约 120 MiB 降至 72 MiB。但融合不保证更快：寄存器压力、occupancy、并行度和代码大小都可能变差。

融合还必须保留归约依赖、量化 scale、累加精度和舍入语义。把数学上等价的表达式直接合并，未必数值等价。

## 4. FlashAttention：改变中间状态

标准 Attention 若显式保存完整分数和概率矩阵，会产生大量中间存储与读写。FlashAttention 分块计算，并维护在线 Softmax 状态 $(m,\ell,u)$：

- $m$：目前看到的最大值；
- $\ell$： rescale 后的归一化累加；
- $u$：未归一化的输出累加。

加入新块时更新最大值并缩放旧累加，从而无需保存完整概率矩阵。收益来自减少中间张量与提高数据复用，不是减少 Attention 的基本数学配对。

书稿配套实测中，特定 case 约有 33 倍加速，新增显存峰值由约 848 MiB 降至约 22 MiB。数字依赖输入形状和实现，不能直接套到所有模型。

## 5. 编译器分离“算什么”和“怎么算”

AKG/isl、Halide/TVM、TileLang 等系统都在不同程度上分离：

- 计算表达式：数学语义和依赖；
- schedule：循环顺序、分块、并行、向量化、存储位置；
- target lowering：映射到具体指令、内存和同步原语。

自动搜索可以在候选 schedule 中实测，但搜索空间、成本模型和编译时间本身也是工程约束。动态 shape 下还要决定：通用 kernel、按 shape 分桶，还是对热点形状特化。

选择依据包括调用频率、形状分布、编译准备成本、代码缓存大小和峰值性能收益。

## 6. CUDA Graph 与 persistent kernel

CUDA Graph 将已构建的执行图重复提交，减少主机 launch 和依赖准备开销，但：

- 不减少图中 kernel 数；
- 输入地址和形状需要满足图捕获约束；
- 每轮复制输入到固定缓冲区可能抵消收益；
- 动态控制流和内存分配需要特殊处理。

Persistent kernel 让线程块常驻并循环领取工作，减少启动和按块等待，也可在设备内调度。但它不能消除数据依赖；任务窃取、全局同步和工作队列也有成本。

## 7. 回到端到端关键路径

书稿综合案例中，某些单算子获得显著加速，最终请求只缩短约 1.3 ms，约 0.16%。原因可能包括：

- 算子本身只占很少时间；
- 优化与通信/其他 kernel 重叠，未处关键路径；
- 主机和框架开销主导；
- 请求进入排队，局部提速被等待掩盖。

正确流程是：端到端 profile -> 找关键路径 -> 建立资源下界 -> 优化并验证数值 -> 重测完整请求。不要从“这个算子能加速多少倍”直接推导“服务能快多少倍”。

## 来源

- [AI Infra Book：第5章 算子与运行时](https://raw.githubusercontent.com/bojieli/ai-infra-book/main/manuscripts/05-%E7%AE%97%E5%AD%90%E4%B8%8E%E8%BF%90%E8%A1%8C%E6%97%B6.md)

## 继续阅读

- [加速器、存储层级与 Roofline](/docs/topics/accelerator-hierarchy)
- [大模型推理系统全景](/docs/topics/inference-serving)
- [服务、训练与 RL 系统](/docs/topics/serving-training-systems)
