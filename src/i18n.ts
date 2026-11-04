import type { Lang, LocaleText, RefKind } from './types';

const zh = {
  brandFirst: 'TRAINING',
  brandSecond: 'EXPLORER',
  brandSubtitle: '了解大模型如何训练',
  nowLearning: '正在学习',
  overview: '概览',
  stageLabel: '训练阶段',
  progress: '学习进度',
  designCredit: '设计参考',
  designTarget: 'Protocol Explorer',
  catalogTitle: '训练课程',
  catAll: '全部',
  catCore: '核心',
  catData: '数据',
  catSystem: '系统',
  planned: '筹备中',
  statusLearning: '学习中',
  statusAvailable: '可学习',
  tabTopology: '模型',
  tabTimeline: '时序',
  tabDeep: '深入',
  tabRoadmap: '路线',
  tabFoundations: '专题',
  lessonOverview: '课程概览',
  packetFlow: '运行事件',
  phaseData: '数据',
  phaseForward: '前向',
  phaseLoss: '损失',
  phaseBackward: '反向',
  phaseUpdate: '更新',
  internalCompute: '对象状态变化',
  play: '播放',
  pause: '暂停',
  singleStep: '单步',
  reset: '重置',
  colNo: '序号',
  colTime: '时间',
  colFrom: '源节点',
  colTo: '目标节点',
  colPhase: '阶段',
  colInfo: '信息',
  colSize: '规模',
  formula: '公式',
  currentStep: '当前步骤',
  stepIdle: '尚未开始',
  stepActive: '进行中',
  stepCompleted: '已完成',
  illustrative: '表中数值为教学示意，非实测基准',
  plannedBody: '该课程尚未写成完整动画课程，但下方已给出 Stage 目标、产出物与推荐资料，可以按此先行实践。当前可播放的是训练主循环。',
  sectionDeepDive: '核心概念',
  sectionDerivation: '数学与形状推导',
  sectionWorkedExample: '具体数值例',
  sectionImplementation: '最小实现',
  sectionAdvancedExercise: '进阶实验',
  sectionPitfalls: '常见失败模式',
  sectionHandsOn: '动手产出',
  sectionCheckpoints: '自测',
  sectionReferences: '文献与文档',
  sectionPrinciples: '学习原则',
  sectionLadder: '项目阶梯',
  sectionResources: '精选资源',
  sectionGoals: '本阶段目标',
  sectionDeliverable: '产出物',
  deepHint: '播放或单步后，这里显示当前步骤的深入讲解',
  resourceNote: '链接在新标签页打开；优先读官方文档与原始论文',
  roadmapNote: '从单卡训练循环一路到 agent 能力与可靠性评测',
  foundationsNote: '从约束推导设计：训练原理与调试、AI Infra 量化分析，数字均取自公开教材、开源书稿与原始论文',
  topicGroupTraining: '训练原理与调试',
  topicGroupInfra: 'AI Infra 量化分析',
  refPaper: '论文',
  refDocs: '文档',
  refRepo: '项目',
  refBenchmark: '基准',
  refBlog: '文章',
  refCourse: '课程',
  errorTitle: '页面加载失败',
  storageError: '本地进度数据已损坏，请清除站点存储后刷新。',
  langToggle: 'EN',
  themeLight: '切换到浅色',
  themeDark: '切换到深色',
  footerNote: '本地运行，进度仅保存在此浏览器',
} as const;

type UIKey = keyof typeof zh;

