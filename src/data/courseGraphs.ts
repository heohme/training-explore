import type { FlowEvent, LocaleText, NodeKind, Phase, TopoEdge, TopoNode } from '../types';

const t = (zh: string, en: string): LocaleText => ({ zh, en });

interface FlowSpec {
  from: string;
  to: string;
  phase: Phase;
  info: LocaleText;
  size: string;
  packet: string;
  bend?: { x: number; y: number };
}

export interface CourseGraph {
  nodes: TopoNode[];
  flows: FlowSpec[];
  phaseLabels: Record<Phase, LocaleText>;
}

const n = (
  id: string,
  kind: NodeKind,
  x: number,
  y: number,
  zh: string,
  en: string,
  subZh: string,
  subEn: string,
): TopoNode => ({ id, kind, x, y, label: t(zh, en), sub: t(subZh, subEn) });

const f = (
  from: string,
  to: string,
  phase: Phase,
  zh: string,
  en: string,
  size: string,
  packet: string,
  bend?: { x: number; y: number },
): FlowSpec => ({ from, to, phase, info: t(zh, en), size, packet, bend });

const labels = (data: LocaleText, forward: LocaleText, loss: LocaleText, backward: LocaleText, update: LocaleText): Record<Phase, LocaleText> => ({
  data,
  forward,
  loss,
  backward,
  update,
});

const tokenizer: CourseGraph = {
  phaseLabels: labels(t('字节', 'Bytes'), t('合并', 'Merge'), t('编码', 'Encode'), t('嵌入', 'Embed'), t('验收', 'Validate')),
  nodes: [
    n('text', 'dataset', 65, 215, '原始语料', 'Raw corpus', '中文、代码、多语言', 'Chinese, code, multilingual'),
    n('bytes', 'cpu', 225, 110, '规范化与字节', 'Normalize & bytes', 'UTF-8 可逆表示', 'Reversible UTF-8'),
    n('bpe', 'autograd', 420, 110, 'BPE 合并器', 'BPE merge learner', '有序 merge 规则', 'Ordered merge rules'),
    n('ids', 'cpu', 420, 320, 'Token IDs', 'Token IDs', '[B, T] int64', '[B, T] int64'),
    n('embedding', 'gpu', 625, 320, '嵌入矩阵', 'Embedding matrix', 'E[V, d]', 'E[V, d]'),
    n('hidden', 'gpu', 805, 215, '隐藏状态', 'Hidden states', '[B, T, d]', '[B, T, d]'),
    n('cost', 'loss', 625, 95, '长度与成本', 'Length & cost', 'token 分布与 KV', 'Token distribution & KV'),
  ],
  flows: [
    f('text', 'bytes', 'data', '规范化文本并展开为 UTF-8 字节', 'Normalize text and expand into UTF-8 bytes', 'L chars -> B bytes', 'B'),
    f('bytes', 'bpe', 'data', '字节序列进入预分词与合并器', 'Byte sequence enters pre-tokenization and merging', 'B byte symbols', '01'),
    f('bpe', 'bpe', 'forward', '统计相邻对并生成有序 merge 表', 'Count adjacent pairs and produce ordered merge rules', 'V0 + learned merges', 'M'),
    f('bpe', 'ids', 'loss', '按训练所得规则把文本编码成 ID', 'Encode text into IDs using the trained rules', '[B, T] IDs', 'ID'),
    f('ids', 'embedding', 'backward', '按 token ID 从嵌入矩阵取行', 'Select embedding rows by token ID', 'T lookups', 'E'),
    f('embedding', 'hidden', 'backward', '组装连续向量作为 Transformer 输入', 'Assemble continuous vectors as Transformer input', '[B,T] -> [B,T,d]', 'H'),
    f('ids', 'cost', 'update', '统计业务语料的序列长度和长尾', 'Measure sequence lengths and tails on workload text', 'p50 / p95 tokens', 'T', { x: 510, y: 220 }),
    f('hidden', 'cost', 'update', '将 token 数映射到 Attention 与 KV 成本', 'Map token count to attention and KV cost', 'T -> compute + KV', 'C'),
  ],
};

