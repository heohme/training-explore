import type { Lang } from '../types';
import { esc } from '../util';

type Matrix = number[][];

type FrameKind = 'matrix' | 'triple' | 'scores' | 'probabilities' | 'hidden' | 'distribution';

interface FrameMeta {
  title: [string, string];
  equation: string;
  shape: string;
  note: [string, string];
  kind: FrameKind;
}

const TOKENS = ['I', 'like', 'large', 'models'];
const TOKEN_IDS = [42, 517, 1803, 91];
const OUTPUT_TOKENS = ['I', 'like', 'small', 'large', 'models', '!'];

const X: Matrix = [
  [0.2, -0.4, 0.8, 0.1],
  [0.6, 0.3, -0.2, 0.5],
  [-0.1, 0.7, 0.4, -0.6],
  [0.5, -0.2, 0.9, 0.3],
];
const POSITION: Matrix = [
  [0, 0.1, -0.1, 0.2],
  [0.1, -0.1, 0.2, 0],
  [-0.1, 0.2, 0, 0.1],
  [0.2, 0, -0.1, -0.1],
];
const WQ: Matrix = [
  [0.6, 0.3, 0, -0.3],
  [0.3, 0.9, 0.6, 0],
  [0, 0.3, 0.6, 0.6],
  [-0.3, 0, 0.3, 0.9],
];
const WK: Matrix = [
  [0.3, 0.6, 0.3, 0],
  [0.6, -0.3, 0, 0.6],
  [0, 0.6, 0.9, 0.3],
  [0.3, 0, -0.3, 0.6],
];
const WV: Matrix = [
  [0.3, 0, 0.1, 0.1],
  [0.1, 0.2, -0.1, 0],
  [0, 0.1, 0.2, 0.2],
  [0.2, 0.1, 0, 0.3],
];
const WO: Matrix = [
  [0.4, 0.1, 0, 0.1],
  [0, 0.3, 0.1, 0],
  [0.1, 0, 0.4, 0.1],
  [0.1, 0.1, 0, 0.3],
];
const W1: Matrix = Array.from({ length: 4 }, (_, row) =>
  Array.from({ length: 8 }, (_, col) => 0.08 * (((row + 2) * (col + 3)) % 5 - 2)),
);
const W2: Matrix = Array.from({ length: 8 }, (_, row) =>
  Array.from({ length: 4 }, (_, col) => 0.06 * (((row + 1) * (col + 4)) % 5 - 2)),
);
const OUTPUT_WEIGHT: Matrix = [
  [0.2, -0.1, 0.1, 0.3],
  [0.1, 0.3, -0.2, 0.1],
  [-0.2, 0.2, 0.3, 0.1],
  [0.3, 0.1, 0.2, -0.1],
  [0.2, 0.2, 0.1, 0.2],
  [-0.1, 0.3, 0.2, 0.2],
];

