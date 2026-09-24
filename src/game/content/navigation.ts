import type { ExitDef, FutureWayDef, GameState, LocationDef } from '../types';
import { LOCATIONS } from './world';

/**
 * 장소 연결 구조 — 출입구 조회, 열림 여부, 연결 그래프 검증.
 * 모든 장소 이동 경로는 LOCATIONS[*].exits 데이터에서만 나온다.
 */

export function getExit(locationId: string, entityId: string): ExitDef | undefined {
  return LOCATIONS[locationId]?.exits.find((e) => e.entityId === entityId);
}

export function getFutureWay(locationId: string, entityId: string): FutureWayDef | undefined {
  return LOCATIONS[locationId]?.futureWays?.find((w) => w.entityId === entityId);
}

export function isExitOpen(exit: ExitDef, state: GameState): boolean {
  const r = exit.requires;
  if (!r) return true;
  if (r.unlocked && !state.unlocked.includes(r.unlocked)) return false;
  if (r.flag && state.flags[r.flag] !== true) return false;
  return true;
}

/** 지역 이름을 포함한 장소 표시 이름 (예: "고블린 시장 · 입구 장터") */
export const REGION_NAMES: Record<string, string> = {
  goblin_market: '고블린 시장',
  trickster_port: '사기꾼들의 항구',
  ghost_casino: '유령 카지노',
  golden_city: '황금 도시',
};

export function locationLabel(locationId: string): string {
  const loc = LOCATIONS[locationId];
  if (!loc) return locationId;
  const region = REGION_NAMES[loc.regionId];
  return region ? `${region} · ${loc.name}` : loc.name;
}

/** 출입구 목적지 이름 — 같은 지역이면 장소 이름만, 다른 지역이면 지역 이름 포함 */
export function exitDestinationLabel(fromLocationId: string, exit: ExitDef): string {
  const from = LOCATIONS[fromLocationId];
  const to = LOCATIONS[exit.to];
  if (!to) return exit.to;
  return from && from.regionId === to.regionId ? to.name : locationLabel(exit.to);
}

export function isCrossRegionExit(fromLocationId: string, exit: ExitDef): boolean {
  return LOCATIONS[fromLocationId]?.regionId !== LOCATIONS[exit.to]?.regionId;
}

export function locationsInRegion(regionId: string): LocationDef[] {
  return Object.values(LOCATIONS).filter((l) => l.regionId === regionId);
}

// ── 지역 내부 지도 ──

/** 지역 지도에서 장소 노드 위치 (%) — 게임 속 방향(북=위)과 맞춘다 */
export const REGION_MAP_POS: Record<string, { x: number; y: number }> = {
  market_road: { x: 50, y: 84 },
  market: { x: 50, y: 50 },
  warehouse: { x: 38, y: 16 },
  central_market: { x: 74, y: 20 },
  port_docks: { x: 50, y: 50 },
};

export type MapNodeStatus = 'current' | 'visited' | 'known';

export interface RegionMapNode {
  locationId: string;
  name: string;
  status: MapNodeStatus;
  pos: { x: number; y: number };
}

export interface RegionMapEdge {
  from: string;
  to: string;
  locked: boolean;
}

/**
 * 플레이어가 아는 범위의 지역 지도.
 * - 방문한 장소 + 방문한 장소의 출입구로 이어진 장소만 보인다 (모르는 장소는 드러내지 않음)
 * - 잠긴 연결은 locked로 표시
 */
export function buildRegionMap(
  regionId: string,
  state: GameState,
): {
  nodes: RegionMapNode[];
  edges: RegionMapEdge[];
  outbound: { from: string; label: string }[];
  stubs: { from: string; label: string; direction: string }[];
} {
  const members = locationsInRegion(regionId);
  const visited = new Set(state.visitedLocations);
  const known = new Set<string>();
  for (const loc of members) {
    if (!visited.has(loc.id)) continue;
    known.add(loc.id);
    for (const exit of loc.exits) {
      if (LOCATIONS[exit.to]?.regionId === regionId) known.add(exit.to);
    }
  }
  const nodes: RegionMapNode[] = members
    .filter((l) => known.has(l.id))
    .map((l) => ({
      locationId: l.id,
      name: l.name,
      status: state.player.location === l.id ? 'current' : visited.has(l.id) ? 'visited' : 'known',
      pos: REGION_MAP_POS[l.id] ?? { x: 50, y: 50 },
    }));
  const edges: RegionMapEdge[] = [];
  const outbound: { from: string; label: string }[] = [];
  for (const loc of members) {
    if (!known.has(loc.id)) continue;
    for (const exit of loc.exits) {
      const target = LOCATIONS[exit.to];
      if (!target) continue;
      if (target.regionId !== regionId) {
        if (visited.has(loc.id)) outbound.push({ from: loc.id, label: `${exit.direction}: ${locationLabel(exit.to)}` });
        continue;
      }
      if (!known.has(exit.to)) continue;
      // 양방향 연결은 한 번만 그린다
      if (edges.some((e) => e.from === exit.to && e.to === loc.id)) continue;
      const back = target.exits.find((x) => x.to === loc.id);
      const locked = !isExitOpen(exit, state) || (back !== undefined && !isExitOpen(back, state));
      edges.push({ from: loc.id, to: exit.to, locked });
    }
  }
  // 막힌 길: 해당 장소를 방문했을 때만 표시 (열린 것처럼 보이지 않게 이름 대신 길 모습으로)
  const stubs: { from: string; label: string; direction: string }[] = [];
  for (const loc of members) {
    if (!visited.has(loc.id)) continue;
    for (const w of loc.futureWays ?? []) stubs.push({ from: loc.id, label: w.label, direction: w.direction });
  }
  return { nodes, edges, outbound, stubs };
}

