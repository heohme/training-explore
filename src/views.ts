import type {
  AppState,
  Category,
  InspectorTab,
  KnowledgeRef,
  KnowledgeTopic,
  Lang,
  Lesson,
  LocaleText,
  Phase,
  PlannedLesson,
  ReadyLesson,
  RefKind,
} from './types';
import { fmt, l, refKindLabel, t } from './i18n';
import { lessons } from './data/lessons';
import { esc } from './util';
import { buildTopologySvg } from './topology';

const PHASES: Phase[] = ['data', 'forward', 'loss', 'backward', 'update'];
const CATEGORIES: Array<'all' | Category> = ['all', 'core', 'data', 'system'];

function currentStepIndex(state: AppState, lesson: ReadyLesson): number | null {
  if (state.cursor < 0) {
    return null;
  }
  const event = lesson.events[state.cursor];
  if (!event) {
    throw new Error(`Event index out of range: ${state.cursor}`);
  }
  return event.stepIndex;
}

export function phaseLabel(phase: Phase, lang: Lang, lesson?: ReadyLesson): string {
  const custom = lesson?.phaseLabels?.[phase];
  if (custom) {
    return l(custom, lang);
  }
  switch (phase) {
    case 'data':
      return t('phaseData', lang);
    case 'forward':
      return t('phaseForward', lang);
    case 'loss':
      return t('phaseLoss', lang);
    case 'backward':
      return t('phaseBackward', lang);
    case 'update':
      return t('phaseUpdate', lang);
    default: {
      const exhaustive: never = phase;
      throw new Error(`Unknown phase: ${String(exhaustive)}`);
    }
  }
}

function categoryLabel(category: 'all' | Category, lang: Lang): string {
  switch (category) {
    case 'all':
      return t('catAll', lang);
    case 'core':
      return t('catCore', lang);
    case 'data':
      return t('catData', lang);
    case 'system':
      return t('catSystem', lang);
    default: {
      const exhaustive: never = category;
      throw new Error(`Unknown category: ${String(exhaustive)}`);
    }
  }
}

function iconPlay(): string {
  return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M 4 2.5 L 13 8 L 4 13.5 Z" /></svg>';
}

function iconPause(): string {
  return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M 4 3 L 7 3 L 7 13 L 4 13 Z M 9 3 L 12 3 L 12 13 L 9 13 Z" /></svg>';
}

function iconTheme(theme: AppState['theme']): string {
  if (theme === 'light') {
    return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M 16 12.5 A 7 7 0 0 1 7.5 4 A 6.5 6.5 0 1 0 16 12.5 Z" /></svg>';
  }
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.6" /><path d="M 10 1.5 L 10 4 M 10 16 L 10 18.5 M 1.5 10 L 4 10 M 16 10 L 18.5 10 M 4 4 L 5.8 5.8 M 14.2 14.2 L 16 16 M 16 4 L 14.2 5.8 M 5.8 14.2 L 4 16" /></svg>';
}

function brandLogo(): string {
  return `
    <svg class="te-brand-logo" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M 20 3 L 35 11 L 35 29 L 20 37 L 5 29 L 5 11 Z" />
      <path d="M 5 11 L 20 19 L 35 11 M 20 19 L 20 37" />
      <path d="M 12 7.5 L 27 15.5" />
    </svg>`;
}

export function renderHeaderDynamic(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  const activeStep = currentStepIndex(state, lesson);
  const done = state.completedSteps.length;
  const total = lesson.steps.length;
  const percent = Math.round((done / total) * 100);
  let stageName = t('stepIdle', lang);
  if (activeStep !== null) {
    const step = lesson.steps[activeStep];
    if (!step) {
      throw new Error(`Step index out of range: ${activeStep}`);
    }
    stageName = l(step.title, lang);
  }
  const numbers = lesson.steps
    .map((_, index) => {
      const classes = ['te-stage-num'];
      if (state.completedSteps.includes(index)) {
        classes.push('is-done');
      }
      if (index === activeStep) {
        classes.push('is-active');
      }
      return `<span class="${classes.join(' ')}">${index + 1}</span>`;
    })
    .join('');
  return `
    <div class="te-stage-indicator">
      <div class="te-ind-head"><span>${esc(t('stageLabel', lang))}</span><span class="te-ind-current">${esc(stageName)}</span></div>
      <div class="te-stage-nums">${numbers}</div>
    </div>
    <div class="te-progress">
      <div class="te-progress-head"><span>${esc(t('progress', lang))}</span><strong>${percent}%</strong></div>
      <div class="te-progress-track"><div class="te-progress-fill" style="width:${percent}%"></div></div>
      <div class="te-progress-sub">${esc(fmt.progressDetail(done, activeStep === null ? 0 : 1, total, lang))}</div>
    </div>`;
}