const attention: CourseGraph = {
  phaseLabels: labels(t('表示', 'Represent'), t('变换', 'Transform'), t('归一化', 'Normalize'), t('聚合', 'Aggregate'), t('写回', 'Write back')),
  nodes: [
    n('tokens', 'dataset', 55, 215, 'Token 与位置', 'Tokens & positions', '[B,T] -> [B,T,d]', '[B,T] -> [B,T,d]'),
    n('norm', 'cpu', 205, 100, 'Pre-RMSNorm', 'Pre-RMSNorm', '逐 token 通道归一化', 'Per-token channel normalization'),
    n('qkv', 'gpu', 350, 100, 'QKV + RoPE', 'QKV + RoPE', '投影、拆头与旋转', 'Projection, heads and rotation'),
    n('attention', 'gpu', 500, 100, 'Causal Attention', 'Causal Attention', 'QK^T、mask、Softmax、AV', 'QK^T, mask, softmax and AV'),
    n('residual', 'autograd', 650, 100, '输出投影与残差', 'Output projection & residual', 'H1 = H0 + C Wo', 'H1 = H0 + C Wo'),
    n('ffn', 'gpu', 500, 320, 'GELU FFN 与残差', 'GELU FFN & residual', 'd -> d_ff -> d', 'd -> d_ff -> d'),
    n('logits', 'loss', 800, 215, 'Logits 与交叉熵', 'Logits & cross-entropy', '下一 token 分布与 CE', 'Next-token distribution and CE'),
  ],
  flows: [
    f('tokens', 'tokens', 'data', '按 Token ID 从嵌入矩阵逐行取向量', 'Select embedding rows by token ID', '[4] IDs -> X [4,4]', 'E'),
    f('tokens', 'norm', 'data', '加入位置嵌入，形成 Block 输入 H0', 'Add position embeddings to form block input H0', 'H0 = X + P', 'H0'),
    f('norm', 'qkv', 'forward', '对 H0 每个 token 的通道执行 RMSNorm', 'Apply RMSNorm over channels for every H0 token', 'H0 [4,4] -> N [4,4]', 'N'),
    f('qkv', 'qkv', 'forward', '计算 Q/K/V，拆成两个头并旋转 Q/K', 'Compute Q/K/V, split two heads and rotate Q/K', 'Q,K,V [1,2,4,2]', 'QKV'),
    f('qkv', 'attention', 'loss', '头 0 实算缩放点积并屏蔽未来位置', 'Compute scaled dot products and mask future positions in head 0', 'scores [4,4]', 'QK'),
    f('attention', 'attention', 'loss', '每行减最大值后 Softmax，验证行和为 1', 'Subtract row maxima, apply softmax and verify row sums', 'A [4,4], future=0', 'P'),
    f('attention', 'residual', 'backward', '两个头分别计算 A_h V_h 并拼接', 'Compute A_h V_h per head and concatenate', 'C [4,4]', 'AV'),
    f('residual', 'residual', 'update', '输出投影后与 H0 相加形成 H1', 'Project output and add H0 to form H1', 'H1 = H0 + C Wo', 'H1'),
    f('residual', 'ffn', 'forward', '第二次 RMSNorm 后扩展到 8 维并施加 GELU', 'Apply second RMSNorm, expand to eight channels and apply GELU', 'U [4,8]', 'FFN'),
    f('ffn', 'residual', 'update', 'FFN 投影回 4 维并与 H1 残差相加', 'Project FFN to four channels and add the H1 residual', 'H2 = H1 + U W2', 'H2'),
    f('residual', 'logits', 'forward', 'Final RMSNorm 后把最后位置投影到 6 词词表', 'Apply final RMSNorm and project the last position to six vocabulary logits', 'logits [1,6]', 'Z'),
    f('logits', 'logits', 'loss', 'Softmax 得到下一 Token 分布并计算目标交叉熵', 'Softmax produces next-token probabilities and target cross-entropy', 'p [1,6], CE scalar', 'CE'),
  ],
};

const backprop: CourseGraph = {
  phaseLabels: labels(t('建图', 'Graph'), t('链式法则', 'Chain rule'), t('数值校验', 'Gradcheck'), t('诊断', 'Diagnose'), t('应用', 'Apply')),
  nodes: [
    n('input', 'dataset', 65, 215, '输入与参数', 'Inputs & parameters', 'requires_grad=true', 'requires_grad=true'),
    n('forward', 'gpu', 230, 115, '前向计算图', 'Forward graph', '保存反向所需张量', 'Saved backward tensors'),
    n('loss', 'loss', 425, 80, '标量 Loss', 'Scalar loss', '反向起点为 1', 'Backward starts at one'),
    n('vjp', 'autograd', 425, 300, '反向拓扑序', 'Reverse topology', '逐节点向量雅可比积', 'Node-wise VJP'),
    n('grad', 'gpu', 615, 300, '参数梯度', 'Parameter gradients', '分支贡献累加', 'Accumulate branches'),
    n('check', 'cpu', 620, 90, '数值梯度校验', 'Numeric gradcheck', 'float64 中心差分', 'FP64 central difference'),
    n('update', 'optimizer', 810, 215, '诊断与更新', 'Diagnose & update', '范数、裁剪、optimizer', 'Norms, clip, optimizer'),
  ],
  flows: [
    f('input', 'forward', 'data', '执行算子并记录可微依赖', 'Execute operators and record differentiable dependencies', 'nodes + saved tensors', 'X'),
    f('forward', 'loss', 'data', '前向输出进入标量损失', 'Forward output enters scalar loss', 'L scalar', 'L'),
    f('loss', 'vjp', 'forward', '从 dL/dL=1 沿逆拓扑序启动反向', 'Start backward with dL/dL=1 in reverse topology', 'seed gradient 1', 'G'),
    f('vjp', 'grad', 'forward', '局部雅可比转置乘输出梯度并累加', 'Multiply transposed local Jacobians and accumulate', 'dL/dtheta', 'G'),
    f('input', 'check', 'loss', '对小输入做正负 eps 扰动', 'Perturb small inputs by plus and minus epsilon', 'f(x+/-eps)', 'EPS', { x: 390, y: 20 }),
    f('grad', 'check', 'loss', '解析梯度与中心差分逐项对照', 'Compare analytic gradients with central differences', 'abs/relative error', 'D'),
    f('grad', 'update', 'backward', '汇总每层梯度范数并检测非有限值', 'Aggregate per-layer norms and detect non-finite values', '||g|| per layer', 'N'),
    f('update', 'update', 'update', '按全局范数裁剪后交给优化器', 'Clip by global norm before optimizer update', 'min(1,tau/||g||)', 'C'),
  ],
};

