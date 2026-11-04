import type { Lang } from '../types';
import { esc } from '../util';
import { applyTransformerSceneFrame, transformerSceneMarkup } from './transformerScene';

const text = (x: number, y: number, value: string, className = ''): string =>
  `<text class="ms-text ${className}" x="${x}" y="${y}">${esc(value)}</text>`;

const localized = (lang: Lang, zh: string, en: string): string => lang === 'zh' ? zh : en;

const heading = (lang: Lang, zh: string, en: string, subZh: string, subEn: string): string =>
  `${text(30, 32, localized(lang, zh, en), 'ms-title')}${text(30, 53, localized(lang, subZh, subEn), 'ms-subtitle')}`;

const group = (events: number[], content: string, className = ''): string =>
  `<g class="ms-item ${className}" data-events="${events.join(' ')}">${content}</g>`;

const box = (
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  events: number[],
  sub = '',
  className = '',
): string => group(events, `
  <rect class="ms-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="8" />
  ${text(x + width / 2, y + (sub ? height / 2 - 2 : height / 2 + 4), label, 'ms-block-label')}
  ${sub ? text(x + width / 2, y + height / 2 + 17, sub, 'ms-block-sub') : ''}
`, className);

const chips = (
  x: number,
  y: number,
  values: string[],
  events: number[],
  width = 52,
  gap = 7,
  className = '',
): string => group(events, values.map((value, index) => {
  const cx = x + index * (width + gap);
  return `<rect class="ms-chip" x="${cx}" y="${y}" width="${width}" height="32" rx="5" />${text(cx + width / 2, y + 21, value, 'ms-chip-text')}`;
}).join(''), className);

const matrix = (
  x: number,
  y: number,
  rows: number,
  cols: number,
  cell: number,
  events: number[],
  className = '',
): string => group(events, Array.from({ length: rows * cols }, (_, index) => {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const level = ((row * 3 + col * 5 + rows) % 5) / 5;
  return `<rect class="ms-cell" x="${x + col * (cell + 3)}" y="${y + row * (cell + 3)}" width="${cell}" height="${cell}" rx="2" style="--ms-level:${level}" />`;
}).join(''), className);

const bars = (
  x: number,
  y: number,
  values: number[],
  labels: string[],
  events: number[],
  width = 190,
  className = '',
): string => group(events, values.map((value, index) => {
  const by = y + index * 32;
  return `${text(x, by + 12, labels[index], 'ms-small')}${text(x + width, by + 12, String(value), 'ms-value')}<rect class="ms-track" x="${x}" y="${by + 18}" width="${width}" height="8" rx="4" /><rect class="ms-bar" x="${x}" y="${by + 18}" width="${Math.round(width * value / 100)}" height="8" rx="4" />`;
}).join(''), className);

const axes = (x: number, y: number, width: number, height: number): string =>
  `<path class="ms-axis" d="M ${x} ${y} V ${y - height} M ${x} ${y} H ${x + width}" />`;

const curve = (points: Array<[number, number]>, events: number[], className = ''): string =>
  group(events, `<polyline class="ms-curve ${className}" points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" />`);

const panel = (x: number, y: number, width: number, height: number, title: string): string =>
  `<rect class="ms-panel" x="${x}" y="${y}" width="${width}" height="${height}" rx="10" />${text(x + 14, y + 23, title, 'ms-panel-title')}`;

function trainingLoop(lang: Lang): string {
  return heading(lang, '一次 Transformer 训练迭代', 'One Transformer training iteration', 'Token 在层内计算，梯度沿层返回，优化器最后更新参数', 'Tokens move through layers, gradients return, and the optimizer updates parameters')
    + panel(25, 75, 170, 280, localized(lang, '输入 Token', 'Input tokens'))
    + chips(45, 115, ['128', '904', '37', '771'], [0, 1], 28, 5)
    + chips(45, 160, ['42', '619', '818', '95'], [0, 1], 28, 5)
    + box(52, 235, 115, 70, '[B,T]', [0, 1], 'int64')
    + panel(220, 75, 270, 280, 'Transformer')
    + box(245, 112, 220, 45, 'Embedding', [2], 'token -> vector')
    + box(245, 170, 220, 45, 'Block 1: Attn + FFN', [3], 'residual + norm')
    + box(245, 228, 220, 45, 'Block 2: Attn + FFN', [4], 'residual + norm')
    + box(245, 286, 220, 45, 'Block N: Attn + FFN', [5], 'hidden states')
    + panel(515, 75, 170, 135, localized(lang, '输出与损失', 'Output & loss'))
    + matrix(540, 112, 3, 5, 15, [6], 'ms-logits')
    + box(535, 165, 130, 30, 'CE Loss', [7])
    + panel(515, 230, 170, 125, localized(lang, '反向梯度', 'Backward gradients'))
    + bars(535, 258, [82, 55, 36], ['dW3', 'dW2', 'dW1'], [8, 9, 10], 125)
    + panel(710, 75, 165, 280, 'AdamW')
    + matrix(740, 115, 4, 4, 18, [11], 'ms-params')
    + box(735, 245, 115, 65, localized(lang, '参数更新', 'Weight update'), [12], 'theta - lr * step');
}

