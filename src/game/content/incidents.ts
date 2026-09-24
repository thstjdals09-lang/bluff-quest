import type { GameState } from '../types';
import { QUESTS, isQuestFinished } from './world';
import { getScopedRecords } from './records';
import type { RecordKind, ScopedRecord } from './records';

/**
 * 사건 수첩 (GM-P5) — 일지 기록을 사건별로 묶어 보여 주기 위한 읽기 전용 뷰.
 * 저장된 기록·분류는 바꾸지 않는다. 진행 상태와 현재 실마리는 저장된 퀘스트 단계에서만 가져오며,
 * 범인·진실을 새로 추정한 문장을 만들지 않는다.
 */

export type IncidentId = 's01' | 'favor' | 'handbill';

const INCIDENT_QUESTS: { id: IncidentId; questId: string }[] = [
  { id: 's01', questId: 'q_s01' },
  { id: 'favor', questId: 'q_grizzle_favor' },
  { id: 'handbill', questId: 'q_handbill' },
];

export interface IncidentView {
  id: IncidentId;
  questId: string;
  name: string;
  status: 'active' | 'resolved' | 'unseen';
  /** 현재 퀘스트 단계의 목표 문구 (저장된 단계에서만 파생) */
  lead: string | null;
  counts: Record<RecordKind, number>;
  records: ScopedRecord[];
}

function countKinds(records: ScopedRecord[]): Record<RecordKind, number> {
  const c: Record<RecordKind, number> = { fact: 0, claim: 0, rumor: 0, inference: 0 };
  for (const r of records) c[r.kind]++;
  return c;
}

export function getNotebook(state: GameState): { incidents: IncidentView[]; general: ScopedRecord[] } {
  const scoped = getScopedRecords(state);
  const incidents: IncidentView[] = [];
  for (const { id, questId } of INCIDENT_QUESTS) {
    const records = scoped.filter((r) => r.scope === id);
    const progress = state.quests[questId];
    const quest = QUESTS[questId];
    const stage = progress ? quest.stages.find((s) => s.id === progress.stage) : undefined;
    if (!stage && records.length === 0) continue; // 아직 모르는 사건은 보여 주지 않는다
    incidents.push({
      id,
      questId,
      name: quest.name,
      status: !progress ? 'unseen' : isQuestFinished(questId, progress.stage) ? 'resolved' : 'active',
      lead: stage ? stage.objective : null,
      counts: countKinds(records),
      records,
    });
  }
  // 진행 중인 사건을 먼저, 해결된 사건은 뒤로 (각 무리 안에서는 정의 순서)
  incidents.sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active'));
  return { incidents, general: scoped.filter((r) => r.scope === 'general') };
}