function lessonCard(lesson: Lesson, state: AppState): string {
  const { lang } = state;
  const isActive = lesson.id === state.activeLessonId;
  const isPreview = lesson.id === state.previewLessonId;
  const classes = ['te-lesson'];
  if (isActive) {
    classes.push('is-active');
  }
  if (isPreview) {
    classes.push('is-preview');
  }
  if (lesson.status === 'planned') {
    classes.push('is-planned');
  }
  return `
    <div class="${classes.join(' ')}" data-action="lesson" data-id="${esc(lesson.id)}" role="button" tabindex="0">
      <div class="te-lesson-row">
        <span class="te-status-dot"></span>
        <div class="te-lesson-text">
          <div class="te-lesson-code">${esc(l(lesson.code, lang))}</div>
          <div class="te-lesson-sub">${esc(l(lesson.subtitle, lang))}</div>
        </div>
        ${lesson.status === 'planned' ? `<span class="te-planned-tag">${esc(t('planned', lang))}</span>` : '<span class="te-chevron"></span>'}
      </div>
      ${isActive && lesson.status === 'ready' ? `<div id="te-sidebar-steps" class="te-steps">${renderSidebarSteps(state, lesson)}</div>` : ''}
    </div>`;
}

export function renderSidebarSteps(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  const activeStep = currentStepIndex(state, lesson);
  return lesson.steps
    .map((step, index) => {
      const classes = ['te-step'];
      if (state.completedSteps.includes(index)) {
        classes.push('is-done');
      }
      if (index === activeStep) {
        classes.push('is-active');
      }
      return `
        <div class="${classes.join(' ')}" data-action="goto-step" data-index="${index}" role="button" tabindex="0">
          <span class="te-step-num">${index + 1}</span>
          <div class="te-step-text">
            <div class="te-step-title">${esc(l(step.title, lang))}</div>
            <div class="te-step-sub">${esc(l(step.subtitle, lang))}</div>
          </div>
        </div>`;
    })
    .join('');
}

function sidebar(state: AppState): string {
  const { lang } = state;
  const counts = CATEGORIES.map((category) => ({
    category,
    count: category === 'all' ? lessons.length : lessons.filter((item) => item.category === category).length,
  }));
  const tabs = counts
    .map(
      ({ category, count }) => `
        <button class="te-cat ${state.category === category ? 'is-active' : ''}" data-action="category" data-value="${category}">
          ${esc(categoryLabel(category, lang))}<span>${count}</span>
        </button>`,
    )
    .join('');
  const visible = lessons.filter(
    (item) => state.category === 'all' || item.category === state.category || item.id === state.activeLessonId,
  );
  return `
    <aside class="te-sidebar ${state.courseMenuOpen ? 'is-course-menu-open' : ''}">
      <div class="te-sidebar-head">
        <div class="te-sidebar-title-row">
          <h2>${esc(t('catalogTitle', lang))}</h2>
          <button class="te-course-menu-toggle" data-action="course-menu" aria-expanded="${state.courseMenuOpen}">
            ${esc(l(state.courseMenuOpen ? { zh: '收起', en: 'Close' } : { zh: '选择课程', en: 'Browse' }, lang))}
          </button>
        </div>
        <div class="te-cats">${tabs}</div>
      </div>
      <div class="te-lesson-list">${visible.map((item) => lessonCard(item, state)).join('')}</div>
      <div class="te-sidebar-foot">${esc(t('footerNote', lang))}</div>
    </aside>`;
}