const optimizer: CourseGraph = {
  phaseLabels: labels(t('梯度', 'Gradient'), t('动量', 'Moments'), t('修正', 'Correct'), t('调度', 'Schedule'), t('更新', 'Update')),
  nodes: [
    n('grad', 'autograd', 65, 215, '梯度 g_t', 'Gradient g_t', '来自反向传播', 'From backpropagation'),
    n('state', 'gpu', 225, 105, 'Adam 状态', 'Adam state', 'FP32 m / v', 'FP32 m / v'),
    n('correct', 'cpu', 410, 105, '偏差修正', 'Bias correction', 'm_hat / v_hat', 'm_hat / v_hat'),
    n('schedule', 'cpu', 410, 320, '学习率调度', 'LR schedule', 'warmup + cosine', 'warmup + cosine'),
    n('decay', 'autograd', 610, 320, '参数组与衰减', 'Groups & decay', 'AdamW 解耦 wd', 'Decoupled AdamW wd'),
    n('params', 'optimizer', 805, 215, '新参数', 'New parameters', 'theta_(t+1)', 'theta_(t+1)'),
  ],
  flows: [
    f('grad', 'state', 'data', '梯度进入一阶与二阶动量估计', 'Gradient enters first and second moment estimates', 'g_t', 'G'),
    f('state', 'state', 'data', '按 beta1/beta2 更新 m_t 与 v_t', 'Update m_t and v_t with beta1/beta2', '2N FP32 state', 'MV'),
    f('state', 'correct', 'forward', '按当前 step 做偏差修正', 'Apply bias correction for the current step', 'm_hat, v_hat', 'M'),
    f('correct', 'decay', 'forward', '生成逐坐标自适应更新方向', 'Form per-coordinate adaptive update direction', 'm_hat/(sqrt(v_hat)+eps)', 'A', { x: 510, y: 220 }),
    f('schedule', 'schedule', 'backward', '根据训练 progress 计算实际学习率', 'Compute realized learning rate from training progress', 'lr_t', 'LR'),
    f('schedule', 'decay', 'backward', '学习率与参数分组共同缩放更新', 'Scale update using LR and parameter groups', 'lr_t * update', 'LR'),
    f('decay', 'params', 'update', '应用自适应项和解耦 weight decay', 'Apply adaptive term and decoupled weight decay', 'theta_(t+1)', 'W'),
    f('params', 'grad', 'update', '新参数进入下一步前向与反向', 'New parameters enter the next forward/backward step', 'next training step', 'N', { x: 440, y: 405 }),
  ],
};