function tokenizer(lang: Lang): string {
  return heading(lang, '文本进入模型的真实变换', 'How text becomes model input', '字节、合并、ID、嵌入行和隐藏向量在同一工作区展开', 'Bytes, merges, IDs, embedding rows and hidden vectors')
    + panel(25, 80, 195, 120, localized(lang, '文本与 UTF-8', 'Text & UTF-8'))
    + chips(42, 115, ['大', '模', '型'], [0], 45, 7)
    + chips(42, 158, ['E5', 'A4', 'A7', 'E6', 'A8'], [1], 28, 4, 'ms-bytes')
    + panel(245, 80, 200, 120, 'BPE')
    + box(265, 115, 70, 42, '大 + 模', [2])
    + box(350, 115, 70, 42, '大模', [2])
    + text(335, 183, 'merge rank = 128', 'ms-small')
    + panel(470, 80, 175, 120, 'Token IDs')
    + chips(490, 125, ['3819', '772'], [3], 62, 9)
    + panel(25, 230, 300, 160, localized(lang, '嵌入矩阵 E[V,d]', 'Embedding matrix E[V,d]'))
    + matrix(55, 270, 4, 8, 20, [4])
    + text(235, 285, 'id=3819', 'ms-small') + text(235, 310, 'id=772', 'ms-small')
    + panel(350, 230, 250, 160, localized(lang, '隐藏状态 [B,T,d]', 'Hidden states [B,T,d]'))
    + matrix(385, 270, 4, 6, 22, [5], 'ms-hidden')
    + panel(625, 80, 250, 310, localized(lang, '成本随 Token 增长', 'Cost grows with tokens'))
    + bars(650, 125, [28, 52, 76, 91], ['T=128', 'T=512', 'T=2K', 'T=8K'], [6, 7], 195)
    + text(650, 275, 'KV = 2 * L * T * n_kv * d_h * b', 'ms-formula')
    + text(650, 305, localized(lang, '训练与 Serving 使用相同 ID', 'Training and serving share IDs'), 'ms-small');
}

function backprop(lang: Lang): string {
  return heading(lang, '计算图中的前向与梯度', 'Forward and gradients in the compute graph', '层对象保留激活，梯度按相反顺序填充', 'Layers retain activations and gradients fill in reverse order')
    + panel(25, 80, 165, 285, localized(lang, '参数与 Loss', 'Parameters & loss'))
    + matrix(55, 120, 3, 3, 22, [0], 'ms-params')
    + box(55, 255, 105, 60, 'L = 2.31', [1], 'scalar')
    + panel(215, 80, 230, 285, 'Transformer blocks')
    + box(240, 110, 180, 45, 'Layer 1', [0, 3], 'save x0, h1')
    + box(240, 165, 180, 45, 'Layer 2', [0, 3], 'save x1, h2')
    + box(240, 220, 180, 45, 'Layer 3', [0, 2], 'save x2, logits')
    + bars(240, 265, [72, 48, 85], ['dL/dW3', 'dL/dW2', 'dL/dW1'], [2, 3], 180)
    + panel(470, 80, 190, 285, 'Gradcheck')
    + text(490, 120, 'f(x + eps)', 'ms-formula') + text(490, 150, 'f(x - eps)', 'ms-formula')
    + box(490, 185, 150, 45, 'numeric grad', [4])
    + box(490, 245, 150, 45, 'analytic grad', [5])
    + text(490, 325, 'error < 1e-6', 'ms-formula')
    + panel(685, 80, 190, 285, localized(lang, '诊断与裁剪', 'Diagnosis & clipping'))
    + bars(710, 125, [91, 63, 24], ['L3 norm', 'L2 norm', 'L1 norm'], [6], 140)
    + box(710, 255, 140, 60, 'global clip', [7], 'tau / ||g||');
}