function legend(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  const items = PHASES.map(
    (phase) => `<span class="te-legend-item"><i class="te-dot phase-${phase}"></i>${esc(phaseLabel(phase, lang, lesson))}</span>`,
  ).join('');
  return `<div class="te-legend">${items}<span class="te-legend-note">${esc(t('internalCompute', lang))}</span></div>`;
}

export function renderControls(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  const atEnd = state.cursor >= lesson.events.length - 1;
  const playLabel = state.playing ? t('pause', lang) : t('play', lang);
  return `
    <div class="te-controls">
      <span class="te-pos">${esc(fmt.eventPosition(Math.max(state.cursor + 1, 0), lesson.events.length))}</span>
      <button class="te-speed" data-action="speed" title="1x / 2x / 4x">${state.speed}x</button>
      <button class="te-btn te-btn-play ${state.playing ? 'is-playing' : ''}" data-action="play">
        ${state.playing ? iconPause() : iconPlay()}<span>${esc(playLabel)}</span>
      </button>
      <button class="te-btn" data-action="step" ${atEnd ? 'disabled' : ''}>${esc(t('singleStep', lang))}</button>
      <button class="te-btn" data-action="reset">${esc(t('reset', lang))}</button>
    </div>`;
}

export function renderTableRows(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  const byId = new Map(lesson.nodes.map((node) => [node.id, node]));
  return lesson.events
    .map((event, index) => {
      const from = byId.get(event.from);
      const to = byId.get(event.to);
      if (!from || !to) {
        throw new Error(`Event references unknown node: ${index}`);
      }
      const classes = ['te-row', `phase-${event.phase}`];
      if (index === state.cursor) {
        classes.push('is-current');
      } else if (index < state.cursor) {
        classes.push('is-past');
      }
      return `
        <tr class="${classes.join(' ')}" data-action="event" data-index="${index}">
          <td data-label="${esc(t('colNo', lang))}"><span class="te-row-no">${index + 1}</span></td>
          <td class="te-mono" data-label="${esc(t('colTime', lang))}">${esc(event.time)}</td>
          <td data-label="${esc(t('colFrom', lang))}">${esc(l(from.label, lang))}</td>
          <td data-label="${esc(t('colTo', lang))}">${esc(l(to.label, lang))}</td>
          <td data-label="${esc(t('colPhase', lang))}"><span class="te-badge phase-${event.phase}">${esc(phaseLabel(event.phase, lang, lesson))}</span></td>
          <td class="te-row-info" data-label="${esc(t('colInfo', lang))}">${esc(l(event.info, lang))}</td>
          <td class="te-mono" data-label="${esc(t('colSize', lang))}">${esc(event.size)}</td>
        </tr>`;
    })
    .join('');
}

function tableHead(state: AppState): string {
  const { lang } = state;
  const keys = ['colNo', 'colTime', 'colFrom', 'colTo', 'colPhase', 'colInfo', 'colSize'] as const;
  return `<tr>${keys.map((key) => `<th>${esc(t(key, lang))}</th>`).join('')}</tr>`;
}

export function renderTimelineStrip(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  const timed = lesson.events.map((event, index) => {
    const ms = Number.parseFloat(event.time);
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error(`Invalid event time: ${event.time}`);
    }
    return { event, index, ms };
  });
  const maxTime = Math.max(...timed.map((item) => item.ms));
  if (maxTime <= 0) {
    throw new Error('Timeline has no positive durations');
  }
  const items = timed
    .map(({ event, index, ms }) => {
      const classes = ['te-strip-item', `phase-${event.phase}`];
      if (index === state.cursor) {
        classes.push('is-current');
      } else if (index < state.cursor) {
        classes.push('is-past');
      }
      const height = Math.round(40 + (ms / maxTime) * 150);
      return `
        <button class="${classes.join(' ')}" data-action="event" data-index="${index}" title="${esc(l(event.info, lang))}">
          <span class="te-strip-no">${index + 1}</span>
          <span class="te-strip-bar" style="height:${height}px"></span>
          <span class="te-strip-time">${esc(event.time)}</span>
        </button>`;
    })
    .join('');
  const hint = l({ zh: '条高表示相对耗时', en: 'Bar height shows relative elapsed time' }, lang);
  return `
    <div class="te-strip-head"><span>${esc(t('tabTimeline', lang))} · ${esc(hint)}</span><span>${esc(fmt.eventCount(lesson.events.length, lang))}</span></div>
    <div class="te-strip-track">${items}</div>`;
}