const distributed: CourseGraph = {
  phaseLabels: labels(t('切批', 'Shard batch'), t('本地计算', 'Local compute'), t('集通信', 'Collective'), t('分片', 'Shard'), t('下一步', 'Next step')),
  nodes: [
    n('batch', 'dataset', 65, 215, '全局 Batch', 'Global batch', '按 DP 维切分样本', 'Shard samples over DP'),
    n('rank0', 'gpu', 260, 100, 'GPU Rank 0', 'GPU rank 0', '本地前向与反向', 'Local forward/backward'),
    n('rank1', 'gpu', 260, 330, 'GPU Rank 1', 'GPU rank 1', '不同数据，相同图', 'Different data, same graph'),
    n('collective', 'autograd', 485, 215, 'NCCL 集通信', 'NCCL collective', 'AllReduce / AllGather', 'AllReduce / AllGather'),
    n('shard', 'cpu', 665, 105, 'FSDP 分片状态', 'FSDP sharded state', '参数、梯度、优化器', 'Parameters, grads, optimizer'),
    n('next', 'optimizer', 810, 310, '同步下一步', 'Synchronized next step', '等待最慢 rank', 'Wait for slowest rank'),
  ],
  flows: [
    f('batch', 'rank0', 'data', 'Rank 0 接收自己的数据分片', 'Rank 0 receives its data shard', 'B_global / p', 'D0'),
    f('batch', 'rank1', 'data', 'Rank 1 接收另一数据分片', 'Rank 1 receives another data shard', 'B_global / p', 'D1'),
    f('rank0', 'collective', 'forward', 'Rank 0 梯度 bucket 就绪后参与 AllReduce', 'Rank 0 joins AllReduce as gradient buckets become ready', 'local gradients 0', 'G0'),
    f('rank1', 'collective', 'forward', 'Rank 1 梯度与 Rank 0 求平均', 'Rank 1 gradients are averaged with rank 0', 'local gradients 1', 'G1'),
    f('collective', 'shard', 'loss', 'ReduceScatter 后各 rank 仅保留梯度分片', 'Each rank retains a gradient shard after ReduceScatter', 'N / DP per rank', 'S'),
    f('shard', 'rank0', 'backward', '计算当前层前 AllGather 参数分片', 'AllGather parameter shards before the current layer', 'transient full layer', 'P0', { x: 450, y: 35 }),
    f('shard', 'rank1', 'backward', '另一 rank 同步获得当前层完整参数', 'The other rank gathers the same full current layer', 'transient full layer', 'P1', { x: 470, y: 390 }),
    f('collective', 'next', 'update', '所有 rank 完成通信后进入一致的新步', 'All ranks enter a consistent next step after collectives', 'max(rank step time)', 'GO'),
  ],
};

const memory: CourseGraph = {
  phaseLabels: labels(t('驻留', 'Resident'), t('前向', 'Forward'), t('重算', 'Recompute'), t('回传', 'Backward'), t('迁移', 'Offload')),
  nodes: [
    n('model', 'dataset', 65, 215, '权重与 Batch', 'Weights & batch', '16N 持久状态估算', '16N persistent estimate'),
    n('forward', 'gpu', 225, 105, '混合精度前向', 'Mixed-precision forward', 'BF16 计算 / FP32 累加', 'BF16 compute / FP32 accum'),
    n('activation', 'dataset', 425, 90, '激活与 Checkpoint', 'Activations & checkpoint', '决定保存或重算', 'Save or recompute'),
    n('backward', 'autograd', 425, 320, '反向计算', 'Backward compute', '恢复激活并求梯度', 'Restore activations & differentiate'),
    n('optimizer', 'optimizer', 625, 320, '优化器状态', 'Optimizer state', 'FP32 master + m/v', 'FP32 master + m/v'),
    n('host', 'cpu', 625, 95, 'CPU / NVMe', 'CPU / NVMe', 'Offload 与预取', 'Offload & prefetch'),
    n('peak', 'loss', 810, 215, '峰值显存账本', 'Peak memory ledger', 'allocated + reserved', 'allocated + reserved'),
  ],
  flows: [
    f('model', 'forward', 'data', '加载 BF16 权重与输入批次', 'Load BF16 weights and input batch', 'weights + batch', 'W'),
    f('forward', 'activation', 'data', '前向保存反向所需激活或段边界', 'Save backward activations or segment boundaries', 'activation bytes', 'A'),
    f('activation', 'backward', 'forward', 'Checkpoint 段在反向时重新执行前向', 'Checkpointed segments rerun forward during backward', 'extra FLOPs', 'R'),
    f('forward', 'backward', 'forward', '输出梯度沿计算图进入反向', 'Output gradients enter backward along the graph', 'grad_output', 'G', { x: 300, y: 230 }),
    f('backward', 'optimizer', 'backward', '生成梯度并读取主权重和动量状态', 'Produce gradients and access master weights and moments', '16N persistent state', 'S'),
    f('optimizer', 'host', 'backward', '暂不使用的状态经 PCIe 移出设备', 'Move inactive state off device over PCIe', 'D2H bytes', 'D2H'),
    f('host', 'optimizer', 'update', '下一步前预取状态，暴露传输会拉长步时间', 'Prefetch state before next use; exposed transfer extends step', 'H2D + prefetch', 'H2D'),
    f('optimizer', 'peak', 'update', '将同时驻留状态、临时缓冲和保留池计入峰值', 'Account co-resident state, temporary buffers and reserved pool', 'peak GiB', 'M'),
  ],
};

