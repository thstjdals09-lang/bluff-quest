import { describe, expect, it } from 'vitest';
import { LOCATIONS } from '../content/world';
import { buildRegionMap, getExit, isExitOpen, validateLocationGraph } from '../content/navigation';
import { canPassExitDirectly, getInteraction } from '../content/dialogues';
import { SAVE_VERSION, createInitialState, reducer } from '../state';
import { importSave } from '../save';
import type { GameState } from '../types';

function at(state: GameState, location: string, x: number, y: number): GameState {
  return { ...state, player: { ...state.player, location, x, y } };
}

describe('장소 연결 구조', () => {
  it('연결 그래프에 문제가 없다 (도착 좌표·양방향·지역 내 도달성)', () => {
    expect(validateLocationGraph()).toEqual([]);
  });

  it('검사기가 끊어진 연결과 막힌 도착 좌표를 잡아낸다', () => {
    const broken = structuredClone(LOCATIONS);
    broken.warehouse.exits = [];
    broken.warehouse.entities = broken.warehouse.entities.filter((e) => e.id !== 'exit_door');
    broken.market.exits[1].arrive = { x: 0, y: 0 }; // market_road의 벽 칸
    const problems = validateLocationGraph(broken);
    expect(problems.some((p) => p.includes('되돌아오는 출입구'))).toBe(true);
    expect(problems.some((p) => p.includes('빈 칸이 아니다'))).toBe(true);
  });

  it('출입구는 인접해야 사용할 수 있다', () => {
    let s = at(createInitialState(), 'market', 2, 6);
    expect(reducer(s, { type: 'USE_EXIT', entityId: 'market_exit' }).player.location).toBe('market');
    s = at(s, 'market', 3, 8);
    const moved = reducer(s, { type: 'USE_EXIT', entityId: 'market_exit' });
    expect(moved.player.location).toBe('market_road');
    expect(moved.player).toMatchObject(getExit('market', 'market_exit')!.arrive);
    expect(moved.visitedLocations).toContain('market_road');
  });

  it('잠긴 창고 문은 지날 수 없고, 해금 후에는 바로 지난다', () => {
    let s = at(createInitialState(), 'market', 3, 1);
    const door = getExit('market', 'warehouse_door')!;
    expect(isExitOpen(door, s)).toBe(false);
    expect(canPassExitDirectly('warehouse_door', s)).toBe(false);
    expect(reducer(s, { type: 'USE_EXIT', entityId: 'warehouse_door' }).player.location).toBe('market');
    s = reducer(s, { type: 'UNLOCK', id: 'warehouse' });
    expect(canPassExitDirectly('warehouse_door', s)).toBe(true);
    expect(reducer(s, { type: 'USE_EXIT', entityId: 'warehouse_door' }).player.location).toBe('warehouse');
  });

  it('창고 문이 잠겨 있으면 기존 열쇠 사건 대화가 그대로 열린다', () => {
    let s = at(createInitialState(), 'market', 3, 1);
    s = reducer(s, { type: 'ADD_ITEM', itemId: 'old_key' });
    const tree = getInteraction('warehouse_door', s);
    expect(tree.nodes[tree.entry].choices.map((c) => c.text)).toContain('문을 연다');
  });

  it('항구 정문은 지역을 넘어 시장 진입로로 이어진다', () => {
    const s = at(createInitialState(), 'port_docks', 3, 1);
    const moved = reducer(s, { type: 'USE_EXIT', entityId: 'harbor_gate' });
    expect(moved.player.location).toBe('market_road');
    expect(moved.visitedRegions).toContain('goblin_market');
  });

  it('막힌 좌표로의 이동은 해당 장소 시작 좌표로 보정된다', () => {
    const s = reducer(createInitialState(), { type: 'GOTO_LOCATION', locationId: 'warehouse', x: 0, y: 0 });
    expect(s.player).toMatchObject(LOCATIONS.warehouse.playerStart);
  });

  it('지역 지도는 아는 장소만 보여주고 잠긴 연결을 표시한다', () => {
    const s = createInitialState(); // 입구 장터만 방문
    const map = buildRegionMap('goblin_market', s);
    const ids = map.nodes.map((n) => n.locationId).sort();
    expect(ids).toEqual(['market', 'market_road', 'warehouse']);
    expect(map.nodes.find((n) => n.locationId === 'market')!.status).toBe('current');
    expect(map.nodes.find((n) => n.locationId === 'warehouse')!.status).toBe('known');
    expect(map.edges.find((e) => e.to === 'warehouse' || e.from === 'warehouse')!.locked).toBe(true);
  });
});

describe('세이브 v6 (장소 방문 기록)', () => {
  it('v5 세이브의 방문 기록은 확실한 근거가 있는 장소만 채운다', () => {
    const base = createInitialState();
    const v5 = {
      ...base,
      version: 5,
      player: { ...base.player, location: 'port_docks', x: 3, y: 6 },
      flags: { found_invitation: true, warehouse_opened: true },
      unlocked: ['warehouse'],
      visitedRegions: ['goblin_market', 'trickster_port'],
    } as Record<string, unknown>;
    delete v5.visitedLocations;
    const restored = importSave(JSON.stringify(v5))!;
    expect(restored.version).toBe(SAVE_VERSION);
    expect(restored.player.location).toBe('port_docks');
    expect([...restored.visitedLocations].sort()).toEqual(['market', 'port_docks', 'warehouse']);
  });

  it('창고를 해금만 하고 들어가지 않은 세이브는 창고를 방문으로 기록하지 않는다', () => {
    const base = createInitialState();
    const v5 = { ...base, version: 5, unlocked: ['warehouse'], flags: { warehouse_opened: true } } as Record<string, unknown>;
    delete v5.visitedLocations;
    const restored = importSave(JSON.stringify(v5))!;
    expect(restored.visitedLocations).not.toContain('warehouse');
  });

  it('프롤로그 도중인 새 모험은 입구 장터를 방문으로 기록하지 않는다', () => {
    const base = createInitialState();
    const v5 = {
      ...base,
      version: 5,
      player: { ...base.player, location: 'market_road', x: 2, y: 6 },
      quests: { q_prologue: { stage: 'card', completed: ['road'] }, q_invitation: { stage: 'start', completed: [] } },
    } as Record<string, unknown>;
    delete v5.visitedLocations;
    const restored = importSave(JSON.stringify(v5))!;
    expect(restored.visitedLocations).toEqual(['market_road']);
  });
});