function topologyView(state: AppState, lesson: ReadyLesson): string {
  return `<div class="te-topology" id="te-topology">${buildTopologySvg(lesson, state.lang)}</div>`;
}

function stage(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  return `
    <main class="te-stage ${state.activeTab === 'timeline' ? 'is-timeline' : ''}" id="te-stage">
      <div class="te-stage-bar">
        <div class="te-stage-tabs">
          <button class="${state.activeTab === 'topology' ? 'is-active' : ''}" data-action="tab" data-value="topology">${esc(t('tabTopology', lang))}</button>
          <button class="${state.activeTab === 'timeline' ? 'is-active' : ''}" data-action="tab" data-value="timeline">${esc(t('tabTimeline', lang))}</button>
        </div>
        <span class="te-stage-title">${esc(l(lesson.title, lang))} / ${esc(t('packetFlow', lang))}</span>
        <span class="te-mobile-pan-hint">${esc(l({ zh: '左右滑动查看完整拓扑', en: 'Swipe to explore the full topology' }, lang))}</span>
      </div>
      <div class="te-stage-view">
        ${topologyView(state, lesson)}
        <div class="te-strip" id="te-strip">${renderTimelineStrip(state, lesson)}</div>
      </div>
      <section class="te-flow">
        <div class="te-flow-head">
          <div class="te-flow-title"><h3>${esc(t('packetFlow', lang))}</h3>${legend(state, lesson)}</div>
          <div id="te-controls">${renderControls(state, lesson)}</div>
        </div>
        <div class="te-table-wrap" id="te-table-wrap">
          <table class="te-table">
            <thead>${tableHead(state)}</thead>
            <tbody id="te-table-body">${renderTableRows(state, lesson)}</tbody>
          </table>
        </div>
        <div class="te-flow-note">${esc(t('illustrative', lang))}</div>
      </section>
    </main>`;
}

export function renderStepCard(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  const activeStep = currentStepIndex(state, lesson);
  if (activeStep === null) {
    return `
      <div class="te-stepcard is-idle">
        <div class="te-stepcard-head"><span>${esc(t('currentStep', lang))}</span><span class="te-chip">${esc(t('stepIdle', lang))}</span></div>
        <p class="te-stepcard-hint">${esc(t('singleStep', lang))} / ${esc(t('play', lang))}</p>
      </div>`;
  }
  const step = lesson.steps[activeStep];
  if (!step) {
    throw new Error(`Step index out of range: ${activeStep}`);
  }
  const stateLabel = state.completedSteps.includes(activeStep)
    ? t('stepCompleted', lang)
    : t('stepActive', lang);
  return `
    <div class="te-stepcard">
      <div class="te-stepcard-head"><span>${esc(t('currentStep', lang))}</span><span class="te-chip">${esc(stateLabel)}</span></div>
      <h4>${esc(fmt.stepIndex(activeStep, lang))} · ${esc(l(step.title, lang))}</h4>
      <p class="te-stepcard-detail">${esc(l(step.detail, lang))}</p>
      <div class="te-formula-label">${esc(t('formula', lang))}</div>
      <pre class="te-formula">${esc(step.formula)}</pre>
    </div>`;
}

function section(title: string, body: string): string {
  return `<section class="te-section"><h4 class="te-section-title">${esc(title)}</h4>${body}</section>`;
}

function bullets(
  items: LocaleText[],
  lang: Lang,
  variant: 'deep' | 'pitfall' | 'check' | 'plain' = 'deep',
): string {
  return `<ul class="te-list te-list--${variant}">${items
    .map(
      (item, index) => `
        <li><span class="te-list-no">${index + 1}</span><span>${esc(l(item, lang))}</span></li>`,
    )
    .join('')}</ul>`;
}

