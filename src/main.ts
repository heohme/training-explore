import './style.css';
import type { AppState, Lang, Lesson, ReadyLesson } from './types';
import { t } from './i18n';
import { getLesson, getReadyLesson } from './data/lessons';
import {
  clearStoredState,
  completedStepsForCursor,
  loadState,
  saveState,
  StorageError,
} from './state';
import {
  renderControls,
  renderDeepBody,
  renderFatal,
  renderHeaderDynamic,
  renderInspectorBody,
  renderShell,
  renderSidebarSteps,
  renderStepCard,
  renderTableRows,
  renderTimelineStrip,
} from './views';
import { createPacketAnimator, type PacketAnimator } from './topology';
import { Player } from './player';

const BASE_INTERVAL_MS = 1100;

const root = document.getElementById('app');
if (!root) {
  throw new Error('Missing #app container');
}
const app: HTMLElement = root;

let state: AppState;
let animator: PacketAnimator | null = null;
let player: Player;

function intervalMs(): number {
  return BASE_INTERVAL_MS / state.speed;
}

function animationMs(): number {
  return intervalMs() * 0.8;
}

function readyLesson(): ReadyLesson {
  return getReadyLesson(state.activeLessonId);
}

function requireAnimator(): PacketAnimator {
  if (!animator) {
    throw new Error('Topology animator is not initialized');
  }
  return animator;
}

function setHtml(id: string, html: string): void {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing DOM region: ${id}`);
  }
  element.innerHTML = html;
}

function setOptionalHtml(id: string, html: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.innerHTML = html;
  }
}

function highlightNodes(lesson: ReadyLesson): void {
  const event = state.cursor >= 0 ? lesson.events[state.cursor] : undefined;
  const activeIds = event ? [event.from, event.to] : [];
  const nodes = app.querySelectorAll<SVGGElement>('g.te-node');
  nodes.forEach((node) => {
    const id = node.dataset.nodeId;
    if (id === undefined) {
      throw new Error('Topology node is missing data-node-id');
    }
    node.classList.toggle('is-active', activeIds.includes(id));
  });
}

function scrollCurrentRow(): void {
  const row = app.querySelector<HTMLElement>('tr.te-row.is-current');
  const container = row?.closest<HTMLElement>('.te-table-wrap');
  if (!row || !container) {
    return;
  }
  const rowTop = row.offsetTop;
  const rowBottom = rowTop + row.offsetHeight;
  if (rowTop < container.scrollTop) {
    container.scrollTop = rowTop;
  } else if (rowBottom > container.scrollTop + container.clientHeight) {
    container.scrollTop = rowBottom - container.clientHeight;
  }
}

function updatePlaybackDom(animate: boolean): void {
  const lesson = readyLesson();
  setHtml('te-header-dynamic', renderHeaderDynamic(state, lesson));
  setHtml('te-sidebar-steps', renderSidebarSteps(state, lesson));
  setHtml('te-controls', renderControls(state, lesson));
  setHtml('te-table-body', renderTableRows(state, lesson));
  setHtml('te-strip', renderTimelineStrip(state, lesson));
  setOptionalHtml('te-step-card', renderStepCard(state, lesson));
  setOptionalHtml('te-deep-body', renderDeepBody(state, lesson));
  highlightNodes(lesson);
  scrollCurrentRow();
  const event = state.cursor >= 0 ? lesson.events[state.cursor] : undefined;
  if (event) {
    requireAnimator().run(event.edgeId, event.phase, animate ? animationMs() : 0, event.packet, state.cursor);
  } else {
    requireAnimator().stop();
  }
}

function renderControlsOnly(): void {
  setHtml('te-controls', renderControls(state, readyLesson()));
}

function fullRender(): void {
  state.playing = false;
  player.stop();
  if (animator) {
    animator.stop();
  }
  const lesson: Lesson = getLesson(state.activeLessonId);
  app.innerHTML = renderShell(state, lesson);
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.lang;
  document.title = `${t('brandFirst', state.lang)} ${t('brandSecond', state.lang)} - ${t('brandSubtitle', state.lang)}`;
  const svg = app.querySelector<SVGSVGElement>('svg.te-svg');
  if (!svg) {
    throw new Error('Topology SVG is missing after render');
  }
  animator = createPacketAnimator(svg);
  updatePlaybackDom(false);
}

function advance(): boolean {
  const lesson = readyLesson();
  if (state.cursor >= lesson.events.length - 1) {
    return false;
  }
  state.cursor += 1;
  state.completedSteps = completedStepsForCursor(lesson, state.cursor, state.completedSteps);
  saveState(state);
  updatePlaybackDom(true);
  return state.cursor < lesson.events.length - 1;
}

function finishPlay(): void {
  state.playing = false;
  renderControlsOnly();
}

function pausePlay(): void {
  if (!state.playing && !player.running) {
    return;
  }
  player.stop();
  state.playing = false;
  renderControlsOnly();
}

function startPlay(): void {
  const lesson = readyLesson();
  if (state.cursor >= lesson.events.length - 1) {
    state.cursor = -1;
    updatePlaybackDom(false);
  }
  state.playing = true;
  renderControlsOnly();
  if (advance()) {
    player.start();
  } else {
    finishPlay();
  }
}

function singleStep(): void {
  pausePlay();
  if (state.cursor < readyLesson().events.length - 1) {
    advance();
  }
}

function resetCursor(): void {
  pausePlay();
  state.cursor = -1;
  updatePlaybackDom(false);
}

function retreat(): void {
  pausePlay();
  if (state.cursor <= -1) {
    return;
  }
  state.cursor -= 1;
  updatePlaybackDom(state.cursor >= 0);
}

function jumpTo(index: number): void {
  const lesson = readyLesson();
  if (index < 0 || index >= lesson.events.length) {
    throw new Error(`Event index out of range: ${index}`);
  }
  pausePlay();
  state.cursor = index;
  state.completedSteps = completedStepsForCursor(lesson, index, state.completedSteps);
  saveState(state);
  updatePlaybackDom(true);
}

function jumpToStep(index: number): void {
  const lesson = readyLesson();
  if (index < 0 || index >= lesson.steps.length) {
    throw new Error(`Step index out of range: ${index}`);
  }
  const previous = index === 0 ? undefined : lesson.steps[index - 1];
  if (index > 0 && !previous) {
    throw new Error(`Step index out of range: ${index - 1}`);
  }
  jumpTo(previous ? previous.lastEvent + 1 : 0);
}

function toggleSpeed(): void {
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1;
  if (player.running) {
    player.stop();
    player.start();
  }
  renderControlsOnly();
}

function requireIndex(element: HTMLElement): number {
  const raw = element.dataset.index;
  if (raw === undefined) {
    throw new Error('Missing data-index');
  }
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid data-index: ${raw}`);
  }
  return value;
}

