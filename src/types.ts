export type Lang = 'zh' | 'en';

export type Theme = 'light' | 'dark';

export type LocaleText = Record<Lang, string>;

export type Category = 'core' | 'data' | 'system';

export type Phase = 'data' | 'forward' | 'loss' | 'backward' | 'update';

export type NodeKind = 'dataset' | 'cpu' | 'gpu' | 'loss' | 'autograd' | 'optimizer';

export type RefKind = 'paper' | 'docs' | 'repo' | 'benchmark' | 'blog' | 'course';

export type InspectorTab = 'overview' | 'deep' | 'roadmap' | 'foundations';

export type TopicGroup = 'training' | 'infra';

export interface KnowledgeRef {
  label: LocaleText;
  note: LocaleText;
  url: string;
  kind: RefKind;
}

export interface KnowledgeTopic {
  id: string;
  /** Omitted means the training-theory group. */
  group?: TopicGroup;
  title: LocaleText;
  summary: LocaleText;
  formula: string;
  points: LocaleText[];
  refs: KnowledgeRef[];
}

export interface LadderItem {
  level: number;
  title: LocaleText;
  gain: LocaleText;
}

export interface TopoNode {
  id: string;
  kind: NodeKind;
  label: LocaleText;
  sub: LocaleText;
  x: number;
  y: number;
}

export interface TopoEdge {
  id: string;
  from: string;
  to: string;
  /** Quadratic control point; when absent a straight line is drawn. */
  bend?: { x: number; y: number };
}

export interface FlowEvent {
  stepIndex: number;
  edgeId: string;
  from: string;
  to: string;
  phase: Phase;
  time: string;
  info: LocaleText;
  size: string;
  packet?: string;
}

export interface LessonStep {
  title: LocaleText;
  subtitle: LocaleText;
  detail: LocaleText;
  formula: string;
  /** Index in FlowEvent[] where this step ends; used to mark it completed. */
  lastEvent: number;
  deepDive: LocaleText[];
  derivation?: LocaleText[];
  workedExample?: LocaleText;
  implementation?: { language: string; code: string };
  advancedExercise?: LocaleText;
  pitfalls: LocaleText[];
  handsOn: LocaleText;
  checkpoints: LocaleText[];
  references: KnowledgeRef[];
}

export interface Fact {
  label: LocaleText;
  value: LocaleText;
}

interface LessonBase {
  id: string;
  code: LocaleText;
  title: LocaleText;
  subtitle: LocaleText;
  category: Category;
}

export interface ReadyLesson extends LessonBase {
  status: 'ready';
  summary: LocaleText;
  phaseLabels?: Record<Phase, LocaleText>;
  facts: Fact[];
  steps: LessonStep[];
  nodes: TopoNode[];
  edges: TopoEdge[];
  events: FlowEvent[];
  principles: LocaleText[];
  resources: KnowledgeRef[];
  ladder: LadderItem[];
  foundations: KnowledgeTopic[];
}

export interface PlannedLesson extends LessonBase {
  status: 'planned';
  stage: number;
  goals: LocaleText[];
  deliverable: LocaleText;
  refs: KnowledgeRef[];
}

export type Lesson = ReadyLesson | PlannedLesson;

export interface AppState {
  lang: Lang;
  theme: Theme;
  category: 'all' | Category;
  activeLessonId: string;
  previewLessonId: string | null;
  activeTab: 'topology' | 'timeline';
  inspectorTab: InspectorTab;
  cursor: number;
  speed: 1 | 2 | 4;
  playing: boolean;
  courseMenuOpen: boolean;
  completedSteps: number[];
}

export interface PersistedState {
  version: 1;
  lang: Lang;
  theme: Theme;
  activeLessonId: string;
  completedSteps: number[];
}