function renderRefList(refs: KnowledgeRef[], lang: Lang): string {
  return `<ul class="te-ref-list">${refs
    .map(
      (item) => `
        <li class="te-ref">
          <div class="te-ref-head">
            <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(l(item.label, lang))}</a>
            <span class="te-ref-kind">${esc(refKindLabel(item.kind, lang))}</span>
          </div>
          <p>${esc(l(item.note, lang))}</p>
        </li>`,
    )
    .join('')}</ul>`;
}

function renderOverviewBody(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  const facts = lesson.facts
    .map(
      (fact) => `<div class="te-fact"><dt>${esc(l(fact.label, lang))}</dt><dd>${esc(l(fact.value, lang))}</dd></div>`,
    )
    .join('');
  return `
    <div class="te-inspector-head"><h2>${esc(t('lessonOverview', lang))}</h2><span class="te-chip is-learning">${esc(t('statusLearning', lang))}</span></div>
    <h3 class="te-inspector-title">${esc(l(lesson.title, lang))}</h3>
    <p class="te-inspector-sub">${esc(l(lesson.subtitle, lang))}</p>
    <p class="te-summary">${esc(l(lesson.summary, lang))}</p>
    <dl class="te-facts">${facts}</dl>
    <div class="te-divider"></div>
    <div id="te-step-card">${renderStepCard(state, lesson)}</div>`;
}

export function renderDeepBody(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  const activeStep = currentStepIndex(state, lesson);
  if (activeStep === null) {
    return `<div class="te-panel-hint">${esc(t('deepHint', lang))}</div>`;
  }
  const step = lesson.steps[activeStep];
  if (!step) {
    throw new Error(`Step index out of range: ${activeStep}`);
  }
  return `
    <div class="te-inspector-head"><h2>${esc(t('tabDeep', lang))}</h2><span class="te-chip">${esc(fmt.stepIndex(activeStep, lang))}</span></div>
    <h3 class="te-inspector-title">${esc(l(step.title, lang))}</h3>
    <p class="te-inspector-sub">${esc(l(step.subtitle, lang))}</p>
    <div class="te-formula-label">${esc(t('formula', lang))}</div>
    <pre class="te-formula">${esc(step.formula)}</pre>
    ${section(t('sectionDeepDive', lang), bullets(step.deepDive, lang))}
    ${step.derivation ? section(t('sectionDerivation', lang), bullets(step.derivation, lang)) : ''}
    ${step.workedExample ? section(t('sectionWorkedExample', lang), `<p class="te-worked-example">${esc(l(step.workedExample, lang))}</p>`) : ''}
    ${step.implementation ? section(t('sectionImplementation', lang), `<pre class="te-code" data-language="${esc(step.implementation.language)}"><code>${esc(step.implementation.code)}</code></pre>`) : ''}
    ${step.advancedExercise ? section(t('sectionAdvancedExercise', lang), `<p class="te-hands-on">${esc(l(step.advancedExercise, lang))}</p>`) : ''}
    ${section(t('sectionPitfalls', lang), bullets(step.pitfalls, lang, 'pitfall'))}
    ${section(t('sectionHandsOn', lang), `<p class="te-hands-on">${esc(l(step.handsOn, lang))}</p>`)}
    ${section(t('sectionCheckpoints', lang), bullets(step.checkpoints, lang, 'check'))}
    ${section(t('sectionReferences', lang), renderRefList(step.references, lang))}`;
}