const finetune: CourseGraph = {
  phaseLabels: labels(t('监督', 'SFT'), t('偏好', 'Preference'), t('目标', 'Objective'), t('约束', 'Constrain'), t('评测', 'Evaluate')),
  nodes: [
    n('data', 'dataset', 65, 215, '指令与偏好对', 'Instructions & preferences', 'prompt / chosen / rejected', 'prompt / chosen / rejected'),
    n('sft', 'gpu', 235, 105, 'SFT 策略', 'SFT policy', 'completion-only loss', 'completion-only loss'),
    n('reference', 'gpu', 235, 325, '冻结参考策略', 'Frozen reference policy', 'pi_ref 不更新', 'pi_ref stays frozen'),
    n('objective', 'autograd', 455, 215, 'DPO / RL 目标', 'DPO / RL objective', '偏好间隔或组内优势', 'Preference margin or group advantage'),
    n('policy', 'optimizer', 650, 105, '更新后策略', 'Updated policy', 'pi_theta', 'pi_theta'),
    n('eval', 'loss', 810, 315, '独立评测', 'Independent evaluation', 'held-out + 回归集', 'held-out + regression'),
  ],
  flows: [
    f('data', 'sft', 'data', '拼接指令与回答并构造标签', 'Concatenate instruction and response and build labels', 'input_ids + labels', 'SFT'),
    f('sft', 'sft', 'data', '只在 completion 位置计算监督损失', 'Compute supervised loss only at completion positions', 'masked CE', 'L'),
    f('sft', 'objective', 'forward', '当前策略计算 chosen/rejected 序列 logp', 'Policy computes chosen/rejected sequence logps', 'logp_theta(y|x)', 'PI'),
    f('reference', 'objective', 'forward', '参考策略提供同一回答的基准 logp', 'Reference provides baseline logps for identical responses', 'logp_ref(y|x)', 'REF'),
    f('objective', 'policy', 'loss', 'DPO 偏好间隔或 GRPO 优势驱动更新', 'DPO margins or GRPO advantages drive policy update', 'preference loss', 'DPO'),
    f('reference', 'policy', 'backward', 'KL 或参考比率约束策略漂移', 'KL or reference ratios constrain policy drift', 'KL(pi||pi_ref)', 'KL'),
    f('policy', 'eval', 'update', '在未参与调参的任务上评估行为变化', 'Evaluate behavior on tasks unused for tuning', 'held-out tasks', 'E'),
    f('eval', 'data', 'update', '失败样本进入分类与后续回归任务集', 'Failed cases enter taxonomy and future regression sets', 'failure cases', 'R', { x: 440, y: 405 }),
  ],
};

const trainingDebug: CourseGraph = {
  phaseLabels: labels(t('小样本', 'Tiny set'), t('前向', 'Forward'), t('异常', 'Anomaly'), t('反向', 'Backward'), t('归因', 'Attribute')),
  nodes: [
    n('data', 'dataset', 65, 215, '固定小数据集', 'Fixed tiny dataset', '固定 seed 与 8 条样本', 'Fixed seed and eight samples'),
    n('forward', 'gpu', 230, 105, '前向与 Loss', 'Forward & loss', '检查标签移位与 mask', 'Check label shift & mask'),
    n('grad', 'autograd', 425, 105, '分层梯度', 'Per-layer gradients', 'norm / zero / NaN', 'norm / zero / NaN'),
    n('optimizer', 'optimizer', 425, 320, '学习率与更新', 'LR & updates', 'lr / grad / update ratio', 'lr / grad / update ratio'),
    n('metrics', 'loss', 625, 320, '训练与验证曲线', 'Train & validation curves', '泛化差距与分类指标', 'Generalization & class metrics'),
    n('report', 'cpu', 805, 215, '诊断报告', 'Diagnostic report', '首个异常与复现证据', 'First anomaly & repro evidence'),
  ],
  flows: [
    f('data', 'forward', 'data', '固定样本反复进入同一训练闭环', 'Run fixed samples repeatedly through the same training loop', '8 samples', 'D'),
    f('forward', 'forward', 'data', '验证模型能否在小样本上显著过拟合', 'Verify the model can substantially overfit the tiny set', 'loss -> near zero', 'L'),
    f('forward', 'grad', 'forward', 'Loss 反向并记录每层梯度', 'Backpropagate loss and record per-layer gradients', 'dL/dtheta', 'G'),
    f('grad', 'optimizer', 'forward', '检查梯度尺度、实际 lr 与更新比例', 'Inspect gradient scale, realized LR and update ratio', '||g||, lr, ||update||', 'LR'),
    f('forward', 'report', 'loss', '记录首个非有限激活或损失及对应 batch', 'Record first non-finite activation or loss with its batch', 'first bad step/op', 'NaN', { x: 520, y: 45 }),
    f('grad', 'report', 'backward', 'NaN 或爆炸定位到首个异常层', 'Localize NaN or explosion to the first abnormal layer', 'per-layer evidence', 'G'),
    f('optimizer', 'metrics', 'backward', '扫描学习率并对照训练与验证表现', 'Sweep LR and compare training with validation behavior', 'loss(t), lr(t)', 'M'),
    f('metrics', 'report', 'update', '按数据、模型、优化器和泛化归因归档', 'Archive attribution across data, model, optimizer and generalization', 'repro + root cause', 'R'),
  ],
};

