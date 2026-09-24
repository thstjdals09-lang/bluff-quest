import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { createInitialState, reducer } from '../state';
import { getInteraction } from '../content/dialogues';
import { getDiscoveredRecords } from '../content/records';
import { importSave } from '../save';
import { S01_DEFER_TRAVELS, S01_TRUTHS, pickS01Truth, s01Truth } from '../content/s01';
import type { S01Truth } from '../content/s01';

/** 중앙 장터에 진실 상태 t로 들어온 상태 */
function enter(t: S01Truth): GameState {
  let s = createInitialState();
  // 원하는 진실 상태가 나오는 시드를 찾는다 (결정론적)
  let seed = 0;
  while (pickS01Truth(seed) !== t) seed++;
  s = { ...s, encounterSeed: seed, player: { ...s.player, location: 'market', x: 6, y: 1 } };
  return reducer(s, { type: 'USE_EXIT', entityId: 'central_market_passage' });
}

function choose(s: GameState, entityId: string, textIncludes: string): GameState {
  const tree = getInteraction(entityId, s);
  const all = Object.values(tree.nodes).flatMap((n) => n.choices);
  const c = all.find((x) => x.text.includes(textIncludes));
  if (!c) throw new Error(`no choice "${textIncludes}" in ${entityId}: ${all.map((x) => x.text).join(' | ')}`);
  return (c.effects ?? []).reduce(reducer, s);
}

const VERDICT_TEXT = {
  A: '공방 상인의 가드가 원본',
  B: '되팔이 상인의 가드가 원본',
  neither: '둘 다 원본이 아닌',
  mediated: '둘을 떼어 놓는다',
} as const;

const CORRECT: Record<S01Truth, 'A' | 'B' | 'neither'> = { T1: 'A', T2: 'B', T3: 'neither' };