function renderRoadmapBody(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  const ladder = `<ol class="te-ladder">${lesson.ladder
    .map(
      (item) => `
        <li class="te-ladder-item">
          <span class="te-ladder-no">${esc(fmt.ladderLevel(item.level, lang))}</span>
          <div>
            <div class="te-ladder-title">${esc(l(item.title, lang))}</div>
            <div class="te-ladder-gain">${esc(l(item.gain, lang))}</div>
          </div>
        </li>`,
    )
    .join('')}</ol>`;
  const kinds: RefKind[] = ['paper', 'course', 'docs', 'repo', 'benchmark', 'blog'];
  const groups = kinds
    .map((kind) => {
      const group = lesson.resources.filter((item) => item.kind === kind);
      if (group.length === 0) {
        return '';
      }
      return section(`${refKindLabel(kind, lang)} (${group.length})`, renderRefList(group, lang));
    })
    .join('');
  return `
    <div class="te-inspector-head"><h2>${esc(t('tabRoadmap', lang))}</h2><span class="te-chip">${lesson.ladder.length} LV</span></div>
    <p class="te-summary">${esc(t('roadmapNote', lang))}</p>
    ${section(t('sectionLadder', lang), ladder)}
    ${section(t('sectionPrinciples', lang), bullets(lesson.principles, lang, 'plain'))}
    <h4 class="te-section-title">${esc(t('sectionResources', lang))}</h4>
    <p class="te-section-hint">${esc(t('resourceNote', lang))}</p>
    ${groups}`;
}

function renderFoundationsBody(state: AppState, lesson: ReadyLesson): string {
  const { lang } = state;
  const renderTopic = (topic: KnowledgeTopic, index: number): string => `
    <article class="te-topic">
      <div class="te-topic-head">
        <span class="te-topic-no">${String(index + 1).padStart(2, '0')}</span>
        <h4 class="te-topic-title">${esc(l(topic.title, lang))}</h4>
      </div>
      <p class="te-topic-summary">${esc(l(topic.summary, lang))}</p>
      <pre class="te-topic-formula">${esc(topic.formula)}</pre>
      ${bullets(topic.points, lang)}
      <div class="te-topic-refs">${renderRefList(topic.refs, lang)}</div>
    </article>`;
  const groups: Array<{ id: NonNullable<KnowledgeTopic['group']>; label: string }> = [
    { id: 'training', label: t('topicGroupTraining', lang) },
    { id: 'infra', label: t('topicGroupInfra', lang) },
  ];
  const sections = groups
    .map((group) => {
      const items = lesson.foundations
        .map((topic, index) => ({ topic, index }))
        .filter(({ topic }) => (topic.group ?? 'training') === group.id);
      if (items.length === 0) {
        return '';
      }
      return `
        <h4 class="te-topic-group">${esc(group.label)} <span>${items.length}</span></h4>
        ${items.map(({ topic, index }) => renderTopic(topic, index)).join('')}`;
    })
    .join('');
  return `
    <div class="te-inspector-head"><h2>${esc(t('tabFoundations', lang))}</h2><span class="te-chip">${lesson.foundations.length} TOPICS</span></div>
    <p class="te-summary">${esc(t('foundationsNote', lang))}</p>
    ${sections}`;
}

function renderPlannedPanel(state: AppState, planned: PlannedLesson): string {
  const { lang } = state;
  return `
    <div class="te-inspector-head"><h2>${esc(t('lessonOverview', lang))}</h2><span class="te-chip">${esc(fmt.stageLabel(planned.stage, lang))}</span></div>
    <h3 class="te-inspector-title">${esc(l(planned.title, lang))}</h3>
    <p class="te-inspector-sub">${esc(l(planned.subtitle, lang))}</p>
    <p class="te-summary">${esc(t('plannedBody', lang))}</p>
    ${section(t('sectionGoals', lang), bullets(planned.goals, lang, 'plain'))}
    ${section(t('sectionDeliverable', lang), `<p class="te-hands-on">${esc(l(planned.deliverable, lang))}</p>`)}
    ${section(t('sectionReferences', lang), renderRefList(planned.refs, lang))}
    <button class="te-btn te-back" data-action="back">${esc(t('overview', lang))}</button>`;
}

