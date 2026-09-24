import type { LocationDef } from '../types';

/**
 * W0b 고블린 시장 내부 이동 셸 — GM-04~GM-11 (STORY_STUB, 그림 없음). 설계: docs/plans/GM_MARKET_SHELL_PLAN.md
 * 장소 방문은 이야기와 별개: 숨겨진 거래(GM-06)·도전 접수·보스전(GM-09/10)은 조건 전에 열리지 않는다.
 * 모든 출구는 문↔문 왕복. GM-08↔GM-10 뒷계단, GM-02↔GM-11 출구는 만들지 않는다(티티 결정).
 */
const wall = '#######';
const floor = '.......';

export const GM_SHELL_LOCATIONS: Record<string, LocationDef> = {
  gm07_street: {
    id: 'gm07_street',
    name: '승부사 거리',
    regionId: 'goblin_market',
    code: 'GM-07',
    arrivalNote: '수레 옆 틈을 빠져나오면 도전 포스터가 덕지덕지 붙은 거리. 북쪽은 왕의 관문, 동쪽은 포커 클럽.',
    stub: { tone: '#1f140c' },
    layout: [wall, floor, floor, floor, floor, floor, wall],
    entities: [
      { id: 'gm07_north', kind: 'exit', x: 3, y: 0, icon: '🏯', name: '왕의 관문' },
      { id: 'gm07_poster', kind: 'poi', x: 1, y: 1, icon: '📜', name: '도전 포스터' },
      { id: 'gm07_club_door', kind: 'exit', x: 6, y: 3, icon: '🃏', name: '포커 클럽' },
      { id: 'gm07_table', kind: 'poi', x: 1, y: 4, icon: '🎲', name: '작은 승부판' },
      { id: 'gm07_onlooker', kind: 'npc', x: 5, y: 5, icon: '👀', name: '구경꾼' },
      { id: 'gm07_south', kind: 'exit', x: 3, y: 6, icon: '🛒', name: '중앙 장터 (수레 옆 틈)' },
    ],
    exits: [
      { entityId: 'gm07_north', to: 'gm09_gate', arrive: { x: 3, y: 4 }, direction: '북' },
      { entityId: 'gm07_club_door', to: 'gm08_club', arrive: { x: 1, y: 3 }, direction: '동' },
      { entityId: 'gm07_south', to: 'central_market', arrive: { x: 2, y: 1 }, direction: '남' },
    ],
    playerStart: { x: 3, y: 5 },
  },
  gm09_gate: {
    id: 'gm09_gate',
    name: '왕의 관문',
    regionId: 'goblin_market',
    code: 'GM-09',
    arrivalNote: '접수대와 웅성거리는 관객. 동쪽 큰 문 너머가 왕고블린 승부장이다.',
    stub: { tone: '#20120e' },
    layout: [wall, floor, floor, floor, floor, wall],
    entities: [
      { id: 'gm09_clerk', kind: 'npc', x: 3, y: 1, icon: '📋', name: '접수원' },
      { id: 'gm09_crowd', kind: 'npc', x: 1, y: 2, icon: '🙌', name: '구경하는 관객' },
      { id: 'gm09_arena_gate', kind: 'exit', x: 6, y: 2, icon: '🏟️', name: '승부장 문' },
      { id: 'gm09_south', kind: 'exit', x: 3, y: 5, icon: '🚪', name: '승부사 거리' },
    ],
    exits: [
      { entityId: 'gm09_arena_gate', to: 'gm10_arena', arrive: { x: 1, y: 2 }, direction: '동' },
      { entityId: 'gm09_south', to: 'gm07_street', arrive: { x: 3, y: 1 }, direction: '남' },
    ],
    playerStart: { x: 3, y: 3 },
  },
  gm10_arena: {
    id: 'gm10_arena',
    name: '왕고블린 승부장',
    regionId: 'goblin_market',
    code: 'GM-10',
    arrivalNote: '둥근 관객석이 빈 무대를 둘러싸고 있다.',
    stub: { tone: '#241008' },
    layout: [wall, floor, floor, floor, floor, wall],
    entities: [
      { id: 'gm10_stage', kind: 'poi', x: 3, y: 1, icon: '👑', name: '빈 무대' },
      { id: 'gm10_exit', kind: 'exit', x: 0, y: 2, icon: '🚪', name: '관문으로' },
      { id: 'gm10_seats', kind: 'poi', x: 5, y: 4, icon: '💺', name: '관객석' },
    ],
    exits: [{ entityId: 'gm10_exit', to: 'gm09_gate', arrive: { x: 5, y: 2 }, direction: '서' }],
    playerStart: { x: 3, y: 3 },
  },
  gm08_club: {
    id: 'gm08_club',
    name: '포커 클럽',
    regionId: 'goblin_market',
    code: 'GM-08',
    arrivalNote: '초록 천 테이블과 딜러 자리. 남쪽 뒷문은 상점가로 이어진다.',
    stub: { tone: '#0f1a12' },
    layout: [wall, floor, floor, floor, floor, wall],
    entities: [
      { id: 'gm08_dealer', kind: 'npc', x: 3, y: 1, icon: '🎩', name: '딜러' },
      { id: 'gm08_table', kind: 'poi', x: 5, y: 2, icon: '♣️', name: '빈 테이블' },
      { id: 'gm08_west', kind: 'exit', x: 0, y: 3, icon: '🚪', name: '승부사 거리' },
      { id: 'gm08_south', kind: 'exit', x: 3, y: 5, icon: '🚪', name: '상점가 뒷길' },
    ],
    exits: [
      { entityId: 'gm08_west', to: 'gm07_street', arrive: { x: 5, y: 3 }, direction: '서' },
      { entityId: 'gm08_south', to: 'gm04_shops', arrive: { x: 3, y: 1 }, direction: '남' },
    ],
    playerStart: { x: 3, y: 3 },
  },
  gm04_shops: {
    id: 'gm04_shops',
    name: '상점가·감정 골목',
    regionId: 'goblin_market',
    code: 'GM-04',
    arrivalNote: '바리케이드 틈을 지나면 감정대와 잡화 가게가 늘어선 골목. 북쪽 뒷길은 클럽, 동쪽은 휴게소.',
    stub: { tone: '#1c1409' },
    layout: [wall, floor, floor, floor, floor, wall],
    entities: [
      { id: 'gm04_club_back', kind: 'exit', x: 3, y: 0, icon: '🃏', name: '클럽 뒷길' },
      { id: 'gm04_appraiser', kind: 'npc', x: 1, y: 1, icon: '🔍', name: '감정사' },
      { id: 'gm04_shelf', kind: 'poi', x: 5, y: 1, icon: '🏺', name: '잡화 진열대' },
      { id: 'gm04_west', kind: 'exit', x: 0, y: 3, icon: '🚧', name: '중앙 장터 (바리케이드 틈)' },
      { id: 'gm04_east', kind: 'exit', x: 6, y: 3, icon: '☕', name: '시장 휴게소' },
    ],
    exits: [
      { entityId: 'gm04_club_back', to: 'gm08_club', arrive: { x: 3, y: 4 }, direction: '북' },
      { entityId: 'gm04_west', to: 'central_market', arrive: { x: 8, y: 4 }, direction: '서' },
      { entityId: 'gm04_east', to: 'gm11_rest', arrive: { x: 1, y: 2 }, direction: '동' },
    ],
    playerStart: { x: 3, y: 3 },
  },
  gm11_rest: {
    id: 'gm11_rest',
    name: '시장 휴게소',
    regionId: 'goblin_market',
    code: 'GM-11',
    arrivalNote: '흥정 소리가 조금 멀어지는 곳. 긴 의자와 쉬는 손님들.',
    stub: { tone: '#18130c' },
    layout: [wall, floor, floor, floor, wall],
    entities: [
      { id: 'gm11_bench', kind: 'poi', x: 2, y: 1, icon: '🛋️', name: '긴 의자' },
      { id: 'gm11_guest', kind: 'npc', x: 4, y: 1, icon: '🍢', name: '쉬는 손님' },
      { id: 'gm11_west', kind: 'exit', x: 0, y: 2, icon: '🚪', name: '상점가' },
    ],
    exits: [{ entityId: 'gm11_west', to: 'gm04_shops', arrive: { x: 5, y: 3 }, direction: '서' }],
    playerStart: { x: 3, y: 2 },
  },
  gm05_alley: {
    id: 'gm05_alley',
    name: '뒷골목',
    regionId: 'goblin_market',
    code: 'GM-05',
    arrivalNote: '짐 더미 옆 틈을 지나면 폐장 상자가 쌓인 좁은 골목. 안쪽에 반쯤 열린 창고 문이 있다.',
    stub: { tone: '#141116' },
    layout: [wall, floor, floor, floor, floor, wall],
    entities: [
      { id: 'gm05_back_door', kind: 'exit', x: 1, y: 0, icon: '🚪', name: '반쯤 열린 창고 문' },
      { id: 'gm05_crates', kind: 'poi', x: 4, y: 1, icon: '📦', name: '쌓인 빈 상자' },
      { id: 'gm05_east', kind: 'exit', x: 6, y: 3, icon: '📦', name: '중앙 장터 (짐 더미 틈)' },
    ],
    exits: [
      { entityId: 'gm05_back_door', to: 'gm06_storeroom', arrive: { x: 3, y: 3 }, direction: '북' },
      { entityId: 'gm05_east', to: 'central_market', arrive: { x: 0, y: 4 }, direction: '동' },
    ],
    playerStart: { x: 3, y: 3 },
  },
  gm06_storeroom: {
    id: 'gm06_storeroom',
    name: '허름한 잡화 창고',
    regionId: 'goblin_market',
    code: 'GM-06',
    arrivalNote: '문이 제대로 닫히지 않는 허름한 잡화 창고. 계산대는 비어 있다.',
    stub: { tone: '#15120e' },
    layout: [wall, floor, floor, floor, wall],
    entities: [
      { id: 'gm06_counter', kind: 'poi', x: 3, y: 1, icon: '⚖️', name: '빈 계산대' },
      { id: 'gm06_shelf', kind: 'poi', x: 5, y: 1, icon: '🗃️', name: '먼지 앉은 선반' },
      { id: 'gm06_exit', kind: 'exit', x: 3, y: 4, icon: '🚪', name: '뒷골목' },
    ],
    exits: [{ entityId: 'gm06_exit', to: 'gm05_alley', arrive: { x: 1, y: 1 }, direction: '남' }],
    playerStart: { x: 3, y: 2 },
  },
};
