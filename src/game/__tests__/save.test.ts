import { describe, expect, it } from 'vitest';
import { validateSave, importSave } from '../save';
import { createInitialState, reducer } from '../state';

describe('세이브 시스템', () => {
  it('정상 상태는 직렬화/역직렬화 후에도 유효하다', () => {
    const s = createInitialState();
    const roundTrip: unknown = JSON.parse(JSON.stringify(s));
    expect(validateSave(roundTrip)).toBe(true);
  });

  it('진행 중인 대결 상태가 직렬화 후 보존된다', () => {
    let s = createInitialState();
    s = reducer(s, { type: 'ENCOUNTER_START', npcId: 'goblin' });
    s = reducer(s, { type: 'ENCOUNTER_INTRO_DONE' });
    s = reducer(s, { type: 'ENCOUNTER_INFO', action: 'observe' });
    const restored = importSave(JSON.stringify(s));
    expect(restored).not.toBeNull();
    expect(restored!.activeEncounter?.scenarioId).toBe(s.activeEncounter!.scenarioId);
    expect(restored!.activeEncounter?.usedActions).toEqual(['observe']);
    // 복원 후에도 동일한 시나리오로 동일한 로직이 작동
    const next = reducer(restored!, { type: 'ENCOUNTER_INFO', action: 'inspect' });
    expect(next.activeEncounter?.usedActions).toEqual(['observe', 'inspect']);
  });

  it('손상된 데이터는 거부된다', () => {
    expect(validateSave(null)).toBe(false);
    expect(validateSave({})).toBe(false);
    expect(validateSave({ version: 999 })).toBe(false);
    expect(importSave('{"broken')).toBeNull();
    expect(importSave('{"version":1}')).toBeNull();
  });
});