function inspectorTabs(state: AppState): string {
  const { lang } = state;
  const items: Array<{ id: InspectorTab; label: string }> = [
    { id: 'overview', label: t('overview', lang) },
    { id: 'deep', label: t('tabDeep', lang) },
    { id: 'roadmap', label: t('tabRoadmap', lang) },
    { id: 'foundations', label: t('tabFoundations', lang) },
  ];
  return `<div class="te-inspector-tabs">${items
    .map(
      (item) => `
        <button class="${state.inspectorTab === item.id ? 'is-active' : ''}" data-action="inspector-tab" data-value="${item.id}">${esc(item.label)}</button>`,
    )
    .join('')}</div>`;
}

export function renderInspectorBody(state: AppState, lesson: Lesson): string {
  if (state.previewLessonId) {
    const preview = lessons.find((item) => item.id === state.previewLessonId);
    if (!preview) {
      throw new Error(`Unknown preview lesson: ${state.previewLessonId}`);
    }
    if (preview.status !== 'planned') {
      throw new Error('Preview must be a planned lesson');
    }
    return renderPlannedPanel(state, preview);
  }
  if (lesson.status !== 'ready') {
    throw new Error('Inspector requires a ready lesson');
  }
  const tabs = inspectorTabs(state);
  switch (state.inspectorTab) {
    case 'overview':
      return `${tabs}${renderOverviewBody(state, lesson)}`;
    case 'deep':
      return `${tabs}<div id="te-deep-body">${renderDeepBody(state, lesson)}</div>`;
    case 'roadmap':
      return `${tabs}${renderRoadmapBody(state, lesson)}`;
    case 'foundations':
      return `${tabs}${renderFoundationsBody(state, lesson)}`;
    default: {
      const exhaustive: never = state.inspectorTab;
      throw new Error(`Unknown inspector tab: ${String(exhaustive)}`);
    }
  }
}

export function renderShell(state: AppState, lesson: Lesson): string {
  const { lang } = state;
  const readyLesson = lessons.find((item) => item.id === state.activeLessonId);
  if (!readyLesson || readyLesson.status !== 'ready') {
    throw new Error(`Active lesson is not ready: ${state.activeLessonId}`);
  }
  const headerNow = `
    <div class="te-header-now">
      <div class="te-kicker">${esc(t('nowLearning', lang))}</div>
      <div class="te-now-title">${esc(l(readyLesson.code, lang))}</div>
      <div class="te-now-sub">${esc(t('overview', lang))} · ${esc(fmt.stepCount(readyLesson.steps.length, lang))}</div>
    </div>`;
  return `
    <div class="te-app">
      <header class="te-header">
        <div class="te-brand">
          ${brandLogo()}
          <div>
            <h1>${esc(t('brandFirst', lang))} <span>${esc(t('brandSecond', lang))}</span></h1>
            <p>${esc(t('brandSubtitle', lang))}</p>
          </div>
        </div>
        ${headerNow}
        <div class="te-header-dynamic" id="te-header-dynamic">${renderHeaderDynamic(state, readyLesson)}</div>
        <div class="te-header-actions">
          <div class="te-credit">
            <span>${esc(t('designCredit', lang))}</span>
            <a href="https://protocol-explorer-alpha.vercel.app/" target="_blank" rel="noopener noreferrer">${esc(t('designTarget', lang))}</a>
          </div>
          <button class="te-icon-btn te-lang" data-action="lang" title="${esc(t('langToggle', lang))}">${esc(t('langToggle', lang))}</button>
          <button class="te-icon-btn" data-action="theme" title="${esc(state.theme === 'light' ? t('themeDark', lang) : t('themeLight', lang))}">${iconTheme(state.theme)}</button>
        </div>
      </header>
      <div class="te-workspace">
        ${sidebar(state)}
        ${stage(state, readyLesson)}
        <aside class="te-inspector" id="te-inspector">${renderInspectorBody(state, lesson)}</aside>
      </div>
    </div>`;
}

export function renderFatal(message: string, lang: Lang): string {
  return `
    <div class="te-fatal" role="alert">
      <h1>${esc(t('errorTitle', lang))}</h1>
      <p>${esc(message)}</p>
      <button class="te-btn" data-action="clear-storage">${esc(l({ zh: '清除本地进度并重载', en: 'Clear saved progress and reload' }, lang))}</button>
    </div>`;
}