const en: Record<UIKey, string> = {
  brandFirst: 'TRAINING',
  brandSecond: 'EXPLORER',
  brandSubtitle: 'Learn how LLMs are trained',
  nowLearning: 'NOW LEARNING',
  overview: 'OVERVIEW',
  stageLabel: 'TRAINING STAGE',
  progress: 'PROGRESS',
  designCredit: 'DESIGN REFERENCE',
  designTarget: 'Protocol Explorer',
  catalogTitle: 'LESSONS',
  catAll: 'ALL',
  catCore: 'CORE',
  catData: 'DATA',
  catSystem: 'SYSTEM',
  planned: 'PLANNED',
  statusLearning: 'IN PROGRESS',
  statusAvailable: 'AVAILABLE',
  tabTopology: 'MODEL',
  tabTimeline: 'TIMELINE',
  tabDeep: 'DEEP DIVE',
  tabRoadmap: 'ROADMAP',
  tabFoundations: 'TOPICS',
  lessonOverview: 'LESSON OVERVIEW',
  packetFlow: 'EXECUTION EVENTS',
  phaseData: 'DATA',
  phaseForward: 'FORWARD',
  phaseLoss: 'LOSS',
  phaseBackward: 'BACKWARD',
  phaseUpdate: 'UPDATE',
  internalCompute: 'OBJECT STATE',
  play: 'PLAY',
  pause: 'PAUSE',
  singleStep: 'STEP',
  reset: 'RESET',
  colNo: 'NO.',
  colTime: 'TIME',
  colFrom: 'SOURCE',
  colTo: 'DEST',
  colPhase: 'PHASE',
  colInfo: 'INFO',
  colSize: 'SIZE',
  formula: 'FORMULA',
  currentStep: 'CURRENT STEP',
  stepIdle: 'NOT STARTED',
  stepActive: 'IN PROGRESS',
  stepCompleted: 'COMPLETED',
  illustrative: 'Values are illustrative, not measured benchmarks',
  plannedBody: 'This lesson is not a full animated course yet, but the stage goals, deliverable and recommended resources below are ready to work through. The playable lesson is Training Loop.',
  sectionDeepDive: 'CORE CONCEPTS',
  sectionDerivation: 'MATH & SHAPE DERIVATION',
  sectionWorkedExample: 'WORKED NUMERICAL EXAMPLE',
  sectionImplementation: 'MINIMAL IMPLEMENTATION',
  sectionAdvancedExercise: 'ADVANCED EXPERIMENT',
  sectionPitfalls: 'FAILURE MODES',
  sectionHandsOn: 'HANDS-ON',
  sectionCheckpoints: 'CHECKPOINTS',
  sectionReferences: 'REFERENCES',
  sectionPrinciples: 'PRINCIPLES',
  sectionLadder: 'PROJECT LADDER',
  sectionResources: 'CURATED RESOURCES',
  sectionGoals: 'STAGE GOALS',
  sectionDeliverable: 'DELIVERABLE',
  deepHint: 'Play or step forward to see the deep dive for the current step',
  resourceNote: 'Links open in a new tab; prefer official docs and original papers',
  roadmapNote: 'From a single-GPU training loop to agent capability and reliability evals',
  foundationsNote: 'Deriving designs from constraints: training theory, debugging and quantitative AI Infra, with figures from open textbooks, book drafts and original papers',
  topicGroupTraining: 'TRAINING THEORY & DEBUGGING',
  topicGroupInfra: 'AI INFRA QUANTITATIVE DESIGN',
  refPaper: 'PAPER',
  refDocs: 'DOCS',
  refRepo: 'REPO',
  refBenchmark: 'BENCHMARK',
  refBlog: 'BLOG',
  refCourse: 'COURSE',
  errorTitle: 'FAILED TO LOAD',
  storageError: 'Saved progress is corrupted. Clear site storage and reload.',
  langToggle: 'ZH',
  themeLight: 'Switch to light',
  themeDark: 'Switch to dark',
  footerNote: 'Runs locally; progress is stored in this browser only',
};

export function t(key: UIKey, lang: Lang): string {
  const dict: Record<UIKey, string> = lang === 'zh' ? zh : en;
  const value = dict[key];
  if (value === undefined) {
    throw new Error(`Missing UI translation: ${key} / ${lang}`);
  }
  return value;
}

export function l(text: LocaleText, lang: Lang): string {
  const value = text[lang];
  if (value === undefined) {
    throw new Error(`Missing lesson translation for ${lang}`);
  }
  return value;
}

const REF_LABEL: Record<RefKind, UIKey> = {
  paper: 'refPaper',
  docs: 'refDocs',
  repo: 'refRepo',
  benchmark: 'refBenchmark',
  blog: 'refBlog',
  course: 'refCourse',
};

export function refKindLabel(kind: RefKind, lang: Lang): string {
  return t(REF_LABEL[kind], lang);
}

export const fmt = {
  stepCount: (n: number, lang: Lang): string =>
    lang === 'zh' ? `共 ${n} 步` : `${n} STEPS`,
  progressDetail: (done: number, active: number, total: number, lang: Lang): string =>
    lang === 'zh'
      ? `${done} / ${total} 已完成 · ${active} 进行中`
      : `${done} / ${total} DONE · ${active} ACTIVE`,
  eventPosition: (current: number, total: number): string => `${current} / ${total}`,
  eventCount: (n: number, lang: Lang): string =>
    lang === 'zh' ? `共 ${n} 条` : `${n} EVENTS`,
  stepIndex: (i: number, lang: Lang): string =>
    lang === 'zh' ? `第 ${i + 1} 步` : `STEP ${i + 1}`,
  stageLabel: (n: number, lang: Lang): string =>
    lang === 'zh' ? `第 ${n} 阶段` : `STAGE ${n}`,
  ladderLevel: (n: number, lang: Lang): string =>
    lang === 'zh' ? `第 ${n} 级` : `LV ${n}`,
};