const FRAMES: FrameMeta[] = [
  { title: ['嵌入查表：离散 ID 变成连续向量', 'Embedding lookup: discrete IDs become vectors'], equation: 'X[t,:] = E[token_ids[t],:]', shape: '[T] -> [T,d] = [4,4]', note: ['每个 ID 选择 E 的一行；不是对词表做密集矩阵乘。', 'Each ID selects one row of E; no dense vocabulary matmul is needed.'], kind: 'matrix' },
  { title: ['加入位置：相同的词在不同位置得到不同输入', 'Add position: identical tokens differ by position'], equation: 'H0 = X + P', shape: '[4,4] + [4,4] -> [4,4]', note: ['这里用可学习位置嵌入便于观察；RoPE 则在 Q/K 上施加相对位置旋转变换。', 'Learned positions are shown here; RoPE instead rotates Q/K by position.'], kind: 'matrix' },
  { title: ['Pre-RMSNorm：按每个 token 的通道向量归一化', 'Pre-RMSNorm over each token channel vector'], equation: 'N[t,:] = H0[t,:] / sqrt(mean(H0[t,:]^2)+eps)', shape: '4 independent RMS reductions', note: ['归一化沿 d 维进行，不跨 batch 或 token；随后才进入 Q/K/V 投影。', 'Normalization is over d, never across batch or tokens; Q/K/V projections follow.'], kind: 'matrix' },
  { title: ['Q/K/V 投影、拆成 2 头，并对 Q/K 应用 RoPE', 'Project Q/K/V, split two heads, rotate Q/K with RoPE'], equation: 'Q,K,V = N Wq,N Wk,N Wv;  h=2, d_head=2', shape: 'Q,K,V: [B,h,T,d_head] = [1,2,4,2]', note: ['每头只保留 2 个通道。RoPE 旋转每个二维通道对，V 不做旋转。', 'Each head keeps two channels. RoPE rotates 2D channel pairs; V is not rotated.'], kind: 'triple' },
  { title: ['头 0 的缩放点积与因果掩码', 'Scaled dot products and causal mask for head 0'], equation: 'S[i,j] = (Q0[i,:] dot K0[j,:]) / sqrt(2); j>i => -inf', shape: '[4,2] x [2,4] -> scores [4,4]', note: ['上三角被屏蔽：位置 i 不能读取未来 j>i。数值不是伪热图，而由上方 Q/K 实算。', 'The upper triangle is masked. Values are computed from the Q/K above, not a fake heatmap.'], kind: 'scores' },
  { title: ['稳定 Softmax：先减行最大值，再归一化', 'Stable softmax: subtract row maxima, then normalize'], equation: 'A[i,j] = exp(S[i,j]-m_i) / sum_k exp(S[i,k]-m_i)', shape: 'scores [4,4] -> probabilities [4,4]', note: ['每一行只覆盖可见历史，行和必须为 1；被 mask 的位置严格为 0。', 'Each row covers visible history only, sums to one, and masked positions are exactly zero.'], kind: 'probabilities' },
  { title: ['两个头分别做加权求和，再拼回 d=4', 'Weighted values per head, then concatenate to d=4'], equation: 'C_h = A_h V_h;  C = concat(C_0,C_1)', shape: 'per head [4,4]x[4,2] -> [4,2]', note: ['第 i 行输出是可见 V 向量的凸组合；两个头在不同子空间携带不同上下文。', 'Each output row is a convex combination of visible V vectors; heads mix different subspaces.'], kind: 'matrix' },
  { title: ['输出投影与第一条残差连接', 'Output projection and the first residual connection'], equation: 'H1 = H0 + (C Wo)', shape: '[4,4] + [4,4] -> H1 [4,4]', note: ['残差保留原始表示通路，Attention 只写入增量；不是用 Attention 输出替换 H0。', 'The residual preserves the original representation; attention adds a delta instead of replacing H0.'], kind: 'matrix' },
  { title: ['第二个 Pre-RMSNorm 后，FFN 扩展到 d_ff=8', 'Second pre-RMSNorm, then FFN expansion to d_ff=8'], equation: 'U = GELU(RMSNorm(H1) W1)', shape: '[4,4] x [4,8] -> U [4,8]', note: ['GELU 逐元素作用。每个 token 独立经过同一个两层 MLP，不在 token 间混合。', 'GELU is elementwise. Every token passes through the same MLP independently, without token mixing.'], kind: 'hidden' },
  { title: ['FFN 投影回 d=4，并写入第二条残差', 'Project FFN back to d=4 and add the second residual'], equation: 'H2 = H1 + U W2', shape: '[4,8] x [4,4] -> [4,4]', note: ['H2 是一个 Block 的输出。真实模型把同一结构堆叠 L 次，每层拥有自己的参数。', 'H2 exits one block. Real models repeat this structure L times with distinct parameters per layer.'], kind: 'matrix' },
  { title: ['Final RMSNorm 与词表输出投影', 'Final RMSNorm and vocabulary projection'], equation: 'logits = RMSNorm(H2) Wout^T', shape: 'last [1,4] -> logits [1,6]', note: ['只看最后一个位置的下一 token 分布；训练时所有有效位置都可并行计算 logits。', 'Only the last position is shown for next-token prediction; training computes logits at all supervised positions.'], kind: 'distribution' },
  { title: ['Softmax 得到下一 token 概率，交叉熵产生训练信号', 'Softmax yields next-token probabilities; cross-entropy gives the signal'], equation: 'p = softmax(logits);  CE = -log p[target]', shape: 'target = !; scalar loss', note: ['前向到这里结束。反向传播会从 CE 沿每条运算链返回，而不是在 Transformer 内另跑一套网络。', 'Forward ends here. Backpropagation traces every operation from CE; it is not a separate network.'], kind: 'distribution' },
];

function matMul(a: Matrix, b: Matrix): Matrix {
  if (a.length === 0 || b.length === 0 || a[0].length !== b.length) {
    throw new Error('Invalid matrix multiplication shapes');
  }
  return a.map((row) => b[0].map((_, col) =>
    row.reduce((sum, value, index) => sum + value * b[index][col], 0),
  ));
}

