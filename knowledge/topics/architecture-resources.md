---
sidebar_position: 18
title: 模型架构如何决定系统成本
description: 从线性层、Attention、KV Cache、MoE 和混合状态推导显存、计算与流量
---

# 模型架构如何决定系统成本

“有多少参数”只能回答权重存储问题，不能单独决定请求成本。真正进入容量规划的是：每一步做多少矩阵计算、读取多少权重、保留多少状态、并发请求如何共享这些资源。

## 1. 从矩阵尺寸开始

矩阵乘法 $C_{m\times n}=A_{m\times k}B_{k\times n}$ 约需 $2mkn$ 次浮点运算。权重矩阵若含 $kn$ 个元素、每元素 $b_W$ 字节，仅读取权重就是 $b_Wkn$。

线性投影可以比较两种极端：

| 场景 | 主要差异 |
|---|---|
| Prefill | 一次有较多 token 行，权重被更多行复用 |
| Decode | 每次通常只有一行或少量新行，权重读取更难摊薄 |

因此相同线性层在两个阶段可能呈现完全不同的瓶颈。不能只拿“总算力”估算 token/s。

## 2. Attention 与 KV 状态

 causal mask 下，$P$ 个已有 token、$S$ 个新 token 的查询—键配对数为：

$$N_{pair}=B\left(PS+\frac{P(P+1)}2\right)$$

这让 Attention 的计算与状态访问随上下文增长，而线性投影只随新 token 数线性增长。Prefill 长、decode 长时，瓶颈会转移。

每层每个 token 的 KV Cache 大小为：

$$c_{KV}=2Ln_{KV}d_hb_{KV}$$

其中 2 表示 K/V，$L$ 为层数，$n_{KV}$ 为 KV 头数，$d_h$ 为头维，$b_{KV}$ 为字节数。

以 Qwen3-8B 的配置为例：36 层、8 个 KV 头、头维 128、BF16，得到每 token 约 144 KiB，单请求 8K 上下文约 1.125 GiB。权重约 16 GB 只发生一次，状态却乘上活跃请求数。

更隐蔽的是累计流量。连续 decode $n_d$ 步时，反复读取旧 KV 的总量近似：

$$R_{old}=c_{KV}\left(n_dH+\frac{n_d(n_d-1)}2\right)$$

书稿示例中最终只存约 1.27 GiB KV，但生成过程累计读取旧 KV 约 1224 GiB。**显存里放得下，不等于带宽扛得住。**

## 3. 架构变体改变了什么

- MHA：每个查询头独立 KV，并行表达强，状态最大。
- GQA/MQA：多个查询头共享 KV，直接降低容量和旧状态读取，但可能影响表达能力。
- MLA：缓存低维潜变量，把部分上投影移到查询侧；不能只比较“每 token 字节数”，还要检查上投影能否高效吸收进矩阵计算。
- Sliding Window：旧上下文只保留有限窗口，长生成的累计读取可近似线性而非平方增长。
- 线性 Attention/SSM：递推状态固定，但预填充、分块扫描、状态精度和并行训练方式不同。
- 混合模型：既有固定递推状态，也有窗口或全局 Attention 状态，总成本不能只用单一 $H$ 次幂表示。

若固定状态为 $M_{fixed}$，随上下文增长的状态为 $c_{state}H$：

$$M_{state}(H)=M_{fixed}+c_{state}H$$

混合架构常同时改善某些渐近项、保留某些局部二次项。容量模型要逐项列出，而不是贴“线性模型”标签。

## 4. MoE：激活少不代表权重读取少

若每步有 $N_e$ 个活跃专家、每个专家矩阵规模 $B\times k_{top}$，计算约为：

$$F_{expert}=2N_eBk_{top}$$

但权重读取取决于本步实际访问的不同专家数 $U$：

$$R_{expert}=b_WN_eU$$

同一批 token 若集中到少数专家，可复用权重；若均匀散布到大量专家，计算量相近，权重读取却显著增加。书稿比较集中路由与均匀路由时，相同计算量下权重读取可相差约 32 倍。

路由因此同时影响：

- 每步访问的专家集合和权重流量；
- 各卡负载是否均衡；
- 热门专家是否形成排队；
- all-to-all 传输量；
- 权重能否按专家并行驻留。

## 5. 并发容量

在只考虑主要驻留项时，请求上限近似：

$$B_{max}=\left\lfloor\frac{M_{device}-M_{weight}-M_{workspace}}{M_{state/request}}\right\rfloor$$

实际还要扣除通信缓冲、CUDA Graph、碎片、预留块和临时激活。权重共享使多请求摊薄权重，但 KV 随活跃序列增长；MoE 还可能出现按路由临时加载。

## 6. 推测解码不是免费加速

设 draft 平均耗时 $T_s$、target 验证耗时 $T_v$、普通 decode 一步耗时 $T_d$，每轮平均接受并产出 $\bar g$ 个有效输出，则值得使用的必要条件为：

$$\bar g>\frac{T_s+T_v}{T_d}$$

低接受率、过长 draft、验证 batch 效率差都可能让推测解码更慢。还要考虑额外权重驻留、draft KV 和调度复杂度。

## 7. 选型时问六个问题

1. 权重、固定状态和随上下文状态分别多少？
2. Prefill 和 decode 各自读多少数据、做多少计算？
3. 目标上下文与并发下，KV 是否比权重更先成为瓶颈？
4. MoE 路由实际访问多少专家，流量是否均衡？
5. 量化、共享 KV、滑窗等优化牺牲了什么模型能力或精度？
6. 优化是否改变用户真正关心的 TTFT、TPOT 和吞吐？

## 来源

- [AI Infra Book：第2章 模型架构](https://raw.githubusercontent.com/bojieli/ai-infra-book/main/manuscripts/02-%E6%A8%A1%E5%9E%8B%E6%9E%B6%E6%9E%84.md)

## 继续阅读

- [大模型推理系统全景](/docs/topics/inference-serving)
- [负载、排队与 SLO](/docs/topics/workload-slo)
- [加速器、存储层级与 Roofline](/docs/topics/accelerator-hierarchy)
- [大模型基础设施课程](/docs/courses/ai-infra)
