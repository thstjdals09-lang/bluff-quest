import { describe, expect, it } from 'vitest';
import { REGIONS, getRegionAccess } from '../content/regions';
import { createInitialState, reducer } from '../state';

describe('월드 지역 해금', () => {
  it('고블린 시장은 처음부터 해금되어 있다', () => {
    const s = createInitialState();
    expect(getRegionAccess('goblin_market', s).unlocked).toBe(true);
  });

  it('항구는 초대장 발견 전에는 잠기고, 발견 후 해금된다', () => {
    let s = createInitialState();
    const before = getRegionAccess('trickster_port', s);
    expect(before.unlocked).toBe(false);
    expect(before.hint.length).toBeGreaterThan(0);
    s = reducer(s, { type: 'SET_FLAG', key: 'found_invitation', value: true });
    expect(getRegionAccess('trickster_port', s).unlocked).toBe(true);
  });

  it('유령 카지노와 황금 도시는 잠김, 미지의 지역은 미공개다', () => {
    const s = createInitialState();
    expect(getRegionAccess('ghost_casino', s).unlocked).toBe(false);
    expect(getRegionAccess('golden_city', s).unlocked).toBe(false);
    expect(getRegionAccess('unknown_region', s).unlocked).toBe(false);
  });

  it('플레이 가능한 지역만 탐험 진입 지점을 갖는다', () => {
    for (const r of REGIONS) {
      if (r.impl === 'playable') expect(r.entry).toBeDefined();
      else expect(r.entry).toBeUndefined();
    }
  });
});