function add(a: Matrix, b: Matrix): Matrix {
  if (a.length !== b.length || a[0].length !== b[0].length) {
    throw new Error('Invalid matrix addition shapes');
  }
  return a.map((row, i) => row.map((value, j) => value + b[i][j]));
}

function rmsNorm(a: Matrix): Matrix {
  return a.map((row) => {
    const rms = Math.sqrt(row.reduce((sum, value) => sum + value * value, 0) / row.length + 1e-6);
    return row.map((value) => value / rms);
  });
}

function rope(a: Matrix): Matrix {
  return a.map((row, position) => {
    const result = [...row];
    for (let pair = 0; pair < row.length / 2; pair += 1) {
      const angle = position / Math.pow(10000, pair / 2);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const offset = pair * 2;
      const first = row[offset];
      const second = row[offset + 1];
      result[offset] = first * cos - second * sin;
      result[offset + 1] = first * sin + second * cos;
    }
    return result;
  });
}

function head(a: Matrix, index: number): Matrix {
  return a.map((row) => row.slice(index * 2, index * 2 + 2));
}

function transpose(a: Matrix): Matrix {
  return a[0].map((_, col) => a.map((row) => row[col]));
}

function scale(a: Matrix, value: number): Matrix {
  return a.map((row) => row.map((cell) => cell * value));
}

function causalScores(q: Matrix, k: Matrix): Matrix {
  return matMul(q, transpose(k)).map((row, i) => row.map((value, j) => j > i ? Number.NEGATIVE_INFINITY : value));
}

function softmax(a: Matrix): Matrix {
  return a.map((row) => {
    const maximum = Math.max(...row);
    const exponentials = row.map((value) => Number.isFinite(value) ? Math.exp(value - maximum) : 0);
    const denominator = exponentials.reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(denominator) || denominator <= 0) {
      throw new Error('Softmax row has no visible keys');
    }
    return exponentials.map((value) => value / denominator);
  });
}

function gelu(value: number): number {
  return 0.5 * value * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (value + 0.044715 * value ** 3)));
}

function computeState() {
  const h0 = add(X, POSITION);
  const n0 = rmsNorm(h0);
  const q = rope(matMul(n0, WQ));
  const k = rope(matMul(n0, WK));
  const v = matMul(n0, WV);
  const scores = scale(causalScores(head(q, 0), head(k, 0)), 1 / Math.sqrt(2));
  const probabilities = softmax(scores);
  const c0 = matMul(probabilities, head(v, 0));
  const p1 = softmax(scale(causalScores(head(q, 1), head(k, 1)), 1 / Math.sqrt(2)));
  const c1 = matMul(p1, head(v, 1));
  const context = c0.map((row, i) => [...row, ...c1[i]]);
  const attentionOut = matMul(context, WO);
  const h1 = add(h0, attentionOut);
  const expanded = matMul(rmsNorm(h1), W1).map((row) => row.map(gelu));
  const ffnOut = matMul(expanded, W2);
  const h2 = add(h1, ffnOut);
  const finalNorm = rmsNorm(h2);
  const logits = matMul([finalNorm[3]], transpose(OUTPUT_WEIGHT))[0];
  const distribution = softmax([logits])[0];
  probabilities.forEach((row) => {
    const sum = row.reduce((total, value) => total + value, 0);
    if (Math.abs(sum - 1) > 1e-10) {
      throw new Error('Attention probability row does not sum to one');
    }
  });
  return { h0, n0, q, k, v, scores, probabilities, context, attentionOut, h1, expanded, ffnOut, h2, logits, distribution };
}

const STATE = computeState();

function text(x: number, y: number, value: string, className = ''): string {
  return `<text class="ms-text ${className}" x="${x}" y="${y}">${esc(value)}</text>`;
}

function panel(x: number, y: number, width: number, height: number): string {
  return `<rect class="ms-panel" x="${x}" y="${y}" width="${width}" height="${height}" rx="10" />`;
}

function format(value: number): string {
  if (!Number.isFinite(value)) {
    return 'mask';
  }
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return normalized.toFixed(2);
}

function wrapNote(value: string, lang: Lang): string[] {
  if (lang === 'zh') {
    const lines: string[] = [];
    for (let index = 0; index < value.length; index += 25) {
      lines.push(value.slice(index, index + 25));
    }
    return lines;
  }
  const lines: string[] = [];
  let line = '';
  value.split(' ').forEach((word) => {
    if (line && `${line} ${word}`.length > 40) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  });
  if (line) {
    lines.push(line);
  }
  return lines;
}

