/**
 * 비주얼 씬 정의 — 게임 로직(그리드 좌표·충돌)과 분리된 렌더링 데이터.
 *
 * 방식: 배경 플레이트(3/4 부감 시점 일러스트) 위에
 * 논리 그리드 좌표를 원근 사다리꼴(trapezoid)로 투영한다.
 * - 게임 내부 위치·충돌 판정은 기존 그리드 그대로 유지된다.
 * - 화면 위치(%)와 캐릭터 스케일은 투영 결과로만 결정된다.
 * - 렌더링 순서는 투영된 화면 Y좌표 기반(Y-sort)으로 앞뒤가 정해진다.
 */

import marketBg from '../../assets/market-bg.jpg';
import warehouseBg from '../../assets/warehouse-bg.jpg';
import portBg from '../../assets/port-docks-bg.jpg';
import finStand from '../../assets/fin-stand.png';
import roadBg from '../../assets/market-road-bg.jpg';
import gateMerchantCart from '../../assets/gate-merchant-cart.png';
import centralMarketBg from '../../assets/central-market-bg.jpg';
import alleyMouth from '../../assets/alley-mouth.png';
import s01aStand from '../../assets/s01-a-stand.png';
import s01bStand from '../../assets/s01-b-stand.png';
import onlookerStand from '../../assets/s01-onlooker.png';
import guardsSprite from '../../assets/s01-guards.png';
import playerFront from '../../assets/player-front.png';
import playerBack from '../../assets/player-back.png';
import playerLeft from '../../assets/player-left.png';
import playerRight from '../../assets/player-right.png';
import goblinStall from '../../assets/goblin-stall.png';
import miraStall from '../../assets/mira-stall.png';
import cratesSprite from '../../assets/crates.png';
import boardSprite from '../../assets/board.png';
import doorSprite from '../../assets/door.png';
import chestSprite from '../../assets/chest.png';

export type Facing = 'down' | 'up' | 'left' | 'right';

export const PLAYER_SPRITES: Record<Facing, string> = {
  down: playerFront,
  up: playerBack,
  left: playerLeft,
  right: playerRight,
};

/** 씬 오브젝트의 시각 정보 — 위치는 LOCATIONS의 엔티티 그리드 좌표에서 투영 */
export interface SceneObjectVisual {
  entityId: string;
  /** 빈 문자열이면 이미지 대신 glow 표시만 사용 */
  sprite: string;
  /** 바닥에 떨어진 물건 등 — 반짝이는 빛으로 표시 */
  glow?: boolean;
  /** 이 플래그가 켜지면 오브젝트를 숨긴다 (예: 주운 물건) */
  hideWhenFlag?: string;
  /** 원근 스케일 1.0 기준, 씬 높이 대비 스프라이트 높이(%) */
  height: number;
  /** 화면 X 미세 조정 (씬 폭 %) */
  offsetX?: number;
  /** 화면 Y 미세 조정 (씬 높이 %) */
  offsetY?: number;
  /** 이름표를 보여줄지 (주요 NPC) */
  nameplate?: boolean;
}

/** 원근 투영 사다리꼴: t=0(그리드 최상단) / t=1(최하단)의 좌우 경계와 화면 Y */
export interface SceneProjection {
  top: { left: number; right: number; y: number };
  bottom: { left: number; right: number; y: number };
  scaleTop: number;
  scaleBottom: number;
}

export interface SceneDef {
  locationId: string;
  bg: string;
  /** 씬 컨테이너 가로:세로 비율 */
  aspect: string;
  /** 배경 이미지 가로/세로 비 (카메라 월드 크기 계산용) */
  bgAspect: number;
  /**
   * 카메라 줌 — 뷰포트 세로에 씬 전체 높이의 1/zoom 만큼만 보인다.
   * 카메라는 플레이어를 따라가며 씬 경계에서 클램프된다.
   */
  cameraZoom: number;
  projection: SceneProjection;
  /** 원근 스케일 1.0 기준 플레이어 높이 (씬 높이 %) */
  playerHeight: number;
  objects: SceneObjectVisual[];
  /** 씬 분위기 오버레이 색 (선택) */
  tint?: string;
}

