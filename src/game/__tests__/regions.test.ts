import { describe, expect, it } from 'vitest';
import { REGIONS, getRegionAccess } from '../content/regions';
import { createInitialState, createNewAdventureState, reducer } from '../state';

describe('월드 지역 해금', () => {
  it('고블린 시장은 처음부터 해금되어 있다', () => {
    const s = createInitialState();
    expect(getRegionAccess('goblin_market', s).unlocked).toBe(true);
  });

  it('W0: 지역 방문은 이야기와 별개 — 프롤로그 중에는 잠기고, 끝나면 초대장 없이도 모든 지역이 열린다', () => {
    const inPrologue = createNewAdventureState('카이');
    for (const id of ['trickster_port', 'ghost_casino', 'golden_city', 'gamblers_tower']) {
      const a = getRegionAccess(id, inPrologue);
      expect(a.unlocked).toBe(false);
      expect(a.hint.length).toBeGreaterThan(0);
    }
    const after = reducer(inPrologue, { type: 'SET_QUEST_STAGE', questId: 'q_prologue', stage: 'done' });
    const legacy = createInitialState(); // 프롤로그 없는 기존 세이브
    for (const s of [after, legacy]) {
      for (const id of ['trickster_port', 'ghost_casino', 'golden_city', 'gamblers_tower']) expect(getRegionAccess(id, s).unlocked).toBe(true);
      expect(s.flags.found_invitation).toBeUndefined();
    }
  });

  it('플레이 가능한 지역만 탐험 진입 지점을 갖는다', () => {
    for (const r of REGIONS) {
      if (r.impl === 'playable') expect(r.entry).toBeDefined();
      else expect(r.entry).toBeUndefined();
    }
  });
});
