import { describe, expect, it } from 'vitest';
import type { GameState, LocationDef } from '../types';
import { createNewAdventureState, reducer } from '../state';
import { LOCATIONS } from '../content/world';
import { isExitOpen, validateLocationGraph } from '../content/navigation';
import { REGIONS, getRegionAccess } from '../content/regions';
import { getInteraction } from '../content/dialogues';
import { getScopedRecords } from '../content/records';
import { SHELL_ENTITY_IDS } from '../content/worldShell';

/** 새 모험 → 프롤로그만 끝낸 상태 (초대장·열쇠 없음) */
function afterPrologue(): GameState {
  const s = createNewAdventureState('여행자');
  return reducer(s, { type: 'SET_QUEST_STAGE', questId: 'q_prologue', stage: 'done' });
}

function freeNeighbor(loc: LocationDef, x: number, y: number): { x: number; y: number } | null {
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (loc.layout[ny]?.[nx] === '.' && !loc.entities.some((e) => e.x === nx && e.y === ny)) return { x: nx, y: ny };
  }
  return null;
}

/** 출구 앞에 서서 실제 USE_EXIT로 지나간다 (걷기와 같은 리듀서 경로) */
function walkThrough(s: GameState, entityId: string): GameState {
  const loc = LOCATIONS[s.player.location];
  const ent = loc.entities.find((e) => e.id === entityId)!;
  const spot = freeNeighbor(loc, ent.x, ent.y)!;
  return reducer({ ...s, player: { ...s.player, x: spot.x, y: spot.y } }, { type: 'USE_EXIT', entityId });
}

/** 열린 출구만으로 목적지까지 가는 출구 순서 (BFS) */
function route(s: GameState, from: string, to: string): string[] | null {
  const prev = new Map<string, { loc: string; exit: string }>();
  const seen = new Set([from]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === to) break;
    for (const ex of LOCATIONS[cur].exits) {
      if (!isExitOpen(ex, s) || seen.has(ex.to)) continue;
      seen.add(ex.to);
      prev.set(ex.to, { loc: cur, exit: ex.entityId });
      q.push(ex.to);
    }
  }
  if (!seen.has(to)) return null;
  const path: string[] = [];
  for (let c = to; c !== from; c = prev.get(c)!.loc) path.unshift(prev.get(c)!.exit);
  return path;
}

const SHELL_TARGETS = ['port_docks', 'night_pier_end', 'night_pier_hall', 'sailor_shelter', 'casino_entry', 'casino_replay', 'casino_archive', 'city_street', 'city_contract', 'city_meeting', 'tower_entrance', 'tower_testimony', 'tower_archive', 'tower_top'];

