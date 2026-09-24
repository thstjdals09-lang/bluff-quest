import type { GameState } from '../types';
import { QUESTS, isQuestFinished } from './world';
import { getNotebook } from './incidents';
import type { IncidentView } from './incidents';
import type { RecordKind } from './records';

/**
 * '지금까지' 요약 (GM-P7) — 읽기 전용.
 * 저장된 퀘스트 단계와 이 세이브가 실제로 얻은 일지 기록만 다시 보여 준다.
 * 새 문장으로 진실을 합성하거나 숨은 플래그를 드러내지 않는다 — 모든 본문은 기존 퀘스트 이름·단계 제목·기록 문구 그대로다.
 */

/** 밤의 부두 이정표에 도달했는가 — 요약은 이때부터 일지에서 언제든 다시 열 수 있다 */
export function recapAvailable(state: GameState): boolean {
  return state.quests.q_night_pier?.stage === 'done';
}

const MAIN_PATH = ['q_prologue', 'q_invitation', 'q_night_pier', 'q_moonless'];

export interface Recap {
  path: { name: string; stageTitle: string; done: boolean }[];
  incidents: { name: string; status: IncidentView['status']; counts: Record<RecordKind, number>; judgements: string[] }[];
  /** 이야기·지역 기록 중 확인되지 않은 것 (들은 주장·소문) */
  unconfirmed: { kind: RecordKind; text: string }[];
  factCount: number;
}

export function getRecap(state: GameState): Recap {
  const path = MAIN_PATH.flatMap((id) => {
    const p = state.quests[id];
    const q = QUESTS[id];
    const stage = p && q?.stages.find((s) => s.id === p.stage);
    return stage ? [{ name: q.name, stageTitle: stage.title, done: isQuestFinished(id, p.stage) }] : [];
  });
  const nb = getNotebook(state);
  const incidents = nb.incidents.map((i) => ({
    name: i.name,
    status: i.status,
    counts: i.counts,
    // 플레이어 자신의 판단(추정)만 — 사실처럼 바꾸어 말하지 않는다
    judgements: i.records.filter((r) => r.kind === 'inference').map((r) => r.text),
  }));
  const unconfirmed = nb.general.filter((r) => r.kind === 'claim' || r.kind === 'rumor').map(({ kind, text }) => ({ kind, text }));
  const factCount = nb.general.filter((r) => r.kind === 'fact').length + nb.incidents.reduce((n, i) => n + i.counts.fact, 0);
  return { path, incidents, unconfirmed, factCount };
}
