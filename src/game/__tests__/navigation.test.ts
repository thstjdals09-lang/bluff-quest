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
    const open = tree.nodes[tree.entry].choices.find((c) => c.text === '문을 열고 들어간다')!;
    expect(open).toBeDefined();
    // 열쇠로 연 즉시 기존 출입구 전환으로 입장 (두 번 말을 걸 필요 없음)
    const inside = (open.effects ?? []).reduce(reducer, s);
    expect(inside.player.location).toBe('warehouse');
    expect(inside.flags.warehouse_opened).toBe(true);
    expect(inside.unlocked).toContain('warehouse');
    expect(inside.quests.q_invitation?.stage).toBe('open_warehouse');
  });

  it('열쇠가 없으면 창고 문은 잠긴 채 그대로다', () => {
    const s = at(createInitialState(), 'market', 3, 1);
    const tree = getInteraction('warehouse_door', s);
    const all = Object.values(tree.nodes).flatMap((n) => n.choices).flatMap((c) => c.effects ?? []);
    expect(all.some((e) => e.type === 'USE_EXIT' || e.type === 'UNLOCK')).toBe(false);
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
    expect(ids).toEqual(['central_market', 'market', 'market_road', 'warehouse']);
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

describe('GM-03 중앙 장터 연결 (GM-P2-IMPL-A)', () => {
  it('입구 장터 기둥 옆 골목 ↔ 중앙 장터 왕복이 된다', () => {
    let s = at(createInitialState(), 'market', 6, 1);
    s = reducer(s, { type: 'USE_EXIT', entityId: 'central_market_passage' });
    expect(s.player.location).toBe('central_market');
    expect(s.player).toMatchObject({ x: 4, y: 7 });
    expect(s.visitedLocations).toContain('central_market');
    s = at(s, 'central_market', 4, 7);
    s = reducer(s, { type: 'USE_EXIT', entityId: 'gm03_south' });
    expect(s.player.location).toBe('market');
    expect(s.player).toMatchObject({ x: 6, y: 1 });
  });

  it('창고 문 (3,0)은 그대로 잠긴 출입구로 남는다', () => {
    const door = LOCATIONS.market.entities.find((e) => e.id === 'warehouse_door')!;
    expect(door).toMatchObject({ x: 3, y: 0, kind: 'exit' });
    expect(getExit('market', 'warehouse_door')!.requires).toEqual({ unlocked: 'warehouse' });
  });

  it('W0b: 중앙 장터의 북·서·동 좁은 틈은 GM-07·GM-05·GM-04로 가는 출구, 화물 수레는 치워지지 않은 조사 대상', () => {
    const loc = LOCATIONS.central_market;
    expect(loc.futureWays ?? []).toEqual([]);
    const dest = { gm03_north_gap: 'gm07_street', gm03_west_pile: 'gm05_alley', gm03_east_barricade: 'gm04_shops' } as const;
    for (const [id, to] of Object.entries(dest)) {
      expect(loc.entities.find((e) => e.id === id)!.kind).toBe('exit');
      expect(getExit('central_market', id)!.to).toBe(to);
    }
    const cart = loc.entities.find((e) => e.id === 'gm03_north_cart')!;
    expect(cart.kind).toBe('poi');
    const s = at(createInitialState(), 'central_market', 4, 1);
    const tree = getInteraction('gm03_north_cart', s);
    expect(tree.nodes[tree.entry].text).toContain('좁은 틈');
    expect(tree.nodes[tree.entry].text).toContain('못 치워');
    expect(tree.nodes[tree.entry].choices.every((c) => !c.effects)).toBe(true);
    expect(reducer(s, { type: 'USE_EXIT', entityId: 'gm03_north_cart' })).toBe(s);
  });

  it('틈 출구 세 곳 모두 걸어서 다가갈 수 있다 (인접한 빈 칸 존재)', () => {
    const loc = LOCATIONS.central_market;
    const free = (x: number, y: number) =>
      loc.layout[y]?.[x] === '.' && !loc.entities.some((e) => e.x === x && e.y === y);
    for (const id of ['gm03_north_gap', 'gm03_west_pile', 'gm03_east_barricade']) {
      const e = loc.entities.find((en) => en.id === id)!;
      const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => free(e.x + dx, e.y + dy));
      expect(around, id).toBe(true);
    }
  });

  it('검사기: 막힌 길이 출입구로 잘못 정의되면 잡아낸다', () => {
    const broken = structuredClone(LOCATIONS);
    broken.central_market.futureWays = [{ entityId: 'gm03_north_cart', code: 'GM-07', label: '북쪽 길', direction: '북', lockedHint: '막힘' }];
    broken.central_market.entities.find((e) => e.id === 'gm03_north_cart')!.kind = 'exit';
    expect(validateLocationGraph(broken).some((p) => p.includes('gm03_north_cart'))).toBe(true);
  });

  it('지역 지도: 중앙 장터를 방문하면 이웃 장소(GM-04·05·07)가 노드로 보이고 막힌 길 표시는 없다', () => {
    let s = at(createInitialState(), 'market', 6, 1);
    s = reducer(s, { type: 'USE_EXIT', entityId: 'central_market_passage' });
    const map = buildRegionMap('goblin_market', s);
    const ids = map.nodes.map((n) => n.locationId);
    for (const id of ['central_market', 'gm04_shops', 'gm05_alley', 'gm07_street']) expect(ids).toContain(id);
    expect(ids).not.toContain('gm06_storeroom'); // 아직 모르는 곳은 드러내지 않는다
    expect(map.stubs).toEqual([]);
  });

  it('저장 위치가 막힌 칸이면 로드 시 시작 좌표로 보정된다', async () => {
    const { normalizePosition } = await import('../save');
    const s = at(createInitialState(), 'central_market', 0, 0);
    expect(normalizePosition(s).player).toMatchObject(LOCATIONS.central_market.playerStart);
    const ok = at(createInitialState(), 'market', 6, 1);
    expect(normalizePosition(ok)).toBe(ok);
  });
});
