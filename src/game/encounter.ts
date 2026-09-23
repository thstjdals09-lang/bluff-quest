import type { BoxIndex, EncounterScenario, EncounterState, InfoActionId } from './types';
import { GOBLIN_SCENARIOS, getScenarioById } from './content/scenarios';
import { pickIndex } from './rng';

/** 한 대결에서 사용할 수 있는 정보 수집 행동 횟수 */
export const INFO_ACTION_LIMIT = 3;

export const INFO_ACTION_LABELS: Record<InfoActionId, string> = {
  ask_boxes: '상자에 대해 질문한다',
  ask_motive: '왜 이런 내기를 하는지 묻는다',
  observe: '고블린의 행동을 관찰한다',
  inspect: '주변 환경을 조사한다',
};

/**
 * 대결 시작: 시드로 시나리오를 결정론적으로 선택한다.
 * 시나리오(상자 내용, NPC 지식·목적)는 이 시점에 확정되며 이후 변경되지 않는다.
 */
export function startEncounter(seed: number, bonusClue: string | null): EncounterState {
  const scenario = GOBLIN_SCENARIOS[pickIndex(seed, GOBLIN_SCENARIOS.length)];
  return {
    encounterId: 'goblin_boxes',
    scenarioId: scenario.id,
    seed,
    phase: 'intro',
    usedActions: [],
    bonusClue,
    chosenBox: null,
    result: null,
  };
}

export function getScenario(enc: EncounterState): EncounterScenario {
  const s = getScenarioById(enc.scenarioId);
  if (!s) throw new Error(`Unknown scenario: ${enc.scenarioId}`);
  return s;
}

export function remainingActions(enc: EncounterState): number {
  return Math.max(0, INFO_ACTION_LIMIT - enc.usedActions.length);
}

/** 정보 수집 행동 실행 — 시나리오에 정의된 일관된 단서를 공개 */
export function applyInfoAction(enc: EncounterState, action: InfoActionId): EncounterState {
  if (enc.phase !== 'info') return enc;
  if (enc.usedActions.includes(action)) return enc;
  if (remainingActions(enc) <= 0) return enc;
  return { ...enc, usedActions: [...enc.usedActions, action] };
}

/** 상자 선택 — 결과는 시작 시 확정된 시나리오 데이터로만 판정 */
export function chooseBox(enc: EncounterState, box: BoxIndex): EncounterState {
  if (enc.phase !== 'info' && enc.phase !== 'intro') return enc;
  const scenario = getScenario(enc);
  const result = scenario.boxes[box] === 'treasure' ? 'win' : 'lose';
  return { ...enc, phase: 'resolved', chosenBox: box, result };
}

export function leaveEncounter(enc: EncounterState): EncounterState {
  if (enc.phase === 'resolved') return enc;
  return { ...enc, phase: 'left' };
}

export const BOX_LABELS = ['왼쪽 상자', '가운데 상자', '오른쪽 상자'] as const;

export const BOX_CONTENT_LABELS: Record<string, string> = {
  treasure: '💰 보물 (낡은 열쇠와 금화)',
  junk: '🥫 잡동사니 (찌그러진 냄비)',
  empty: '🕸️ 텅 빈 상자',
};