function matrixMarkup(
  data: Matrix,
  x: number,
  y: number,
  label: string,
  cellWidth = 62,
  cellHeight = 25,
  probability = false,
): string {
  const labels = data[0].map((_, col) => text(x + col * cellWidth + cellWidth / 2, y - 9, `d${col}`, 'tf-axis-label')).join('');
  const rows = data.map((row, rowIndex) => {
    const rowLabel = text(x - 10, y + rowIndex * cellHeight + 17, `t${rowIndex}`, 'tf-row-label');
    const cells = row.map((value, colIndex) => {
      const cx = x + colIndex * cellWidth;
      const cy = y + rowIndex * cellHeight;
      const masked = !Number.isFinite(value);
      const level = probability ? value : Math.min(1, Math.abs(value) / 1.5);
      const valueClass = masked ? 'is-masked' : value < 0 ? 'is-negative' : '';
      return `<g class="tf-value ${valueClass}" style="--tf-order:${rowIndex * row.length + colIndex};--tf-level:${level.toFixed(3)}"><rect class="tf-cell" x="${cx}" y="${cy}" width="${cellWidth - 3}" height="${cellHeight - 3}" rx="3" /><text class="tf-number" x="${cx + (cellWidth - 3) / 2}" y="${cy + 16}">${masked ? '--' : probability ? value.toFixed(3) : format(value)}</text></g>`;
    }).join('');
    return rowLabel + cells;
  }).join('');
  return `<g class="tf-matrix">${text(x, y - 28, label, 'ms-panel-title')}${labels}${rows}</g>`;
}

function tokenStrip(): string {
  return TOKENS.map((token, index) => {
    const x = 55 + index * 125;
    return `<g class="tf-value" style="--tf-order:${index}"><rect class="tf-token" x="${x}" y="196" width="112" height="42" rx="5" />${text(x + 56, 213, token, 'tf-token-text')}${text(x + 56, 229, `id=${TOKEN_IDS[index]}`, 'tf-token-id')}</g>`;
  }).join('');
}

function notePanel(meta: FrameMeta, lang: Lang, x = 610, y = 205, width = 240): string {
  const note = wrapNote(meta.note[lang === 'zh' ? 0 : 1], lang);
  return panel(x, y, width, 154)
    + text(x + 15, y + 26, meta.shape, 'tf-shape')
    + note.map((line, index) => text(x + 15, y + 54 + index * 18, line, 'ms-small')).join('');
}

function primaryMatrix(eventIndex: number): { data: Matrix; label: string; secondary?: { data: Matrix; label: string } } {
  switch (eventIndex) {
    case 0: return { data: X, label: 'X = embedding lookup' };
    case 1: return { data: STATE.h0, label: 'H0 = X + P', secondary: { data: POSITION, label: 'P' } };
    case 2: return { data: STATE.n0, label: 'N = RMSNorm(H0)' };
    case 6: return { data: STATE.context, label: 'C = concat(head 0, head 1)' };
    case 7: return { data: STATE.h1, label: 'H1 = H0 + attention output', secondary: { data: STATE.attentionOut, label: 'C Wo' } };
    case 9: return { data: STATE.h2, label: 'H2 = H1 + FFN output', secondary: { data: STATE.ffnOut, label: 'U W2' } };
    default: throw new Error(`No primary matrix for event ${eventIndex}`);
  }
}

function distributionMarkup(eventIndex: number): string {
  const values = eventIndex === 10 ? STATE.logits : STATE.distribution;
  const maximum = Math.max(...values.map((value) => Math.abs(value)), 0.001);
  return values.map((value, index) => {
    const y = 204 + index * 28;
    const width = Math.max(2, Math.abs(value) / maximum * 330);
    const x = eventIndex === 11 ? 120 : value < 0 ? 310 - width : 310;
    return `<g class="tf-value" style="--tf-order:${index}">${text(90, y + 15, OUTPUT_TOKENS[index], 'tf-token-label')}<rect class="tf-track" x="120" y="${y}" width="430" height="20" rx="4" /><rect class="tf-distribution-bar ${value < 0 ? 'is-negative' : ''}" x="${x}" y="${y}" width="${width}" height="20" rx="4" />${text(565, y + 15, eventIndex === 11 ? `${(value * 100).toFixed(1)}%` : format(value), 'tf-distribution-value')}</g>`;
  }).join('');
}