function optimizer(lang: Lang): string {
  return heading(lang, '参数更新发生在优化器状态中', 'Parameter updates inside optimizer state', '梯度、m/v、偏差修正、学习率和权重衰减分别可见', 'Gradients, moments, correction, LR and decay are visible')
    + panel(25, 80, 190, 130, localized(lang, '梯度与动量', 'Gradient & moments'))
    + bars(45, 120, [64, 42], ['g_t', 'm_t'], [0, 1], 150)
    + panel(240, 80, 190, 130, localized(lang, '二阶矩与修正', 'Second moment & correction'))
    + bars(260, 120, [55, 71], ['v_t', 'm_hat'], [1, 2], 150)
    + panel(455, 80, 190, 130, 'LR schedule')
    + axes(475, 185, 150, 65) + curve([[475,180],[500,165],[525,135],[555,125],[590,145],[625,175]], [4, 5])
    + panel(670, 80, 205, 130, 'AdamW')
    + box(690, 120, 165, 55, localized(lang, '参数组 + 解耦衰减', 'Groups + decoupled decay'), [3, 5])
    + panel(25, 240, 540, 150, localized(lang, '参数矩阵更新前后', 'Parameter matrix before and after'))
    + matrix(60, 280, 3, 5, 22, [6], 'ms-before')
    + text(240, 320, 'theta_t', 'ms-formula')
    + matrix(340, 280, 3, 5, 22, [6, 7], 'ms-after')
    + text(510, 320, 'theta_(t+1)', 'ms-formula')
    + panel(590, 240, 285, 150, localized(lang, '更新幅度', 'Update magnitude'))
    + bars(615, 280, [35, 52, 28], ['layer 1', 'layer 2', 'layer 3'], [7], 220);
}

function distributed(lang: Lang): string {
  return heading(lang, '数据并行与参数分片的设备状态', 'Device state for data parallelism and sharding', '每张卡有自己的 batch 与梯度，集通信同步的是模型状态', 'Each device owns a batch and gradients; collectives synchronize model state')
    + panel(25, 80, 165, 285, localized(lang, '全局 Batch', 'Global batch'))
    + chips(45, 120, ['D0', 'D0'], [0], 55, 8)
    + chips(45, 165, ['D1', 'D1'], [1], 55, 8)
    + box(50, 235, 115, 65, 'B_global / 2', [0, 1])
    + panel(215, 80, 200, 285, 'GPU Rank 0')
    + box(240, 115, 150, 45, 'local batch D0', [0])
    + matrix(260, 180, 2, 4, 18, [2], 'ms-gradient')
    + box(240, 285, 150, 45, 'param shard 0', [4, 5])
    + panel(440, 80, 200, 285, 'GPU Rank 1')
    + box(465, 115, 150, 45, 'local batch D1', [1])
    + matrix(485, 180, 2, 4, 18, [3], 'ms-gradient')
    + box(465, 285, 150, 45, 'param shard 1', [4, 6])
    + panel(665, 80, 210, 285, 'NCCL / FSDP')
    + bars(690, 120, [50, 100, 75], ['bucket 0', 'bucket 1', 'bucket 2'], [2, 3], 160)
    + box(690, 240, 160, 45, 'AllReduce', [7])
    + box(690, 300, 160, 40, 'synchronized step', [7]);
}

