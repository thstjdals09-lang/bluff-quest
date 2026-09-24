import type { LocationDef } from '../types';

/**
 * W0 전 지역 이동 셸 — 유령 카지노·황금 도시·승부사의 탑의 공용 공간 (STORY_STUB, 그림 없음).
 * 장소 방문은 이야기 진행과 별개다: 여기 들어와도 어떤 스토리 플래그·기록도 생기지 않는다.
 * 모든 출구는 문↔문으로 되돌아오는 길이 있다(지역 간 출구 포함).
 */
export const SHELL_LOCATIONS: Record<string, LocationDef> = {
  // ── 유령 카지노 ──
  casino_entry: {
    id: 'casino_entry',
    name: '카지노 입구',
    regionId: 'ghost_casino',
    arrivalNote: '안개 낀 선착장 끝, 불 꺼진 간판 아래 문이 반쯤 열려 있다.',
    stub: { tone: '#12141d' },
    layout: [
      '#######', // 0: 재현 홀 문
      '.......', // 1: 영업 안내판
      '.......', // 2: 유령 짐꾼
      '.......', // 3: 선착장(서) · 마차길(동)
      '.......', // 4
      '.......', // 5
    ],
    entities: [
      { id: 'casino_replay_door', kind: 'exit', x: 3, y: 0, icon: '🚪', name: '홀 문' },
      { id: 'casino_sign', kind: 'poi', x: 1, y: 1, icon: '📋', name: '낡은 영업 안내판' },
      { id: 'casino_porter', kind: 'npc', x: 5, y: 2, icon: '👻', name: '투덜대는 유령 짐꾼' },
      { id: 'casino_dock', kind: 'exit', x: 0, y: 3, icon: '⛵', name: '나룻배 선착장' },
      { id: 'casino_coach_road', kind: 'exit', x: 6, y: 3, icon: '🐎', name: '마차길' },
    ],
    exits: [
      { entityId: 'casino_replay_door', to: 'casino_replay', arrive: { x: 3, y: 4 }, direction: '북' },
      { entityId: 'casino_dock', to: 'port_docks', arrive: { x: 1, y: 3 }, direction: '서' },
      { entityId: 'casino_coach_road', to: 'city_street', arrive: { x: 1, y: 3 }, direction: '동' },
    ],
    playerStart: { x: 3, y: 4 },
  },
  casino_replay: {
    id: 'casino_replay',
    name: '재현 홀',
    regionId: 'ghost_casino',
    arrivalNote: '빈 테이블 위로 칩이 저절로 미끄러진다. 안쪽에 서고 문이 보인다.',
    stub: { tone: '#161225' },
    layout: [
      '#######', // 0: 서고 문(동)
      '.......', // 1
      '.......', // 2: 빈 테이블 · 유령 손님
      '.......', // 3
      '.......', // 4
      '#######', // 5: 입구로 (문)
    ],
    entities: [
      { id: 'casino_archive_door', kind: 'exit', x: 5, y: 0, icon: '🗄️', name: '서고 문' },
      { id: 'replay_table', kind: 'poi', x: 3, y: 2, icon: '🃏', name: '빈 테이블' },
      { id: 'replay_ghost', kind: 'npc', x: 1, y: 2, icon: '👻', name: '옛 손님' },
      { id: 'casino_replay_exit', kind: 'exit', x: 3, y: 5, icon: '🚪', name: '입구로' },
    ],
    exits: [
      { entityId: 'casino_archive_door', to: 'casino_archive', arrive: { x: 3, y: 3 }, direction: '북' },
      { entityId: 'casino_replay_exit', to: 'casino_entry', arrive: { x: 3, y: 1 }, direction: '남' },
    ],
    playerStart: { x: 3, y: 4 },
  },
  casino_archive: {
    id: 'casino_archive',
    name: '서고',
    regionId: 'ghost_casino',
    arrivalNote: '먼지 앉은 서랍장이 벽을 따라 늘어서 있다. 서랍마다 봉인이 붙어 있다.',
    stub: { tone: '#18160f' },
    layout: [
      '#######', // 0: 봉인된 서랍장
      '.......', // 1
      '.......', // 2
      '.......', // 3
      '#######', // 4: 홀로 (문)
    ],
    entities: [
      { id: 'sealed_drawers', kind: 'poi', x: 3, y: 0, icon: '🔒', name: '봉인된 서랍장' },
      { id: 'archive_desk', kind: 'poi', x: 5, y: 1, icon: '🕯️', name: '빈 열람대' },
      { id: 'casino_archive_exit', kind: 'exit', x: 5, y: 4, icon: '🚪', name: '홀로' },
    ],
    exits: [{ entityId: 'casino_archive_exit', to: 'casino_replay', arrive: { x: 5, y: 1 }, direction: '남' }],
    playerStart: { x: 3, y: 2 },
  },

  // ── 황금 도시 ──
  city_street: {
    id: 'city_street',
    name: '큰길',
    regionId: 'golden_city',
    arrivalNote: '금박 간판이 늘어선 큰길. 계약 열람소와 찻집, 언덕 위로 이어지는 길이 보인다.',
    stub: { tone: '#1d1808' },
    layout: [
      '#######', // 0: 열람소(서) · 찻집(동)
      '.......', // 1
      '.......', // 2: 흥정꾼 둘
      '.......', // 3: 마차길(서) · 언덕길(동)
      '.......', // 4
      '.......', // 5
    ],
    entities: [
      { id: 'city_contract_door', kind: 'exit', x: 1, y: 0, icon: '📑', name: '계약 열람소' },
      { id: 'city_meeting_door', kind: 'exit', x: 5, y: 0, icon: '☕', name: '찻집' },
      { id: 'city_haggler_a', kind: 'npc', x: 2, y: 2, icon: '🎩', name: '이름값 장수' },
      { id: 'city_haggler_b', kind: 'npc', x: 4, y: 2, icon: '💰', name: '물건값 장수' },
      { id: 'city_coach_road', kind: 'exit', x: 0, y: 3, icon: '🐎', name: '마차길' },
      { id: 'city_hill_road', kind: 'exit', x: 6, y: 3, icon: '⛰️', name: '언덕길' },
    ],
    exits: [
      { entityId: 'city_contract_door', to: 'city_contract', arrive: { x: 3, y: 3 }, direction: '북' },
      { entityId: 'city_meeting_door', to: 'city_meeting', arrive: { x: 3, y: 3 }, direction: '북' },
      { entityId: 'city_coach_road', to: 'casino_entry', arrive: { x: 5, y: 3 }, direction: '서' },
      { entityId: 'city_hill_road', to: 'tower_entrance', arrive: { x: 1, y: 3 }, direction: '동' },
    ],
    playerStart: { x: 3, y: 4 },
  },
  city_contract: {
    id: 'city_contract',
    name: '계약 열람소',
    regionId: 'golden_city',
    arrivalNote: '창구 너머 서류철이 천장까지 쌓여 있다.',
    stub: { tone: '#1a170e' },
    layout: [
      '#######', // 0
      '.......', // 1: 열람 창구 · 직원
      '.......', // 2
      '.......', // 3
      '#######', // 4: 큰길로 (문)
    ],
    entities: [
      { id: 'contract_window', kind: 'poi', x: 3, y: 1, icon: '🏦', name: '열람 창구' },
      { id: 'contract_clerk', kind: 'npc', x: 4, y: 1, icon: '📜', name: '창구 직원' },
      { id: 'city_contract_exit', kind: 'exit', x: 1, y: 4, icon: '🚪', name: '큰길로' },
    ],
    exits: [{ entityId: 'city_contract_exit', to: 'city_street', arrive: { x: 1, y: 1 }, direction: '남' }],
    playerStart: { x: 3, y: 3 },
  },
  city_meeting: {
    id: 'city_meeting',
    name: '찻집',
    regionId: 'golden_city',
    arrivalNote: '조용한 찻집. 창가 자리 몇 개가 비어 있다.',
    stub: { tone: '#1b1410' },
    layout: [
      '#######', // 0
      '.......', // 1: 창가 자리 · 손님
      '.......', // 2
      '.......', // 3
      '#######', // 4: 큰길로 (문)
    ],
    entities: [
      { id: 'tea_window_seat', kind: 'poi', x: 1, y: 1, icon: '💺', name: '창가 자리' },
      { id: 'tea_guest', kind: 'npc', x: 5, y: 1, icon: '🍵', name: '찻집 손님' },
      { id: 'city_meeting_exit', kind: 'exit', x: 5, y: 4, icon: '🚪', name: '큰길로' },
    ],
    exits: [{ entityId: 'city_meeting_exit', to: 'city_street', arrive: { x: 5, y: 1 }, direction: '남' }],
    playerStart: { x: 3, y: 3 },
  },

  // ── 승부사의 탑 ──
  tower_entrance: {
    id: 'tower_entrance',
    name: '탑 입구',
    regionId: 'gamblers_tower',
    arrivalNote: '언덕 꼭대기, 층층이 불 켜진 탑. 접수대와 위로 오르는 계단이 보인다.',
    stub: { tone: '#10161a' },
    layout: [
      '#######', // 0: 계단
      '.......', // 1: 접수 담당
      '.......', // 2
      '.......', // 3: 언덕길(서)
      '.......', // 4
      '.......', // 5
    ],
    entities: [
      { id: 'tower_stairs_up', kind: 'exit', x: 3, y: 0, icon: '⬆️', name: '위층 계단' },
      { id: 'tower_clerk', kind: 'npc', x: 5, y: 1, icon: '📋', name: '접수 담당' },
      { id: 'tower_hill_road', kind: 'exit', x: 0, y: 3, icon: '⛰️', name: '언덕길' },
    ],
    exits: [
      { entityId: 'tower_stairs_up', to: 'tower_testimony', arrive: { x: 3, y: 3 }, direction: '북' },
      { entityId: 'tower_hill_road', to: 'city_street', arrive: { x: 5, y: 3 }, direction: '서' },
    ],
    playerStart: { x: 3, y: 4 },
  },
  tower_testimony: {
    id: 'tower_testimony',
    name: '증언실',
    regionId: 'gamblers_tower',
    arrivalNote: '의자가 둥글게 놓인 방. 아무도 앉아 있지 않다.',
    stub: { tone: '#12181c' },
    layout: [
      '#######', // 0: 위층 계단(동)
      '.......', // 1
      '.......', // 2: 빈 의자들
      '.......', // 3
      '#######', // 4: 아래층 계단
    ],
    entities: [
      { id: 'testimony_up', kind: 'exit', x: 6, y: 0, icon: '⬆️', name: '위층 계단' },
      { id: 'testimony_chairs', kind: 'poi', x: 3, y: 1, icon: '💺', name: '둥글게 놓인 의자' },
      { id: 'testimony_down', kind: 'exit', x: 3, y: 4, icon: '⬇️', name: '아래층 계단' },
    ],
    exits: [
      { entityId: 'testimony_up', to: 'tower_archive', arrive: { x: 6, y: 3 }, direction: '북' },
      { entityId: 'testimony_down', to: 'tower_entrance', arrive: { x: 3, y: 1 }, direction: '남' },
    ],
    playerStart: { x: 3, y: 3 },
  },
  tower_archive: {
    id: 'tower_archive',
    name: '봉인 서고',
    regionId: 'gamblers_tower',
    arrivalNote: '철창 너머 서가. 철창에는 커다란 자물쇠가 걸려 있다.',
    stub: { tone: '#15130f' },
    layout: [
      '#######', // 0: 꼭대기 계단
      '.......', // 1: 철창 서가
      '.......', // 2
      '.......', // 3: 아래층 계단(동)
      '#######', // 4
    ],
    entities: [
      { id: 'archive_up', kind: 'exit', x: 3, y: 0, icon: '⬆️', name: '꼭대기 계단' },
      { id: 'barred_shelves', kind: 'poi', x: 1, y: 1, icon: '🔒', name: '철창 서가' },
      { id: 'archive_down', kind: 'exit', x: 6, y: 4, icon: '⬇️', name: '아래층 계단' },
    ],
    exits: [
      { entityId: 'archive_up', to: 'tower_top', arrive: { x: 3, y: 4 }, direction: '북' },
      { entityId: 'archive_down', to: 'tower_testimony', arrive: { x: 6, y: 1 }, direction: '남' },
    ],
    playerStart: { x: 3, y: 2 },
  },
  tower_top: {
    id: 'tower_top',
    name: '꼭대기 방',
    regionId: 'gamblers_tower',
    arrivalNote: '긴 탁자 하나와 마주 놓인 빈 의자 둘. 창밖으로 지나온 길이 내려다보인다.',
    stub: { tone: '#0f0f14' },
    layout: [
      '#######', // 0
      '.......', // 1: 긴 탁자
      '.......', // 2
      '.......', // 3: 창
      '.......', // 4
      '#######', // 5: 계단
    ],
    entities: [
      { id: 'top_table', kind: 'poi', x: 3, y: 1, icon: '💺', name: '긴 탁자' },
      { id: 'top_window', kind: 'poi', x: 6, y: 3, icon: '🌃', name: '창' },
      { id: 'top_down', kind: 'exit', x: 3, y: 5, icon: '⬇️', name: '아래층 계단' },
    ],
    exits: [{ entityId: 'top_down', to: 'tower_archive', arrive: { x: 3, y: 1 }, direction: '남' }],
    playerStart: { x: 3, y: 3 },
  },
};
