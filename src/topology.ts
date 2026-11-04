import type { Lang, Phase, ReadyLesson } from './types';
import { l } from './i18n';
import { esc } from './util';
import { applyModelSceneFrame, buildModelSceneMarkup } from './data/modelScenes';

export const TOPO_W = 900;
export const TOPO_H = 430;

const PHASE_LETTER: Record<Phase, string> = {
  data: 'D',
  forward: 'F',
  loss: 'L',
  backward: 'B',
  update: 'U',
};

export function buildTopologySvg(lesson: ReadyLesson, lang: Lang): string {
  const label = l({ zh: '模型内部运行图', en: 'Model execution scene' }, lang);
  return `
    <svg class="te-svg te-model-svg" data-model-scene="true" data-lesson-id="${esc(lesson.id)}" data-lang="${lang}" viewBox="0 0 ${TOPO_W} ${TOPO_H}" role="img" aria-label="${esc(label)}">
      ${buildModelSceneMarkup(lesson.id, lang)}
    </svg>`;
}

export interface PacketAnimator {
  run(edgeId: string, phase: Phase, durationMs: number, packetLabel?: string, eventIndex?: number): void;
  stop(): void;
}

export function createPacketAnimator(svg: SVGSVGElement): PacketAnimator {
  const items = [...svg.querySelectorAll<SVGGElement>('.ms-item[data-events]')];
  const phases: Phase[] = ['data', 'forward', 'loss', 'backward', 'update'];
  return {
    run(edgeId: string, phase: Phase, durationMs: number, packetLabel?: string, eventIndex?: number): void {
      if (eventIndex === undefined) {
        throw new Error('Model scene animation requires an event index');
      }
      svg.dataset.operation = edgeId;
      svg.dataset.packet = packetLabel ?? PHASE_LETTER[phase];
      svg.style.setProperty('--ms-duration', `${durationMs}ms`);
      svg.classList.remove(...phases.map((item) => `phase-${item}`));
      svg.classList.add(`phase-${phase}`);
      let activeCount = 0;
      items.forEach((item) => {
        const events = (item.dataset.events ?? '').split(' ').filter(Boolean).map(Number);
        const active = events.includes(eventIndex);
        const past = !active && events.some((index) => index < eventIndex);
        item.classList.toggle('is-active', active);
        item.classList.toggle('is-past', past);
        if (active) {
          activeCount += 1;
        }
      });
      if (activeCount === 0) {
        throw new Error(`Model scene has no visual for event ${eventIndex}`);
      }
      applyModelSceneFrame(svg, eventIndex);
    },
    stop(): void {
      items.forEach((item) => item.classList.remove('is-active', 'is-past'));
      applyModelSceneFrame(svg, 0);
    },
  };
}