const agentLoop: CourseGraph = {
  phaseLabels: labels(t('观察', 'Observe'), t('决策', 'Decide'), t('工具', 'Tool'), t('回灌', 'Feedback'), t('终止', 'Finish')),
  nodes: [
    n('task', 'dataset', 65, 215, '用户任务', 'User task', '目标与约束', 'Goal & constraints'),
    n('llm', 'gpu', 250, 105, 'LLM 决策', 'LLM decision', '回答或结构化工具调用', 'Answer or structured tool call'),
    n('gate', 'cpu', 445, 90, '参数与权限闸门', 'Argument & permission gate', 'Schema + policy', 'Schema + policy'),
    n('tool', 'optimizer', 445, 320, '确定性工具', 'Deterministic tool', '超时、取消、幂等', 'Timeout, cancellation, idempotency'),
    n('observation', 'dataset', 635, 320, '工具观察', 'Tool observation', 'call_id + result/error', 'call_id + result/error'),
    n('answer', 'loss', 810, 105, '最终回答', 'Final answer', '带真实工具依据', 'Grounded in tool evidence'),
    n('trace', 'cpu', 810, 320, '完整 Trace', 'Complete trace', '状态、步骤与停止原因', 'State, steps & stop reason'),
  ],
  flows: [
    f('task', 'llm', 'data', '任务和当前观察进入模型上下文', 'Task and current observations enter model context', 'messages + step', 'IN'),
    f('llm', 'llm', 'forward', '模型选择最终回答或下一步工具', 'Model chooses a final answer or next tool', 'structured output', 'AI'),
    f('llm', 'gate', 'loss', 'Harness 校验工具名、参数与权限', 'Harness validates tool name, arguments and permissions', 'validated call', 'CALL'),
    f('gate', 'tool', 'loss', '只有获准的调用才进入确定性执行', 'Only authorized calls reach deterministic execution', 'bound arguments', 'RUN'),
    f('tool', 'observation', 'backward', '工具返回结果或结构化错误并关联 call_id', 'Tool returns result or structured error tied to call_id', 'observation', 'OBS'),
    f('observation', 'llm', 'backward', '观察追加到会话后再次调用模型', 'Append observation to session and call model again', 'state_(k+1)', 'LOOP', { x: 540, y: 180 }),
    f('llm', 'answer', 'update', '满足停止条件时生成有依据的回答', 'Produce grounded answer when a stopping condition is met', 'final answer', 'OUT'),
    f('answer', 'trace', 'update', '记录结局、步数、成本与停止原因', 'Record outcome, steps, cost and stop reason', 'trace + metrics', 'LOG'),
  ],
};

const harness: CourseGraph = {
  phaseLabels: labels(t('发现', 'Discover'), t('授权', 'Authorize'), t('执行', 'Execute'), t('上下文', 'Context'), t('恢复', 'Recover')),
  nodes: [
    n('loop', 'gpu', 65, 215, 'Agent Loop', 'Agent loop', '模型原生工具编排', 'Native model orchestration'),
    n('registry', 'cpu', 230, 100, 'Registry / MCP', 'Registry / MCP', '工具描述、来源与版本', 'Description, origin & version'),
    n('gate', 'autograd', 425, 100, '权限与审批', 'Permission & approval', '用户、范围、归属', 'Identity, scope, ownership'),
    n('runtime', 'optimizer', 425, 320, '工具运行时', 'Tool runtime', '确定性适配器', 'Deterministic adapters'),
    n('session', 'dataset', 625, 320, '会话与压缩', 'Session & compaction', '原始状态与模型视图', 'Raw state & model view'),
    n('trace', 'loss', 805, 215, 'Trace / 恢复点', 'Trace / recovery point', '关联 span 与提交状态', 'Correlated spans & commits'),
  ],
  flows: [
    f('loop', 'registry', 'data', '模型可见名称解析到具体工具适配器', 'Resolve model-visible name to a concrete tool adapter', 'schema + version', 'REG'),
    f('registry', 'gate', 'data', '本地与 MCP 工具都进入同一权限边界', 'Local and MCP tools enter the same permission boundary', 'tool policy', 'POL'),
    f('gate', 'runtime', 'forward', '审批后的精确参数被绑定执行', 'Exact approved arguments are bound for execution', 'authorized call', 'RUN'),
    f('runtime', 'session', 'forward', '工具结果和状态转换写入会话', 'Tool result and state transition are written to session', 'result + state', 'S'),
    f('session', 'loop', 'backward', '压缩后的模型视图保留约束与未完成调用', 'Compacted model view preserves constraints and pending calls', 'context <= budget', 'CTX', { x: 360, y: 390 }),
    f('runtime', 'trace', 'loss', '记录工具、权限、错误和副作用 span', 'Record tool, permission, error and side-effect spans', 'tool/audit spans', 'SPAN'),
    f('loop', 'trace', 'backward', '模型请求与消息版本进入关联轨迹', 'Model request and message version join correlated trace', 'model span', 'REQ', { x: 450, y: 45 }),
    f('trace', 'loop', 'update', '从已提交恢复点继续且不重复副作用', 'Resume from committed point without repeating side effects', 'resume state', 'RES', { x: 450, y: 405 }),
  ],
};

