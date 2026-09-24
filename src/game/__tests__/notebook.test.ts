import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { createInitialState } from '../state';
import { getDiscoveredRecords, getScopedRecords } from '../content/records';
import { getNotebook } from '../content/incidents';
import { getActiveTrackable, getTrackedQuest } from '../content/world';
import { importSave } from '../save';

/** 구버전·신규 기록이 섞인 상태 (세 사건 동시 진행) */
function mixed(over: Partial<GameState> = {}, flags: GameState['flags'] = {}): GameState {
  const s = createInitialState();
  return {
    ...s,
    flags: {
      ...s.flags,
      prologue_card: true,
      gate_merchant_met: true,
      read_manifest: true,
      chip_refused: true,
      // S01 조사 중
      s01_truth: 'T2',
      s01_stage: 'investigating',
      s01_heard_A: true,
      s01_ev_seal: true,
      // 그리즐의 부탁 진행 중
      gf_stage: 'offered',
      gf_seen_stall: true,
      // 벽보 진행 중
      hb_stage: 'noticed',
      hb_up: true,
      hb_seen_paper: true,
      ...flags,
    },
    quests: {
      ...s.quests,
      q_invitation: { stage: 'start', completed: [] },
      q_s01: { stage: 'investigating', completed: ['seen'] },
      q_grizzle_favor: { stage: 'offered', completed: [] },
      q_handbill: { stage: 'noticed', completed: [] },
    },
    ...over,
  };
}

const flat = (s: GameState) => getDiscoveredRecords(s).map((r) => `${r.kind}|${r.text}`);

describe('GM-P5 사건 수첩', () => {
  it('기록 이전 없음: 사건 태그를 떼면 평면 목록과 순서·문구·종류가 정확히 같다', () => {
    for (const s of [createInitialState(), mixed(), mixed({}, { s01_stage: 'resolved', s01_verdict: 'B', s01_informed: true, gf_stage: 'returned', gf_key_given: true, hb_stage: 'resolved', hb_resolved: 'evidence' })]) {
      const scoped = getScopedRecords(s);
      expect(scoped.map((r) => `${r.kind}|${r.text}`)).toEqual(flat(s));
      expect(scoped.map((r) => r.order)).toEqual(scoped.map((_, i) => i));
    }
  });

  it('사건별로 묶어도 모든 기록이 정확히 한 번씩 닿는다 (일반 기록은 버리지 않음)', () => {
    const s = mixed();
    const nb = getNotebook(s);
    const grouped = [...nb.incidents.flatMap((i) => i.records), ...nb.general].sort((a, b) => a.order - b.order);
    expect(grouped.map((r) => `${r.kind}|${r.text}`)).toEqual(flat(s));
    expect(nb.general.length).toBeGreaterThan(0);
    expect(nb.general.every((r) => r.scope === 'general')).toBe(true);
  });

  it('사건 머리: 상태·실마리는 저장된 퀘스트 단계에서만, 개수는 종류별', () => {
    const nb = getNotebook(mixed());
    expect(nb.incidents.map((i) => i.id)).toEqual(['s01', 'favor', 'handbill']);
    const s01 = nb.incidents.find((i) => i.id === 's01')!;
    expect(s01.status).toBe('active');
    expect(s01.lead).toContain('직접 확인한 흔적'); // q_s01 investigating 목표 문구
    expect(s01.counts.fact).toBe(1);
    expect(s01.counts.claim).toBe(1);
    const hb = nb.incidents.find((i) => i.id === 'handbill')!;
    expect(hb.counts).toEqual({ fact: 1, claim: 1, rumor: 0, inference: 0 });
    // 실마리 문구에 범인·진실 추정이 들어가지 않는다
    for (const i of nb.incidents) expect(i.lead ?? '').not.toMatch(/되팔이 상인이 붙|원본은/);
  });

  it('해결 순서가 달라도 해결된 사건은 뒤로, 진행 중인 사건이 앞에', () => {
    const s = mixed({}, { gf_stage: 'returned' });
    s.quests = { ...s.quests, q_grizzle_favor: { stage: 'returned', completed: ['offered', 'found'] } };
    const nb = getNotebook(s);
    expect(nb.incidents.map((i) => `${i.id}:${i.status}`)).toEqual(['s01:active', 'handbill:active', 'favor:resolved']);
    s.quests = { ...s.quests, q_s01: { stage: 'resolved', completed: ['seen', 'investigating'] } };
    expect(getNotebook(s).incidents.map((i) => `${i.id}:${i.status}`)).toEqual(['handbill:active', 's01:resolved', 'favor:resolved']);
  });

  it('구버전 v6 세이브(사건 퀘스트 없음)는 일반 기록만 — 모르는 사건은 나오지 않는다', () => {
    const s = createInitialState();
    const legacy = importSave(JSON.stringify({ ...s, flags: { prologue_card: true, read_manifest: true } }))!;
    const nb = getNotebook(legacy);
    expect(nb.incidents).toHaveLength(0);
    expect(nb.general.length).toBe(getDiscoveredRecords(legacy).length);
  });

  it('트래커: 종결 단계는 제외, 0/1/N 모두 동작, 선택은 순수 함수 (상태 불변)', () => {
    const none = { ...createInitialState(), quests: {} };
    expect(getActiveTrackable(none)).toEqual([]);
    expect(getTrackedQuest(none, 'q_s01')).toBeNull();

    const s = mixed();
    const active = getActiveTrackable(s);
    expect(active).toEqual(['q_invitation', 'q_grizzle_favor', 'q_s01', 'q_handbill']);
    const snapshot = JSON.stringify(s);
    for (const id of [...active, 'q_unknown', null]) getTrackedQuest(s, id);
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(getTrackedQuest(s)!.quest.id).toBe('q_invitation');
    expect(getTrackedQuest(s, 'q_handbill')!.quest.id).toBe('q_handbill');
    expect(getTrackedQuest(s, 'q_unknown')!.quest.id).toBe('q_invitation'); // 잘못된 선택은 기본값으로

    // 선택한 사건이 해결되면 기본 우선순위로 돌아간다
    const resolved = { ...s, quests: { ...s.quests, q_handbill: { stage: 'resolved', completed: ['noticed'] } } };
    expect(getActiveTrackable(resolved)).not.toContain('q_handbill');
    expect(getTrackedQuest(resolved, 'q_handbill')!.quest.id).toBe('q_invitation');

    const one = { ...createInitialState(), quests: { q_s01: { stage: 'seen', completed: [] } } };
    expect(getActiveTrackable(one)).toEqual(['q_s01']);
  });

  it('새로고침 후에도 묶음·실마리가 같다 (저장된 값에서만 파생)', () => {
    const s = mixed();
    const r = importSave(JSON.stringify(s))!;
    expect(JSON.stringify(getNotebook(r))).toBe(JSON.stringify(getNotebook(s)));
  });
});