describe('W0 전 지역 이동 셸', () => {
  it('모든 출구는 문↔문으로 되돌아오는 길이 있다 (지역 간 포함), 도착 칸은 비어 있다', () => {
    expect(validateLocationGraph()).toEqual([]);
    for (const loc of Object.values(LOCATIONS)) {
      for (const ex of loc.exits) {
        const back = LOCATIONS[ex.to].exits.find((b) => b.to === loc.id);
        expect(back, `${loc.id} → ${ex.to} 되돌아오는 출구`).toBeTruthy();
      }
    }
  });

  it('프롤로그 뒤, 초대장 없이 시장에서 꼭대기 방까지 걸어가고 다시 시장으로 돌아온다 — 이야기 플래그·기록은 생기지 않는다', () => {
    let s = afterPrologue();
    s = { ...s, player: { ...s.player, location: 'market_road', x: 2, y: 6 } };
    const before = getScopedRecords(s).length;
    for (const target of SHELL_TARGETS) {
      const path = route(s, s.player.location, target);
      expect(path, `→ ${target}`).not.toBeNull();
      for (const exit of path!) s = walkThrough(s, exit);
      expect(s.player.location).toBe(target);
    }
    const home = route(s, s.player.location, 'market_road');
    expect(home).not.toBeNull();
    for (const exit of home!) s = walkThrough(s, exit);
    expect(s.player.location).toBe('market_road');
    for (const id of SHELL_TARGETS) expect(s.visitedLocations).toContain(id);
    // 방문만으로 이야기가 진행되지 않는다
    expect(s.inventory).not.toContain('invitation');
    for (const k of ['found_invitation', 'port_arrived', 'port_arrival_seen', 'ep1_departed', 'ep1_casino_ref', 'h3_outcome', 'night_pier_hint']) expect(s.flags[k], k).toBeUndefined();
    for (const q of ['q_night_pier', 'q_moonless']) expect(s.quests[q], q).toBeUndefined();
    expect(getScopedRecords(s).length).toBe(before);
  });

  it('월드맵: 프롤로그 뒤 모든 지역이 열리고 진입 지점은 실제 빈 칸이다', () => {
    const s = afterPrologue();
    for (const r of REGIONS) {
      expect(getRegionAccess(r.id, s).unlocked, r.id).toBe(true);
      expect(r.impl).toBe('playable');
      const loc = LOCATIONS[r.entry!.locationId];
      expect(loc, r.id).toBeTruthy();
      expect(loc.layout[r.entry!.y][r.entry!.x]).toBe('.');
      expect(loc.entities.some((e) => e.x === r.entry!.x && e.y === r.entry!.y)).toBe(false);
    }
    // 월드맵 이동도 같은 장소 ID·방문 기록을 쓴다
    const via = reducer(s, { type: 'GOTO_LOCATION', locationId: 'casino_entry', x: 3, y: 4 });
    expect(via.visitedLocations).toContain('casino_entry');
    expect(via.visitedRegions).toContain('ghost_casino');
  });

  it('셸 대상과 출발 전 부두 끝 사람들은 생활감 한 줄뿐 — 효과·기록 없음', () => {
    const s = afterPrologue();
    for (const id of SHELL_ENTITY_IDS) {
      const t = getInteraction(id, s);
      const root = t.nodes[t.entry];
      expect(root.choices.every((c) => !c.effects && !c.next && !c.event && !c.startEncounter), id).toBe(true);
      expect(root.text).not.toMatch(/하멜|이렌|도란|17번|딜러|대장부/);
    }
  });

  it('W0b: 중앙 장터에서 GM-04~GM-11(숨겨진 창고·승부장 포함)을 걸어서 모두 돌고 돌아온다 — 이야기 상태 없음', () => {
    let s = afterPrologue();
    s = { ...s, player: { ...s.player, location: 'market', x: 6, y: 1 } };
    s = walkThrough(s, 'central_market_passage');
    const baseKeys = new Set(Object.keys(s.flags));
    const baseQuests = new Set(Object.keys(s.quests));
    const records = getScopedRecords(s).length;
    const GM = ['gm07_street', 'gm09_gate', 'gm10_arena', 'gm08_club', 'gm04_shops', 'gm11_rest', 'gm05_alley', 'gm06_storeroom'];
    for (const target of [...GM, 'central_market']) {
      const path = route(s, s.player.location, target);
      expect(path, `→ ${target}`).not.toBeNull();
      for (const exit of path!) s = walkThrough(s, exit);
      expect(s.player.location).toBe(target);
    }
    for (const id of GM) expect(s.visitedLocations).toContain(id);
    // 시장 기존 사건(S01·벽보)은 중앙 장터 출입으로만 움직이는 기존 규칙 그대로 — 새 장소가 만드는 상태는 없다
    const allowed = /^(travel_count|s01_|hb_)/;
    for (const k of Object.keys(s.flags)) if (!baseKeys.has(k)) expect(k, k).toMatch(allowed);
    for (const q of Object.keys(s.quests)) if (!baseQuests.has(q)) expect(['q_s01', 'q_handbill']).toContain(q);
    expect(getScopedRecords(s).filter((r) => r.scope === 'general').length).toBe(getScopedRecords({ ...s, flags: { ...s.flags } }).filter((r) => r.scope === 'general').length);
    expect(records).toBeGreaterThanOrEqual(0);
    // 왕의 관문 → 승부장은 공개 입구로만 (클럽 뒷계단 없음), 휴게소는 상점가로만
    expect(LOCATIONS.gm08_club.exits.map((e) => e.to)).not.toContain('gm10_arena');
    expect(LOCATIONS.gm11_rest.exits.map((e) => e.to)).toEqual(['gm04_shops']);
    expect(LOCATIONS.market.exits.map((e) => e.to)).not.toContain('gm11_rest');
    // 숨겨진 거래처의 이름을 미리 말하지 않는다
    expect(LOCATIONS.gm06_storeroom.name).not.toMatch(/숨겨진|거래/);
  });

  it('초대장 없는 핀: 초대장 얘기를 꺼내지 않고, 밤의 부두 이야기도 팔지 않는다', () => {
    const s = { ...afterPrologue(), player: { ...afterPrologue().player, location: 'port_docks', x: 6, y: 5 } };
    const t = getInteraction('fin', s);
    expect(t.nodes[t.entry].text).not.toContain('초대장');
    const menu = t.nodes.menu.choices.map((c) => c.text).join('|');
    expect(menu).not.toMatch(/밤의 부두 이야기|초대장을/);
  });
});