const evaluation: CourseGraph = {
  phaseLabels: labels(t('任务', 'Task'), t('运行', 'Run'), t('评分', 'Grade'), t('追踪', 'Trace'), t('发布', 'Release')),
  nodes: [
    n('tasks', 'dataset', 65, 215, '版本化任务集', 'Versioned task set', '正常、失败与对抗用例', 'Normal, failure & adversarial'),
    n('agent', 'gpu', 230, 105, 'Agent 运行', 'Agent run', '固定模型与 Harness 版本', 'Pinned model & harness'),
    n('environment', 'optimizer', 425, 105, '环境与工具结果', 'Environment & tool outcome', '真实副作用和状态', 'Real side effects & state'),
    n('grader', 'autograd', 425, 320, '独立评分器', 'Independent grader', '断言、rubric、人工校准', 'Assertions, rubric, calibrated review'),
    n('trace', 'cpu', 625, 105, 'Trace 归因', 'Trace attribution', '首个因果失败 span', 'First causal failed span'),
    n('release', 'loss', 805, 215, '回归与发布闸门', 'Regression & release gate', '质量、成本、安全', 'Quality, cost, safety'),
  ],
  flows: [
    f('tasks', 'agent', 'data', '加载任务输入、允许工具和初始环境', 'Load task input, allowed tools and initial environment', '20+ tasks', 'T'),
    f('agent', 'environment', 'data', '执行模型与工具并产生真实环境结果', 'Run model and tools to produce real environment outcomes', 'run trajectory', 'RUN'),
    f('environment', 'grader', 'forward', '用独立断言检查结果而非只看文字', 'Check outcomes with independent assertions, not text alone', 'pass/fail assertions', 'G'),
    f('agent', 'trace', 'loss', '记录模型、工具、状态、成本和延迟', 'Record model, tools, state, cost and latency', 'full trace', 'LOG', { x: 430, y: 40 }),
    f('trace', 'grader', 'backward', '将失败关联到具体因果 span 和类别', 'Link failures to concrete causal spans and classes', 'failure taxonomy', 'F'),
    f('tasks', 'grader', 'backward', '对抗任务验证权限拒绝与零未授权副作用', 'Adversarial tasks verify denial and zero unauthorized effects', 'security assertions', 'SEC', { x: 300, y: 395 }),
    f('grader', 'release', 'update', '成功率、成本和回归结果进入发布决定', 'Success, cost and regressions enter release decision', 'release report', 'R'),
    f('release', 'tasks', 'update', '新失败案例回流为固定回归任务', 'New failures become fixed regression tasks', 'versioned regression', 'REG', { x: 440, y: 410 }),
  ],
};

const inference: CourseGraph = {
  phaseLabels: labels(t('调度', 'Schedule'), t('预填充', 'Prefill'), t('KV 状态', 'KV state'), t('解码', 'Decode'), t('输出', 'Stream')),
  nodes: [
    n('requests', 'dataset', 65, 215, '到达请求', 'Arriving requests', '输入/输出长度与 SLO', 'Input/output lengths & SLO'),
    n('scheduler', 'cpu', 220, 105, '连续批调度器', 'Continuous batch scheduler', 'TTFT、TPOT、KV 块', 'TTFT, TPOT, KV blocks'),
    n('prefill', 'gpu', 410, 90, 'Prefill', 'Prefill', '并行处理输入前缀', 'Process input prefix together'),
    n('kv', 'dataset', 425, 320, '分页 KV Cache', 'Paged KV cache', '块表与前缀复用', 'Block table & prefix reuse'),
    n('decode', 'gpu', 625, 320, 'Decode / Target', 'Decode / target', '逐 token 或批量验证', 'Token steps or batch verify'),
    n('draft', 'autograd', 625, 90, 'Draft 模型', 'Draft model', '提出候选 token', 'Propose candidate tokens'),
    n('stream', 'loss', 810, 215, '流式输出', 'Streaming output', '接受 token 与指标', 'Accepted tokens & metrics'),
  ],
  flows: [
    f('requests', 'scheduler', 'data', '请求进入队列并记录输入长度与优先级', 'Requests enter queue with input length and priority', 'arrival process', 'Q'),
    f('scheduler', 'prefill', 'forward', '调度器分配 Prefill 或 Chunked Prefill 批次', 'Scheduler assigns prefill or chunked-prefill batch', 'P new tokens', 'P'),
    f('prefill', 'kv', 'loss', '初始前向生成各层 K/V 并写入物理块', 'Initial forward creates per-layer K/V in physical blocks', 'initial KV blocks', 'KV'),
    f('kv', 'decode', 'backward', 'Decode 每步读取可见历史 KV', 'Every decode step reads visible historical KV', 'old KV traffic', 'READ'),
    f('scheduler', 'decode', 'forward', '连续批在 token 步间接纳和退出请求', 'Continuous batching admits and retires requests per token step', 'active batch B', 'B', { x: 420, y: 225 }),
    f('decode', 'kv', 'backward', '新位置的 K/V 追加回分页缓存', 'Append new-position K/V back into paged cache', '2*L*n_kv*d_h per token', 'APP'),
    f('draft', 'decode', 'update', 'Target 一次前向验证 Draft 的多个候选', 'Target verifies several draft candidates in one forward', 'g candidates', 'SPEC', { x: 525, y: 170 }),
    f('decode', 'stream', 'update', '接受或常规生成的 token 立即流式返回', 'Accepted or regular tokens stream back immediately', 'TPOT + output tokens', 'OUT'),
  ],
};

