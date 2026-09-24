import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { createInitialState, reducer } from '../state';
import { getInteraction } from '../content/dialogues';
import { getDiscoveredRecords } from '../content/records';
import { getExit, isExitOpen, validateLocationGraph } from '../content/navigation';
import { getRegionAccess } from '../content/regions';
import { QUESTS } from '../content/world';
import { getRecap, recapAvailable } from '../content/recap';
import { importSave } from '../save';

function at(s: GameState, location: string, x: number, y: number): GameState {
  return { ...s, player: { ...s.player, location, x, y } };
}
const done = (s: GameState): GameState => ({ ...s, flags: { ...s.flags, prologue_done: true }, quests: { ...s.quests, q_prologue: { stage: 'done', completed: [] } } });

describe('GM-P7 진행 흐름 다듬기', () => {
  it('해안길(GM-01 남쪽 끝)은 월드맵 항구 이동과 같은 조건으로만 열린다', () => {
    const exit = getExit('market_road', 'coast_road')!;
    const cases: GameState['flags'][] = [{}, { found_invitation: true }, { found_invitation: false }, { warehouse_opened: true }];
    for (const flags of cases) {
      const s = { ...createInitialState(), flags };
      expect(isExitOpen(exit, s)).toBe(getRegionAccess('trickster_port', s).unlocked);
    }
    expect(validateLocationGraph()).toEqual([]);
  });

  it('초대장 전: 잠긴 안내만, 이동 없음 / 초대장 후: 부두 (3,1)로, 항구 첫 도착 처리도 같다', () => {
    let s = at(done(createInitialState()), 'market_road', 2, 6);
    const locked = getInteraction('coast_road', s);
    expect(locked.nodes.root.text).toContain('해안길');
    expect(reducer(s, { type: 'USE_EXIT', entityId: 'coast_road' }).player.location).toBe('market_road');
    s = { ...s, flags: { ...s.flags, found_invitation: true } };
    s = reducer(s, { type: 'USE_EXIT', entityId: 'coast_road' });
    expect(s.player.location).toBe('port_docks');
    expect([s.player.x, s.player.y]).toEqual([3, 1]);
    expect(s.flags.port_arrived).toBe(true);
    expect(s.quests.q_night_pier.stage).toBe('arrive');
    // 부두 → GM-01 기존 경로 유지
    s = reducer({ ...s, player: { ...s.player, x: 3, y: 1 } }, { type: 'USE_EXIT', entityId: 'harbor_gate' });
    expect(s.player.location).toBe('market_road');
    expect([s.player.x, s.player.y]).toEqual([2, 2]);
  });

  it("도달 가능한 항구·선술집 대사와 밤의 부두 목표에 '(추후 개발)' 류 문구가 없다", () => {
    const port = (flags: GameState['flags'], q = 'done') => ({
      ...at(createInitialState(), 'port_docks', 6, 5),
      flags,
      npcs: { fin: { meetCount: 1, caughtLying: false, fooledPlayer: false } },
      quests: { q_night_pier: { stage: q, completed: [] } },
    });
    const texts = [
      ...Object.values(getInteraction('fin', port({ invitation_shown: true })).nodes).map((n) => n.text),
      ...Object.values(getInteraction('fin', port({})).nodes).map((n) => n.text),
      ...Object.values(getInteraction('tavern_door', port({})).nodes).map((n) => n.text),
      ...QUESTS.q_night_pier.stages.map((st) => st.objective),
    ].join('\n');
    expect(texts).not.toMatch(/추후 개발|개발 중|\(다음 이야기/);
  });

  it('요약은 밤의 부두 이정표 이후에만, 읽기 전용이며 이 세이브가 가진 기록·퀘스트 문구만 쓴다', () => {
    const sparse = { ...createInitialState(), quests: { q_prologue: { stage: 'done', completed: [] }, q_night_pier: { stage: 'done', completed: ['arrive'] } } };
    expect(recapAvailable(sparse)).toBe(true);
    expect(recapAvailable({ ...sparse, quests: { q_night_pier: { stage: 'wager', completed: [] } } })).toBe(false);
    const rich: GameState = {
      ...sparse,
      flags: {
        prologue_card: true, gate_merchant_met: true, read_manifest: true, found_invitation: true, night_pier_hint: true,
        s01_truth: 'T3', s01_stage: 'resolved', s01_verdict: 'neither', s01_informed: true, s01_ev_seal: true, s01_heard_B: true,
        hb_stage: 'resolved', hb_resolved: 'evidence', hb_seen_paper: true, hb_seen_pad: true,
      },
      quests: { ...sparse.quests, q_invitation: { stage: 'done', completed: [] }, q_s01: { stage: 'resolved', completed: [] }, q_handbill: { stage: 'resolved', completed: [] } },
    };
    for (const s of [sparse, rich]) {
      const before = JSON.stringify(s);
      const r = getRecap(s);
      expect(JSON.stringify(s)).toBe(before);
      const known = new Set([
        ...getDiscoveredRecords(s).map((x) => x.text),
        ...Object.values(QUESTS).flatMap((q) => [q.name, ...q.stages.map((st) => st.title)]),
      ]);
      const strings = [...r.path.flatMap((p) => [p.name, p.stageTitle]), ...r.incidents.flatMap((i) => [i.name, ...i.judgements]), ...r.unconfirmed.map((u) => u.text)];
      for (const str of strings) expect(known.has(str), str).toBe(true);
      // 숨은 진실(시드)은 문구로 드러나지 않는다
      expect(strings.join()).not.toMatch(/T3|s01_truth/);
    }
    const r = getRecap(rich);
    expect(r.incidents.find((i) => i.name === QUESTS.q_s01.name)!.judgements[0]).toContain('내 판단');
    expect(r.unconfirmed.every((u) => u.kind === 'claim' || u.kind === 'rumor')).toBe(true);
    expect(getRecap(sparse).incidents).toHaveLength(0);
  });

  it('구버전 v6: 초대장 전·후 모두 안전하게 로드, 해안길은 초대장 후에만 열린다', () => {
    const before = importSave(JSON.stringify(at(done(createInitialState()), 'market_road', 2, 6)))!;
    expect(isExitOpen(getExit('market_road', 'coast_road')!, before)).toBe(false);
    const after = importSave(JSON.stringify({ ...before, flags: { ...before.flags, found_invitation: true }, inventory: ['invitation'] }))!;
    expect(isExitOpen(getExit('market_road', 'coast_road')!, after)).toBe(true);
    expect(recapAvailable(after)).toBe(false);
  });
});
