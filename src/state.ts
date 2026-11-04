import type { AppState, PersistedState, ReadyLesson } from './types';
import { lessons } from './data/lessons';

const STORAGE_KEY = 'training-explorer:v1';

export class StorageError extends Error {
  constructor() {
    super('Stored progress failed validation');
    this.name = 'StorageError';
  }
}

export function createInitialState(): AppState {
  return {
    lang: 'zh',
    theme: 'light',
    category: 'all',
    activeLessonId: 'training-loop',
    previewLessonId: null,
    activeTab: 'topology',
    inspectorTab: 'overview',
    cursor: -1,
    speed: 1,
    playing: false,
    courseMenuOpen: false,
    completedSteps: [],
  };
}

function assertPersisted(value: unknown): asserts value is PersistedState {
  if (typeof value !== 'object' || value === null) {
    throw new StorageError();
  }
  const data = value as Record<string, unknown>;
  if (data.version !== 1) {
    throw new StorageError();
  }
  if (data.lang !== 'zh' && data.lang !== 'en') {
    throw new StorageError();
  }
  if (data.theme !== 'light' && data.theme !== 'dark') {
    throw new StorageError();
  }
  if (typeof data.activeLessonId !== 'string') {
    throw new StorageError();
  }
  const lesson = lessons.find((candidate) => candidate.id === data.activeLessonId);
  if (!lesson || lesson.status !== 'ready') {
    throw new StorageError();
  }
  if (!Array.isArray(data.completedSteps)) {
    throw new StorageError();
  }
  for (const index of data.completedSteps) {
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= lesson.steps.length) {
      throw new StorageError();
    }
  }
}

export function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return createInitialState();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StorageError();
  }
  assertPersisted(parsed);
  const state = createInitialState();
  state.lang = parsed.lang;
  state.theme = parsed.theme;
  state.activeLessonId = parsed.activeLessonId;
  state.completedSteps = [...parsed.completedSteps];
  return state;
}

export function saveState(state: AppState): void {
  const data: PersistedState = {
    version: 1,
    lang: state.lang,
    theme: state.theme,
    activeLessonId: state.activeLessonId,
    completedSteps: state.completedSteps,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearStoredState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function activeStepForCursor(lesson: ReadyLesson, cursor: number): number | null {
  if (cursor < 0) {
    return null;
  }
  const event = lesson.events[cursor];
  if (!event) {
    throw new Error(`Event index out of range: ${cursor}`);
  }
  return event.stepIndex;
}

export function completedStepsForCursor(
  lesson: ReadyLesson,
  cursor: number,
  previous: number[],
): number[] {
  const result = new Set(previous);
  for (let index = 0; index < lesson.steps.length; index += 1) {
    const step = lesson.steps[index];
    if (!step) {
      throw new Error(`Step index out of range: ${index}`);
    }
    if (cursor >= step.lastEvent) {
      result.add(index);
    }
  }
  return [...result].sort((a, b) => a - b);
}