function memory(lang: Lang): string {
  return heading(lang, 'GPU 显存不是黑盒', 'GPU memory is not a black box', '播放时观察激活保存、重算、梯度和 Offload 如何改变峰值', 'See activation saving, recompute, gradients and offload change the peak')
    + panel(25, 80, 310, 300, 'GPU HBM')
    + group([0], '<rect class="ms-memory ms-weight" x="55" y="120" width="250" height="38" rx="4" />' + text(180, 145, 'BF16 weights', 'ms-block-label'))
    + group([1], '<rect class="ms-memory ms-activation" x="55" y="162" width="250" height="70" rx="4" />' + text(180, 200, 'saved activations', 'ms-block-label'))
    + group([2], '<rect class="ms-memory ms-recompute" x="55" y="236" width="250" height="30" rx="4" />' + text(180, 257, 'checkpoint boundaries', 'ms-block-label'))
    + group([3], '<rect class="ms-memory ms-gradient" x="55" y="270" width="250" height="34" rx="4" />' + text(180, 293, 'gradients', 'ms-block-label'))
    + group([4], '<rect class="ms-memory ms-state" x="55" y="308" width="250" height="48" rx="4" />' + text(180, 337, 'FP32 master + m/v', 'ms-block-label'))
    + panel(360, 80, 235, 300, localized(lang, '重算与主机内存', 'Recompute & host memory'))
    + box(385, 120, 185, 50, 'recompute forward', [2])
    + box(385, 195, 185, 50, 'CPU pinned memory', [5])
    + box(385, 270, 185, 50, 'prefetch to GPU', [6])
    + panel(620, 80, 255, 300, localized(lang, '峰值与预算', 'Peak & budget'))
    + bars(650, 125, [42, 68, 83, 94], ['weights', 'activations', 'optimizer', 'peak'], [0, 1, 4, 7], 195)
    + text(650, 275, 'allocated != reserved', 'ms-formula')
    + text(650, 305, 'D2H / H2D uses link time', 'ms-small');
}

function finetune(lang: Lang): string {
  return heading(lang, '对齐发生在回答分布上', 'Alignment operates on response distributions', 'SFT mask、chosen/rejected 对数概率、偏好间隔与 KL 直接可见', 'SFT masks, response logps, preference margins and KL')
    + panel(25, 80, 270, 285, localized(lang, '指令与回答', 'Instruction & responses'))
    + box(45, 115, 230, 38, 'Prompt tokens', [0])
    + chips(48, 170, ['-', '-', 'answer', 'EOS'], [1], 52, 6)
    + text(48, 225, 'chosen:   helpful answer', 'ms-small')
    + text(48, 255, 'rejected: unsafe answer', 'ms-small')
    + box(45, 290, 230, 45, 'completion-only CE', [1])
    + panel(320, 80, 260, 285, localized(lang, '策略与参考分布', 'Policy & reference distributions'))
    + bars(345, 120, [78, 42], ['policy chosen', 'policy rejected'], [2], 205)
    + bars(345, 205, [64, 51], ['ref chosen', 'ref rejected'], [3], 205)
    + text(345, 315, 'margin = chosen - rejected', 'ms-formula')
    + panel(605, 80, 270, 285, localized(lang, '目标与独立评测', 'Objective & independent eval'))
    + bars(630, 120, [72, 28], ['DPO margin', 'KL budget'], [4, 5], 215)
    + box(630, 220, 215, 45, 'updated policy', [6])
    + chips(635, 290, ['PASS', 'PASS', 'FAIL', 'PASS'], [6, 7], 46, 7, 'ms-eval');
}

function trainingDebug(lang: Lang): string {
  return heading(lang, '训练曲线与首个异常点', 'Training curves and the first anomaly', '用小样本、分层范数和学习率曲线定位问题，而不是盲目调参', 'Use tiny samples, layer norms and LR curves instead of blind tuning')
    + panel(25, 80, 195, 130, localized(lang, '固定 8 条样本', 'Eight fixed samples'))
    + matrix(50, 120, 2, 4, 24, [0, 1], 'ms-samples')
    + panel(245, 80, 290, 130, 'Loss')
    + axes(270, 185, 235, 70) + curve([[270,120],[310,135],[350,142],[390,158],[430,165],[505,177]], [0, 1])
    + panel(560, 80, 315, 130, localized(lang, '分层梯度范数', 'Per-layer gradient norms'))
    + bars(585, 115, [88, 55, 31], ['layer 3', 'layer 2', 'layer 1'], [2, 3], 255)
    + panel(25, 240, 395, 150, localized(lang, 'NaN / Spike 定位', 'NaN / spike localization'))
    + axes(55, 355, 335, 75) + curve([[55,345],[110,340],[165,342],[220,330],[275,270],[330,345],[390,350]], [4, 5], 'ms-anomaly')
    + text(262, 263, 'first bad step', 'ms-small')
    + panel(445, 240, 430, 150, 'LR range test / train vs valid')
    + axes(475, 355, 170, 75) + curve([[475,345],[510,330],[545,310],[580,295],[645,320]], [6])
    + axes(680, 355, 165, 75) + curve([[680,345],[720,330],[760,315],[800,305],[845,300]], [7])
    + curve([[680,350],[720,340],[760,335],[800,330],[845,280]], [7], 'ms-valid');
}