describe('S01 두 상인의 진품 소동', () => {
  it('진실 상태는 첫 진입 때 확정되고 다시 들어와도 바뀌지 않는다', () => {
    let s = enter('T2');
    expect(s01Truth(s)).toBe('T2');
    s = reducer(s, { type: 'GOTO_LOCATION', locationId: 'market', x: 6, y: 1 });
    s = { ...s, encounterSeed: s.encounterSeed + 99 };
    s = reducer(s, { type: 'USE_EXIT', entityId: 'central_market_passage' });
    expect(s01Truth(s)).toBe('T2');
  });

  it("'둘 다 아님' 판단은 흔적(인장·영수증)을 확인한 뒤에만 나타난다", () => {
    let s = enter('T3');
    const texts = () => getInteraction('s01_a', s).nodes.root.choices.map((c) => c.text).join('|');
    expect(texts()).not.toContain('둘 다 원본이 아닌');
    s = choose(s, 's01_guards', '자세히 살펴본다');
    expect(texts()).toContain('둘 다 원본이 아닌');
  });

  for (const t of S01_TRUTHS) {
    for (const v of ['A', 'B', 'neither', 'mediated'] as const) {
      it(`${t} × ${v}: 사건이 해결되고, 관계·일지가 기록된다 (소프트락 없음)`, () => {
        let s = enter(t);
        s = choose(s, 's01_guards', '자세히 살펴본다');
        s = choose(s, 's01_b', '영수증을 보여 달라');
        s = choose(s, 's01_a', VERDICT_TEXT[v]);
        expect(s.flags.s01_stage).toBe('resolved');
        expect(s.quests.q_s01.stage).toBe('resolved');
        expect(s.flags.s01_informed).toBe(true);
        const recs = getDiscoveredRecords(s);
        // 진품 여부는 절대 '사실'로 기록되지 않는다
        expect(recs.filter((r) => r.kind === 'fact').every((r) => !r.text.includes('원본'))).toBe(true);
        expect(recs.some((r) => r.kind === 'inference' && r.text.startsWith('내 판단'))).toBe(true);
        expect(recs.filter((r) => r.kind === 'fact')).toHaveLength(2);
        // 결과가 시드 시나리오와 일관: 원본 주인이 틀린 판단을 받으면 차갑게 반응
        const holder = CORRECT[t];
        if (v !== 'mediated' && v !== holder && holder !== 'neither') {
          expect(s.flags[`s01_rel_${holder}`]).toBe('cold');
        }
        if (v === 'mediated') {
          expect(s.flags.s01_rel_A).toBe('neutral');
          expect(s.flags.s01_rel_B).toBe('neutral');
        }
        // 해결 후 반응 장면이 존재한다 (최신 트리)
        expect(getInteraction('s01_a', s).nodes.s01_reaction).toBeDefined();
      });
    }
  }

  it('정확한 판단(흔적 확인)에서는 착각한 쪽도 차갑게 굴지 않는다', () => {
    let s = enter('T1');
    s = choose(s, 's01_guards', '자세히 살펴본다');
    s = choose(s, 's01_a', VERDICT_TEXT.A);
    expect(s.flags.s01_rel_A).toBe('warm');
    expect(s.flags.s01_rel_B).toBe('neutral');
    s = enter('T2');
    s = choose(s, 's01_b', '영수증을 보여 달라');
    s = choose(s, 's01_b', VERDICT_TEXT.B);
    expect(s.flags.s01_rel_A).toBe('neutral');
  });

  it('즉시 편들기: 흔적 없이 판단하면 주장만 일지에 남고 사실은 없다', () => {
    let s = enter('T1');
    s = choose(s, 's01_b', VERDICT_TEXT.B);
    expect(s.flags.s01_informed).toBe(false);
    const recs = getDiscoveredRecords(s);
    expect(recs.filter((r) => r.kind === 'fact')).toHaveLength(0);
    expect(recs.some((r) => r.kind === 'claim')).toBe(true);
    expect(recs.find((r) => r.kind === 'inference')!.text).toContain('근거 없이');
    expect(s.flags.s01_rel_A).toBe('cold');
  });

  it('보류: 이동 2회 전에는 변화 없고, 이후 재진입 시에만 상황이 바뀌며 선택지는 그대로 남는다', () => {
    let s = enter('T3');
    s = choose(s, 's01_a', '나중에 다시 오겠다');
    expect(s.flags.s01_stage).toBe('deferred');
    // 1회 이동 후 재진입 (이동 2회) — 아직 변화 없음
    s = reducer(s, { type: 'GOTO_LOCATION', locationId: 'market', x: 6, y: 1 });
    expect(s.flags.s01_advanced).toBeUndefined();
    s = reducer(s, { type: 'USE_EXIT', entityId: 'central_market_passage' });
    expect(Number(s.flags.travel_count) - Number(s.flags.s01_deferred_at)).toBe(S01_DEFER_TRAVELS);
    expect(s.flags.s01_advanced).toBe(true);
    // 새로고침(저장·불러오기)만으로는 진행되지 않는다
    let fresh = enter('T3');
    fresh = choose(fresh, 's01_a', '나중에 다시 오겠다');
    const reloaded = importSave(JSON.stringify(fresh))!;
    expect(reloaded.flags.s01_advanced).toBeUndefined();
    // 보류 후에도 모든 판단 선택지가 남아 있다
    const texts = getInteraction('s01_b', s).nodes.root.choices.map((c) => c.text).join('|');
    expect(texts).toContain('영수증을 보여 달라');
    expect(texts).toContain('떼어 놓는다');
    expect(getDiscoveredRecords(s).some((r) => r.kind === 'rumor')).toBe(false);
    s = choose(s, 's01_onlooker', '고개를 끄덕인다');
    expect(getDiscoveredRecords(s).filter((r) => r.kind === 'rumor')).toHaveLength(2);
  });

  it('사건 도중 저장·불러오기 후에도 진실 상태와 증거가 유지된다', () => {
    let s = enter('T2');
    s = choose(s, 's01_guards', '자세히 살펴본다');
    const reloaded = importSave(JSON.stringify(s))!;
    expect(s01Truth(reloaded)).toBe('T2');
    expect(reloaded.flags.s01_ev_seal).toBe(true);
    expect(reloaded.quests.q_s01.stage).toBe('investigating');
  });

  it('기존 그리즐 대결과 창고 경로는 영향을 받지 않는다', () => {
    const s = enter('T1');
    const g = getInteraction('goblin', { ...s, player: { ...s.player, location: 'market' } });
    expect(g.nodes[g.entry].choices.some((c) => c.startEncounter)).toBe(true);
  });
});
