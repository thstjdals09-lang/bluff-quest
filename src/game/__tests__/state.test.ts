import { describe, expect, it } from 'vitest';
import { createInitialState, reducer } from '../state';
import { getScenario } from '../encounter';
import type { BoxIndex, GameState } from '../types';

function startedEncounter(): GameState {
  let s = createInitialState();
  s = reducer(s, { type: 'ENCOUNTER_START', npcId: 'goblin' });
  s = reducer(s, { type: 'ENCOUNTER_INTRO_DONE' });
  return s;
}

describe('게임 상태 리듀서', () => {
  it('대결 시작 시 퀘스트가 boxes 단계로 진행된다', () => {
    const s = startedEncounter();
    expect(s.activeEncounter).not.toBeNull();
    expect(s.quest.stage).toBe('boxes');
  });

  it('진행 중인 대결이 있으면 ENCOUNTER_START가 기존 대결을 보존한다', () => {
    const s = startedEncounter();
    const again = reducer(s, { type: 'ENCOUNTER_START', npcId: 'goblin' });
    expect(again.activeEncounter).toBe(s.activeEncounter);
  });

  it('승리 시 낡은 열쇠를 얻고 퀘스트가 find_lock으로 진행된다', () => {
    const s = startedEncounter();
    const treasureIdx = getScenario(s.activeEncounter!).boxes.indexOf('treasure') as BoxIndex;
    const won = reducer(s, { type: 'ENCOUNTER_CHOOSE', box: treasureIdx });
    expect(won.activeEncounter?.result).toBe('win');
    expect(won.inventory).toContain('old_key');
    expect(won.quest.stage).toBe('find_lock');
  });

  it('패배 시 진행이 막히지 않는다: 플래그가 남고 재도전이 가능하다', () => {
    const s = startedEncounter();
    const scenario = getScenario(s.activeEncounter!);
    const wrongIdx = ((scenario.boxes.indexOf('treasure') + 1) % 3) as BoxIndex;
    let lost = reducer(s, { type: 'ENCOUNTER_CHOOSE', box: wrongIdx });
    expect(lost.activeEncounter?.result).toBe('lose');
    expect(lost.flags.lost_to_goblin).toBe(true);
    expect(lost.npcs.goblin.fooledPlayer).toBe(true);
    lost = reducer(lost, { type: 'ENCOUNTER_CLOSE' });
    // 재도전: 새 대결이 시작되어야 하며, 시드가 증가해 시나리오 재추첨
    const retry = reducer(lost, { type: 'ENCOUNTER_START', npcId: 'goblin' });
    expect(retry.activeEncounter).not.toBeNull();
    expect(retry.activeEncounter!.seed).toBe(lost.encounterSeed);
  });

  it('거짓말 시나리오를 간파하고 이기면 기념품 칩을 얻는다', () => {
    let s = createInitialState();
    // 거짓 시나리오가 나올 때까지 시드를 바꿔 가며 시작
    for (let seed = 0; seed < 100; seed++) {
      s = { ...createInitialState(), encounterSeed: seed };
      s = reducer(s, { type: 'ENCOUNTER_START', npcId: 'goblin' });
      if (!getScenario(s.activeEncounter!).statement.isTrue) break;
    }
    const scenario = getScenario(s.activeEncounter!);
    expect(scenario.statement.isTrue).toBe(false);
    const treasureIdx = scenario.boxes.indexOf('treasure') as BoxIndex;
    const won = reducer(s, { type: 'ENCOUNTER_CHOOSE', box: treasureIdx });
    expect(won.inventory).toContain('goblin_tooth_chip');
    expect(won.npcs.goblin.caughtLying).toBe(true);
  });

  it('벽과 엔티티 타일로는 이동할 수 없다', () => {
    let s = createInitialState();
    // 북쪽 성벽(row 0)으로는 진입 불가
    s = reducer(s, { type: 'GOTO_LOCATION', locationId: 'market', x: 3, y: 1 });
    const blockedWall = reducer(s, { type: 'MOVE', dx: 0, dy: -1 });
    expect(blockedWall.player.y).toBe(1);
    // 엔티티 타일(그리즐 (0,4))로는 진입 불가
    s = reducer(s, { type: 'GOTO_LOCATION', locationId: 'market', x: 1, y: 4 });
    const blockedNpc = reducer(s, { type: 'MOVE', dx: -1, dy: 0 });
    expect(blockedNpc.player.x).toBe(1);
    // 일반 바닥으로는 이동 가능
    const moved = reducer(s, { type: 'MOVE', dx: 1, dy: 0 });
    expect(moved.player.x).toBe(2);
  });

  it('대결 결과가 포커 커리어에 집계된다', () => {
    let s = startedEncounter();
    const treasureIdx = getScenario(s.activeEncounter!).boxes.indexOf('treasure') as BoxIndex;
    s = reducer(s, { type: 'ENCOUNTER_CHOOSE', box: treasureIdx });
    expect(s.career).toEqual({ duels: 1, wins: 1, losses: 0, walkaways: 0 });
    s = reducer(s, { type: 'ENCOUNTER_CLOSE' });
    // 재도전 후 패배
    s = reducer(s, { type: 'ENCOUNTER_START', npcId: 'goblin' });
    s = reducer(s, { type: 'ENCOUNTER_INTRO_DONE' });
    const wrongIdx = ((getScenario(s.activeEncounter!).boxes.indexOf('treasure') + 1) % 3) as BoxIndex;
    s = reducer(s, { type: 'ENCOUNTER_CHOOSE', box: wrongIdx });
    expect(s.career.duels).toBe(2);
    expect(s.career.losses).toBe(1);
    s = reducer(s, { type: 'ENCOUNTER_CLOSE' });
    // 물러남 집계
    s = reducer(s, { type: 'ENCOUNTER_START', npcId: 'goblin' });
    s = reducer(s, { type: 'ENCOUNTER_LEAVE' });
    expect(s.career.walkaways).toBe(1);
  });

  it('아이템을 제거해도 발견 기록은 컬렉션에 남는다', () => {
    let s = createInitialState();
    s = reducer(s, { type: 'ADD_ITEM', itemId: 'old_key' });
    expect(s.discovered).toContain('old_key');
    s = reducer(s, { type: 'REMOVE_ITEM', itemId: 'old_key' });
    expect(s.inventory).not.toContain('old_key');
    expect(s.discovered).toContain('old_key');
  });

  it('지역 이동 시 방문 기록이 중복 없이 유지된다', () => {
    let s = createInitialState();
    expect(s.visitedRegions).toEqual(['goblin_market']);
    s = reducer(s, { type: 'GOTO_LOCATION', locationId: 'warehouse', x: 2, y: 4 });
    s = reducer(s, { type: 'GOTO_LOCATION', locationId: 'market', x: 3, y: 8 });
    expect(s.visitedRegions).toEqual(['goblin_market']);
  });

  it('창고 해금과 이동, 초대장 획득 흐름이 동작한다', () => {
    let s = createInitialState();
    s = reducer(s, { type: 'ADD_ITEM', itemId: 'old_key' });
    s = reducer(s, { type: 'UNLOCK', id: 'warehouse' });
    s = reducer(s, { type: 'GOTO_LOCATION', locationId: 'warehouse', x: 2, y: 4 });
    expect(s.player.location).toBe('warehouse');
    s = reducer(s, { type: 'ADD_ITEM', itemId: 'invitation' });
    s = reducer(s, { type: 'SET_QUEST_STAGE', stage: 'done' });
    expect(s.inventory).toContain('invitation');
    expect(s.quest.stage).toBe('done');
  });
});