function agentLoop(lang: Lang): string {
  return heading(lang, '模型与工具组成的有界状态机', 'A bounded model-and-tool state machine', '主区域展示消息、工具调用和观察如何进入下一轮模型上下文', 'Messages, tool calls and observations enter the next model context')
    + panel(25, 80, 390, 285, localized(lang, '会话上下文', 'Conversation context'))
    + box(45, 115, 350, 42, 'User: calculate and cite', [0])
    + box(45, 170, 350, 55, 'Assistant: tool_call(calculator)', [1, 2])
    + box(45, 240, 350, 55, 'Tool: { result: 42, call_id: c1 }', [3, 4])
    + box(45, 310, 350, 35, 'Assistant: grounded final answer', [6])
    + panel(440, 80, 200, 285, localized(lang, '执行状态', 'Execution state'))
    + bars(465, 120, [25, 50, 75, 100], ['step 1', 'step 2', 'step 3', 'done'], [1, 4, 5, 6], 150)
    + box(465, 285, 150, 45, 'max_steps = 8', [5])
    + panel(665, 80, 210, 285, localized(lang, '工具与 Trace', 'Tool & trace'))
    + box(685, 120, 170, 45, 'schema + permission', [2])
    + box(685, 180, 170, 45, 'tool result / error', [3])
    + box(685, 240, 170, 45, 'timeout / cancel', [5])
    + box(685, 300, 170, 40, 'trace committed', [7]);
}

function harness(lang: Lang): string {
  return heading(lang, 'Harness 管理的是模型运行上下文', 'Harness manages the model runtime context', '工具版本、权限、上下文预算与 trace 都围绕一次模型运行组织', 'Tool versions, permissions, context budget and traces around one run')
    + panel(25, 80, 200, 130, 'Tool registry')
    + box(45, 115, 160, 35, 'local.read v2', [0])
    + box(45, 160, 160, 35, 'mcp.search v5', [1])
    + panel(250, 80, 200, 130, localized(lang, '权限闸门', 'Permission gate'))
    + box(270, 115, 160, 35, 'scope + ownership', [2])
    + box(270, 160, 160, 35, 'approved arguments', [2])
    + panel(475, 80, 180, 130, localized(lang, '工具运行时', 'Tool runtime'))
    + box(495, 125, 140, 50, 'deterministic call', [3])
    + panel(680, 80, 195, 130, 'Trace')
    + bars(700, 115, [80, 55], ['model span', 'tool span'], [5, 6], 155)
    + panel(25, 240, 625, 150, localized(lang, 'Session -> 压缩后的模型视图', 'Session -> compacted model view'))
    + chips(45, 280, ['system', 'user', 'call 1', 'obs 1', 'call 2'], [4], 100, 8)
    + box(45, 335, 555, 30, 'summary + recent critical path + pending calls', [4])
    + panel(680, 240, 195, 150, localized(lang, '恢复点', 'Recovery point'))
    + box(700, 280, 155, 50, 'resume committed', [7])
    + text(700, 355, 'no repeated writes', 'ms-small');
}

function evaluation(lang: Lang): string {
  return heading(lang, '评测驱动模型与 Harness 迭代', 'Evaluation drives model and harness iterations', '每个格子是任务结局，trace 与副作用决定失败分类和发布', 'Each cell is a task outcome; traces and side effects drive classification')
    + panel(25, 80, 280, 285, localized(lang, '任务与评分矩阵', 'Task & grading matrix'))
    + matrix(55, 125, 5, 6, 28, [0, 1, 2], 'ms-eval-grid')
    + text(55, 335, 'green: pass   red: fail', 'ms-small')
    + panel(330, 80, 250, 285, localized(lang, 'Trace 失败归因', 'Trace failure attribution'))
    + bars(355, 120, [85, 63, 42, 26], ['model', 'tool', 'permission', 'environment'], [3, 4], 210)
    + box(355, 285, 200, 45, 'first causal span', [4])
    + panel(605, 80, 270, 285, localized(lang, '发布仪表板', 'Release dashboard'))
    + bars(630, 120, [86, 62, 100], ['success', 'cost budget', 'security gate'], [5, 6], 215)
    + box(630, 255, 215, 45, 'new regression cases', [7])
    + text(630, 330, 'quality + latency + cost', 'ms-small');
}