export const SCENES: Record<string, SceneDef> = {
  market_road: {
    locationId: 'market_road',
    bg: roadBg,
    aspect: '2 / 3',
    bgAspect: 1376 / 2039,
    cameraZoom: 1.6,
    projection: {
      top: { left: 34, right: 66, y: 17 },
      bottom: { left: 18, right: 80, y: 100 },
      scaleTop: 0.58,
      scaleBottom: 1.0,
    },
    playerHeight: 17,
    objects: [
      { entityId: 'gate_merchant', sprite: gateMerchantCart, height: 19, offsetX: 8, nameplate: true },
      { entityId: 'old_card', sprite: '', glow: true, height: 3, hideWhenFlag: 'prologue_card' },
    ],
  },
  market: {
    locationId: 'market',
    bg: marketBg,
    aspect: '2 / 3',
    bgAspect: 1376 / 2039,
    cameraZoom: 1.85,
    projection: {
      top: { left: 32, right: 69, y: 16 },
      bottom: { left: 8, right: 92, y: 101 },
      scaleTop: 0.52,
      scaleBottom: 1.0,
    },
    playerHeight: 17,
    objects: [
      { entityId: 'warehouse_door', sprite: doorSprite, height: 15, offsetY: 0.5 },
      { entityId: 'board', sprite: boardSprite, height: 14, offsetX: 3 },
      { entityId: 'goblin', sprite: goblinStall, height: 24, offsetX: -3, nameplate: true },
      { entityId: 'mira', sprite: miraStall, height: 22, offsetX: 3, nameplate: true },
      { entityId: 'crates', sprite: cratesSprite, height: 15 },
      { entityId: 'central_market_passage', sprite: alleyMouth, height: 22, offsetX: 5, offsetY: 2 },
    ],
  },
  central_market: {
    locationId: 'central_market',
    bg: centralMarketBg,
    aspect: '2 / 3',
    bgAspect: 1376 / 2039,
    cameraZoom: 1.5,
    projection: {
      top: { left: 5, right: 95, y: 12 },
      bottom: { left: 2, right: 98, y: 100 },
      scaleTop: 0.72,
      scaleBottom: 1.0,
    },
    playerHeight: 16,
    objects: [
      // 북쪽 수레·동쪽 바리케이드는 배경에 그려져 있다. 서쪽 입구는 배경에 막힘이 없어 짐 더미를 둔다.
      { entityId: 'gm03_west_pile', sprite: cratesSprite, height: 15, offsetX: -3 },
      { entityId: 's01_a', sprite: s01aStand, height: 15, offsetX: 2, offsetY: -3, nameplate: true },
      { entityId: 's01_b', sprite: s01bStand, height: 15, offsetX: -2, offsetY: -3, nameplate: true },
      { entityId: 's01_guards', sprite: guardsSprite, height: 5 },
      { entityId: 's01_onlooker', sprite: onlookerStand, height: 13 },
    ],
  },
  warehouse: {
    locationId: 'warehouse',
    bg: warehouseBg,
    aspect: '2 / 3',
    bgAspect: 1376 / 2039,
    cameraZoom: 1.45,
    projection: {
      top: { left: 28, right: 72, y: 30 },
      bottom: { left: 20, right: 80, y: 90 },
      scaleTop: 0.62,
      scaleBottom: 1.0,
    },
    playerHeight: 17,
    objects: [
      { entityId: 'chest', sprite: chestSprite, height: 11 },
      { entityId: 'ledger_scrap', sprite: boardSprite, height: 9, offsetX: 1 },
      // exit_door: 배경 플레이트에 문이 그려져 있어 스프라이트 없이 상호작용 지점만 사용
    ],
    tint: 'rgba(20, 24, 46, 0.25)',
  },
  port_docks: {
    locationId: 'port_docks',
    bg: portBg,
    aspect: '2 / 3',
    bgAspect: 1376 / 2039,
    cameraZoom: 1.7,
    projection: {
      top: { left: 32, right: 63, y: 15 },
      bottom: { left: 14, right: 82, y: 101 },
      scaleTop: 0.55,
      scaleBottom: 1.0,
    },
    playerHeight: 17,
    objects: [
      // harbor_gate / tavern_door / pier_notice 일부는 배경에 그려져 있어 마커만 사용
      { entityId: 'pier_notice', sprite: boardSprite, height: 12, offsetX: 2 },
      { entityId: 'fin', sprite: finStand, height: 22, offsetX: 3, nameplate: true },
      { entityId: 'cargo', sprite: cratesSprite, height: 14, offsetX: -2 },
    ],
    tint: 'rgba(10, 30, 40, 0.12)',
  },
};

export interface ProjectedPoint {
  /** 씬 폭 대비 % */
  x: number;
  /** 씬 높이 대비 % (스프라이트 발 위치) */
  y: number;
  /** 원근 스케일 */
  scale: number;
  /** Y-sort용 z-index */
  z: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 그리드 좌표 → 화면 좌표(%). rows/cols는 해당 지역 레이아웃 크기 */
export function projectToScreen(
  proj: SceneProjection,
  cols: number,
  rows: number,
  gx: number,
  gy: number,
): ProjectedPoint {
  const t = (gy + 0.5) / rows;
  const u = (gx + 0.5) / cols;
  const left = lerp(proj.top.left, proj.bottom.left, t);
  const right = lerp(proj.top.right, proj.bottom.right, t);
  const x = lerp(left, right, u);
  const y = lerp(proj.top.y, proj.bottom.y, t);
  const scale = lerp(proj.scaleTop, proj.scaleBottom, t);
  return { x, y, scale, z: 100 + Math.round(y * 10) };
}