// ── 그래프 검증 (테스트·개발자 툴에서 사용) ──

function isFreeTile(loc: LocationDef, x: number, y: number): boolean {
  const row = loc.layout[y];
  if (!row || row[x] !== '.') return false;
  return !loc.entities.some((e) => e.x === x && e.y === y);
}

/**
 * 연결 구조의 무결성을 검사한다. 문제 목록을 반환(빈 배열이면 정상).
 * - 출입구 엔티티와 exits 정의의 1:1 대응
 * - 목적지 장소 존재, 도착 좌표가 이동 가능한 빈 칸
 * - 도착 좌표가 출입구 바로 옆이라 즉시 되돌아가게 되는 경우는 경고하지 않음(문 앞 도착은 자연스러움)
 * - 같은 지역 내 연결은 양방향
 * - 지역의 모든 장소가 서로 도달 가능 (잠금 무시)
 */
export function validateLocationGraph(locations: Record<string, LocationDef> = LOCATIONS): string[] {
  const problems: string[] = [];
  for (const loc of Object.values(locations)) {
    const exitEntities = loc.entities.filter((e) => e.kind === 'exit');
    for (const ent of exitEntities) {
      if (!loc.exits.some((x) => x.entityId === ent.id)) {
        problems.push(`${loc.id}: 출입구 엔티티 '${ent.id}'에 exits 정의가 없다`);
      }
    }
    for (const exit of loc.exits) {
      const ent = loc.entities.find((e) => e.id === exit.entityId);
      if (!ent) problems.push(`${loc.id}: exits '${exit.entityId}'에 해당하는 엔티티가 없다`);
      else if (ent.kind !== 'exit') problems.push(`${loc.id}: '${exit.entityId}'의 kind가 exit가 아니다`);
      const target = locations[exit.to];
      if (!target) {
        problems.push(`${loc.id}: '${exit.entityId}'의 목적지 '${exit.to}'가 없다`);
        continue;
      }
      if (!isFreeTile(target, exit.arrive.x, exit.arrive.y)) {
        problems.push(`${loc.id} → ${exit.to}: 도착 좌표 (${exit.arrive.x},${exit.arrive.y})가 이동 가능한 빈 칸이 아니다`);
      }
      if (target.regionId === loc.regionId && !target.exits.some((x) => x.to === loc.id)) {
        problems.push(`${loc.id} → ${exit.to}: 같은 지역인데 되돌아오는 출입구가 없다`);
      }
    }
    for (const way of loc.futureWays ?? []) {
      const ent = loc.entities.find((e) => e.id === way.entityId);
      if (!ent) problems.push(`${loc.id}: 막힌 길 '${way.entityId}'에 해당하는 장애물 엔티티가 없다`);
      else if (ent.kind === 'exit') problems.push(`${loc.id}: 막힌 길 '${way.entityId}'가 이동 가능한 출입구로 정의되어 있다`);
      if (!way.label || !way.lockedHint) problems.push(`${loc.id}: 막힌 길 '${way.entityId}'에 label/lockedHint가 없다`);
      if (loc.exits.some((x) => x.entityId === way.entityId)) {
        problems.push(`${loc.id}: '${way.entityId}'가 출입구와 막힌 길에 동시에 정의되어 있다`);
      }
    }
    if (!isFreeTile(loc, loc.playerStart.x, loc.playerStart.y)) {
      problems.push(`${loc.id}: 시작 좌표가 이동 가능한 빈 칸이 아니다`);
    }
  }
  // 지역 내 연결성
  const regions = new Set(Object.values(locations).map((l) => l.regionId));
  for (const regionId of regions) {
    const members = Object.values(locations).filter((l) => l.regionId === regionId);
    if (members.length <= 1) continue;
    const seen = new Set<string>([members[0].id]);
    const queue = [members[0].id];
    while (queue.length) {
      const cur = locations[queue.shift()!];
      for (const exit of cur.exits) {
        if (locations[exit.to]?.regionId === regionId && !seen.has(exit.to)) {
          seen.add(exit.to);
          queue.push(exit.to);
        }
      }
    }
    for (const m of members) {
      if (!seen.has(m.id)) problems.push(`${regionId}: 장소 '${m.id}'에 지역 안에서 도달할 수 없다`);
    }
  }
  return problems;
}