function requireValue(element: HTMLElement): string {
  const value = element.dataset.value;
  if (value === undefined) {
    throw new Error('Missing data-value');
  }
  return value;
}

function handleClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
  if (!target) {
    return;
  }
  switch (target.dataset.action) {
    case 'play':
      if (state.playing) {
        pausePlay();
      } else {
        startPlay();
      }
      break;
    case 'step':
      singleStep();
      break;
    case 'reset':
      resetCursor();
      break;
    case 'speed':
      toggleSpeed();
      break;
    case 'event':
      jumpTo(requireIndex(target));
      break;
    case 'goto-step':
      jumpToStep(requireIndex(target));
      break;
    case 'lesson': {
      const id = target.dataset.id;
      if (id === undefined) {
        throw new Error('Missing data-id on lesson card');
      }
      const lesson = getLesson(id);
      if (lesson.status === 'ready') {
        if (id === state.activeLessonId && state.previewLessonId === null) {
          break;
        }
        state.activeLessonId = id;
        state.previewLessonId = null;
        state.cursor = -1;
        state.completedSteps = [];
        state.courseMenuOpen = false;
        saveState(state);
      } else {
        state.previewLessonId = id;
      }
      fullRender();
      break;
    }
    case 'course-menu':
      state.courseMenuOpen = !state.courseMenuOpen;
      fullRender();
      break;
    case 'back':
      state.previewLessonId = null;
      fullRender();
      break;
    case 'category': {
      const value = requireValue(target);
      if (value !== 'all' && value !== 'core' && value !== 'data' && value !== 'system') {
        throw new Error(`Unknown category: ${value}`);
      }
      state.category = value;
      fullRender();
      break;
    }
    case 'tab': {
      const value = requireValue(target);
      if (value !== 'topology' && value !== 'timeline') {
        throw new Error(`Unknown tab: ${value}`);
      }
      state.activeTab = value;
      fullRender();
      break;
    }
    case 'inspector-tab': {
      const value = requireValue(target);
      if (value !== 'overview' && value !== 'deep' && value !== 'roadmap' && value !== 'foundations') {
        throw new Error(`Unknown inspector tab: ${value}`);
      }
      state.inspectorTab = value;
      setHtml('te-inspector', renderInspectorBody(state, getLesson(state.activeLessonId)));
      break;
    }
    case 'lang':
      state.lang = state.lang === 'zh' ? 'en' : 'zh';
      saveState(state);
      fullRender();
      break;
    case 'theme':
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      saveState(state);
      fullRender();
      break;
    default:
      break;
  }
}

function handleKeydown(event: KeyboardEvent): void {
  const focused = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action][tabindex]') : null;
  if (focused && focused.tagName !== 'BUTTON') {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      focused.click();
    }
    return;
  }
  if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) {
    return;
  }
  if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    if (state.playing) {
      pausePlay();
    } else {
      startPlay();
    }
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    singleStep();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    retreat();
  }
}

function guessLang(): Lang {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function boot(): void {
  try {
    state = loadState();
    player = new Player(intervalMs, advance, finishPlay);
    fullRender();
    app.addEventListener('click', handleClick);
    app.addEventListener('keydown', handleKeydown);
  } catch (error) {
    const lang = guessLang();
    const message =
      error instanceof StorageError
        ? t('storageError', lang)
        : error instanceof Error
          ? error.message
          : String(error);
    app.innerHTML = renderFatal(message, lang);
    app.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-action="clear-storage"]')
        : null;
      if (target) {
        clearStoredState();
        window.location.reload();
      }
    });
  }
}

boot();