function detailMarkup(eventIndex: number, lang: Lang): string {
  if (!Number.isInteger(eventIndex) || eventIndex < 0 || eventIndex >= FRAMES.length) {
    throw new Error(`Transformer event index out of range: ${eventIndex}`);
  }
  const meta = FRAMES[eventIndex];
  const title = meta.title[lang === 'zh' ? 0 : 1];
  let content = '';
  if (meta.kind === 'matrix') {
    const primary = primaryMatrix(eventIndex);
    content = (eventIndex === 0 ? tokenStrip() : '')
      + matrixMarkup(primary.data, 65, eventIndex === 0 ? 275 : 225, primary.label)
      + (primary.secondary ? matrixMarkup(primary.secondary.data, 370, 225, primary.secondary.label, 48, 25) : '')
      + notePanel(meta, lang);
  } else if (meta.kind === 'triple') {
    content = matrixMarkup(STATE.q, 55, 225, 'Q after RoPE', 46, 25)
      + matrixMarkup(STATE.k, 300, 225, 'K after RoPE', 46, 25)
      + matrixMarkup(STATE.v, 545, 225, 'V', 46, 25)
      + text(55, 375, meta.shape, 'tf-shape');
  } else if (meta.kind === 'scores' || meta.kind === 'probabilities') {
    const probability = meta.kind === 'probabilities';
    content = matrixMarkup(probability ? STATE.probabilities : STATE.scores, 80, 225, probability ? 'A = row softmax(S)' : 'S = Q0 K0^T / sqrt(2)', 76, 28, probability)
      + notePanel(meta, lang, 500, 205, 350);
  } else if (meta.kind === 'hidden') {
    content = matrixMarkup(STATE.expanded, 60, 225, 'U = GELU(N2 W1)', 55, 28)
      + notePanel(meta, lang, 555, 205, 295);
  } else {
    content = distributionMarkup(eventIndex)
      + notePanel(meta, lang, 640, 205, 210);
    if (eventIndex === 11) {
      const loss = -Math.log(STATE.distribution[5]);
      content += text(650, 375, `CE(target=!): ${loss.toFixed(4)}`, 'tf-loss');
    }
  }
  return panel(25, 118, 850, 285)
    + text(45, 145, title, 'tf-frame-title')
    + text(45, 169, meta.equation, 'tf-equation')
    + content
    + text(850, 390, `${eventIndex + 1} / ${FRAMES.length}`, 'tf-event-count');
}

export function transformerSceneMarkup(lang: Lang): string {
  const railLabels: Array<[string, string]> = [
    ['Embed', 'Embed'],
    ['Norm + QKV', 'Norm + QKV'],
    ['Attention', 'Attention'],
    ['Residual', 'Residual'],
    ['FFN', 'FFN'],
    ['Logits + CE', 'Logits + CE'],
  ];
  const rail = railLabels.map((labels, index) => {
    const x = 30 + index * 141;
    return `<g class="ms-item tf-rail" data-events="${index * 2} ${index * 2 + 1}"><rect class="tf-rail-box" x="${x}" y="76" width="128" height="27" rx="5" />${text(x + 64, 94, labels[lang === 'zh' ? 0 : 1], 'tf-rail-text')}</g>`;
  }).join('');
  const events = FRAMES.map((_, index) => index).join(' ');
  return text(30, 30, lang === 'zh' ? 'Transformer 完整前向：同一张量逐算子计算' : 'Transformer forward: one tensor traced operator by operator', 'ms-title')
    + text(30, 52, lang === 'zh' ? 'B=1, T=4, d=4, heads=2；所有矩阵数值由当前事件确定性重算' : 'B=1, T=4, d=4, heads=2; every matrix is deterministically recomputed per event', 'ms-subtitle')
    + rail
    + `<g class="ms-item tf-live" data-events="${events}"><g data-tf-detail>${detailMarkup(0, lang)}</g></g>`;
}

export function applyTransformerSceneFrame(svg: SVGSVGElement, eventIndex: number): void {
  const lang = svg.dataset.lang;
  if (lang !== 'zh' && lang !== 'en') {
    throw new Error('Transformer scene is missing a valid language');
  }
  const detail = svg.querySelector<SVGGElement>('[data-tf-detail]');
  if (!detail) {
    throw new Error('Transformer dynamic detail group is missing');
  }
  detail.innerHTML = detailMarkup(eventIndex, lang);
}