function inference(lang: Lang): string {
  return heading(lang, '推理是 Token 与 KV 状态的时间序列', 'Inference is a timeline of tokens and KV state', 'Prefill 建立状态，Decode 逐步追加；连续批和 Draft 共享同一工作区', 'Prefill creates state, decode appends; batches and drafts share the scene')
    + panel(25, 80, 200, 130, localized(lang, '请求与调度', 'Requests & scheduler'))
    + chips(45, 120, ['R1', 'R2', 'R3'], [0], 45, 7)
    + box(45, 165, 155, 30, 'continuous batch', [1, 4])
    + panel(250, 80, 350, 130, 'Prefill tokens')
    + chips(270, 120, ['The', 'large', 'language', 'model'], [1], 70, 7)
    + text(270, 185, 'parallel prefix computation', 'ms-small')
    + panel(625, 80, 250, 130, 'KV pages')
    + chips(645, 120, ['p0', 'p1', 'p2', 'p3'], [2, 3, 5], 45, 8)
    + text(645, 185, 'block table + prefix reuse', 'ms-small')
    + panel(25, 240, 460, 150, 'Decode timeline')
    + chips(45, 280, ['t0', 't1', 't2', 't3', 't4', 't5'], [3, 5], 55, 8)
    + text(45, 350, 'one new token + historical KV reads per step', 'ms-small')
    + panel(510, 240, 365, 150, localized(lang, 'Draft 验证与输出', 'Draft verification & output'))
    + chips(530, 280, ['A', 'B', 'C', 'D'], [6], 45, 8, 'ms-draft')
    + chips(760, 280, ['A', 'B'], [6], 45, 8, 'ms-accepted')
    + box(530, 335, 315, 30, 'accepted tokens stream immediately', [7]);
}

function infraQuant(lang: Lang): string {
  return heading(lang, '把模型运行映射到硬件下界', 'Map model execution to hardware bounds', '容量、FLOPs、字节和 Roofline 使用同一组模型参数', 'Capacity, FLOPs, bytes and Roofline share model parameters')
    + panel(25, 80, 205, 130, localized(lang, '容量账 GiB', 'Capacity ledger GiB'))
    + bars(45, 120, [45, 28, 18], ['weights', 'KV/state', 'workspace'], [0, 1], 160)
    + panel(255, 80, 200, 130, 'Compute')
    + matrix(280, 120, 3, 4, 18, [2])
    + text(365, 140, 'F = 2mkn', 'ms-formula')
    + panel(480, 80, 180, 130, 'Traffic')
    + bars(500, 120, [75, 48], ['weights', 'KV'], [3], 140)
    + panel(685, 80, 190, 130, 'Profile')
    + bars(705, 120, [83, 61], ['MFU', 'MBU'], [6], 150)
    + panel(25, 240, 590, 150, 'Roofline')
    + axes(60, 355, 520, 85)
    + curve([[60,350],[180,320],[300,295],[420,285],[580,285]], [4, 5])
    + curve([[60,285],[580,285]], [5], 'ms-roofline')
    + group([6], '<circle class="ms-measure" cx="360" cy="325" r="7" />' + text(375, 330, 'measured', 'ms-small'))
    + panel(640, 240, 235, 150, localized(lang, '差距归因', 'Gap attribution'))
    + bars(660, 275, [38, 26, 18], ['memory', 'launch', 'waiting'], [7], 180);
}

export function buildModelSceneMarkup(lessonId: string, lang: Lang): string {
  switch (lessonId) {
    case 'training-loop': return trainingLoop(lang);
    case 'tokenizer': return tokenizer(lang);
    case 'attention': return transformerSceneMarkup(lang);
    case 'backprop': return backprop(lang);
    case 'optimizer': return optimizer(lang);
    case 'distributed': return distributed(lang);
    case 'memory': return memory(lang);
    case 'finetune': return finetune(lang);
    case 'training-debug': return trainingDebug(lang);
    case 'agent-loop': return agentLoop(lang);
    case 'harness': return harness(lang);
    case 'eval': return evaluation(lang);
    case 'inference-serving': return inference(lang);
    case 'infra-quant': return infraQuant(lang);
    default: throw new Error(`Missing model scene: ${lessonId}`);
  }
}

export function applyModelSceneFrame(svg: SVGSVGElement, eventIndex: number): void {
  if (svg.dataset.lessonId === 'attention') {
    applyTransformerSceneFrame(svg, eventIndex);
  }
}
