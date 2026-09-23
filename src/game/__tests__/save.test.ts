import { describe, expect, it } from 'vitest';
import { validateSave, importSave } from '../save';
import { createInitialState, reducer } from '../state';
import { LOCATIONS } from '../content/world';

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

  it('v1 세이브는 v3까지 체인 마이그레이션되어 진행이 보존된다', () => {
    const v1 = {
      version: 1,
      player: { location: 'market', x: 5, y: 7, gold: 15 },
      inventory: ['old_key'],
      flags: { lost_to_goblin: true },
      npcs: {},
      quest: { id: 'q_invitation', stage: 'find_lock', completed: ['start', 'boxes'] },
      unlocked: [],
      activeEncounter: null,
      encounterSeed: 42,
    };
    const restored = importSave(JSON.stringify(v1));
    expect(restored).not.toBeNull();
    expect(restored!.version).toBe(3);
    expect(restored!.inventory).toContain('old_key');
    expect(restored!.player.gold).toBe(15);
    expect(restored!.quest.stage).toBe('find_lock');
    // v1→v2: 좌표계 변경으로 위치는 시작 지점 재배치
    expect(restored!.player.x).toBe(LOCATIONS.market.playerStart.x);
    expect(restored!.player.y).toBe(LOCATIONS.market.playerStart.y);
    // v2→v3: 월드 필드 기본값 + 발견 기록은 보유 아이템에서 생성
    expect(restored!.visitedRegions).toEqual(['goblin_market']);
    expect(restored!.discovered).toContain('old_key');
    expect(restored!.career).toEqual({ duels: 0, wins: 0, losses: 0, walkaways: 0 });
  });

  it('v2 세이브는 v3로 마이그레이션되며 위치·진행이 그대로 보존된다', () => {
    const base = createInitialState();
    const v2 = {
      version: 2,
      player: { location: 'warehouse', x: 2, y: 3, gold: 20 },
      inventory: ['old_key', 'invitation'],
      flags: { found_invitation: true, warehouse_opened: true },
      npcs: base.npcs,
      quest: { id: 'q_invitation', stage: 'done', completed: ['start', 'boxes', 'find_lock', 'open_warehouse'] },
      unlocked: ['warehouse'],
      activeEncounter: null,
      encounterSeed: 7,
    };
    const restored = importSave(JSON.stringify(v2));
    expect(restored).not.toBeNull();
    expect(restored!.version).toBe(3);
    // v2→v3에서는 위치를 건드리지 않는다
    expect(restored!.player.location).toBe('warehouse');
    expect(restored!.player.x).toBe(2);
    expect(restored!.discovered).toEqual(['old_key', 'invitation']);
    expect(restored!.unlocked).toContain('warehouse');
  });

  it('손상된 데이터는 거부된다', () => {
    expect(validateSave(null)).toBe(false);
    expect(validateSave({})).toBe(false);
    expect(validateSave({ version: 999 })).toBe(false);
    expect(importSave('{"broken')).toBeNull();
    expect(importSave('{"version":1}')).toBeNull();
  });
});