const infraQuant: CourseGraph = {
  phaseLabels: labels(t('容量', 'Capacity'), t('计算', 'Compute'), t('流量', 'Traffic'), t('上界', 'Roofline'), t('校准', 'Calibrate')),
  nodes: [
    n('config', 'dataset', 65, 215, '模型与负载', 'Model & workload', 'N、T、B、精度', 'N, T, B, precision'),
    n('capacity', 'cpu', 225, 100, '容量账', 'Capacity ledger', '权重、状态、工作区', 'Weights, state, workspace'),
    n('compute', 'gpu', 420, 100, '计算账', 'Compute ledger', '矩阵 FLOPs', 'Matrix FLOPs'),
    n('traffic', 'autograd', 420, 320, '读取与通信账', 'Read & communication ledger', '权重、KV、网络字节', 'Weight, KV, network bytes'),
    n('roofline', 'loss', 625, 100, 'Roofline 下界', 'Roofline bound', 'I=F/R', 'I=F/R'),
    n('profile', 'cpu', 625, 320, '实测 Profile', 'Measured profile', 'kernel、链路、等待', 'Kernels, links, waits'),
    n('report', 'optimizer', 810, 215, '差距归因报告', 'Gap attribution report', '下界 + 实测证据', 'Bounds + measured evidence'),
  ],
  flows: [
    f('config', 'capacity', 'data', '按模型与并发逐项计算驻留字节', 'Compute resident bytes by model and concurrency', 'M_total <= M_cap', 'M'),
    f('capacity', 'report', 'data', '容量结果决定理论并发与是否可运行', 'Capacity determines theoretical concurrency and feasibility', 'B_max', 'B', { x: 520, y: 40 }),
    f('config', 'compute', 'forward', '按真实矩阵尺寸推导 FLOPs', 'Derive FLOPs from actual matrix dimensions', 'F FLOPs', 'F'),
    f('compute', 'traffic', 'loss', '将计算与权重、KV 的实际读取次数对齐', 'Align compute with actual weight and KV read counts', 'F and R', 'R'),
    f('compute', 'roofline', 'forward', '计算量进入算力时间下界 F/Pi', 'Compute enters the F/Pi time bound', 'F/Pi', 'P'),
    f('traffic', 'roofline', 'backward', '字节数进入带宽下界并形成算术强度', 'Bytes enter bandwidth bound and arithmetic intensity', 'R/beta, I=F/R', 'I'),
    f('profile', 'roofline', 'backward', '实测 kernel 与链路数据校准理论假设', 'Measured kernels and links calibrate theoretical assumptions', 'MFU / MBU', 'CAL', { x: 525, y: 215 }),
    f('profile', 'report', 'update', '将差距拆为计算、访存、通信、启动与排队', 'Attribute gap to compute, memory, communication, launch and queueing', 'bound vs measured', 'GAP'),
  ],
};

export const courseGraphs: Record<string, CourseGraph> = {
  tokenizer,
  attention,
  backprop,
  optimizer,
  distributed,
  memory,
  finetune,
  'training-debug': trainingDebug,
  'agent-loop': agentLoop,
  harness,
  eval: evaluation,
  'inference-serving': inference,
  'infra-quant': infraQuant,
};

export function graphForLesson(id: string): CourseGraph {
  const graph = courseGraphs[id];
  if (!graph) {
    throw new Error(`Missing semantic course graph: ${id}`);
  }
  return graph;
}

export function graphEdges(graph: CourseGraph): TopoEdge[] {
  const edges = new Map<string, TopoEdge>();
  for (const flow of graph.flows) {
    const id = `${flow.from}->${flow.to}`;
    if (!edges.has(id)) {
      edges.set(id, { id, from: flow.from, to: flow.to, bend: flow.bend });
    }
  }
  return [...edges.values()];
}

export function graphEvents(graph: CourseGraph): FlowEvent[] {
  return graph.flows.map((flow, index) => ({
    stepIndex: Math.floor(index / 2),
    edgeId: `${flow.from}->${flow.to}`,
    from: flow.from,
    to: flow.to,
    phase: flow.phase,
    time: `${(index * 0.75).toFixed(2)}s`,
    info: flow.info,
    size: flow.size,
    packet: flow.packet,
  }));
}
