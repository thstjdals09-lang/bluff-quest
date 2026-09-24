import type { GameState, ItemDef, LocationDef, QuestDef, QuestStageDef } from '../types';

// ── 장소 정의 ──────────────────────────────────────────────────

/**
 * 장소(Location) = 장면 전환으로 연결되는 개별 탐험 공간. 여러 장소가 하나의 지역(Region)을 이룬다.
 *
 * 논리 그리드: '#'=이동 불가(벽), '.'=이동 가능.
 * 엔티티가 서 있는 칸도 이동 불가로 처리된다(state.ts isWalkable).
 * 그리드는 배경 플레이트(scenes.ts)의 길 영역에 원근 투영된다.
 *
 * 출입구는 kind:'exit' 엔티티 + exits 정의로 만든다. 내부 id(market 등)는
 * 세이브 데이터와 연결되어 있으므로 바꾸지 않고 표시 이름만 바꾼다.
 */
export const LOCATIONS: Record<string, LocationDef> = {
  market_road: {
    id: 'market_road',
    name: '시장으로 가는 길',
    regionId: 'goblin_market',
    code: 'GM-01',
    arrivalNote: '붉은 등불이 걸린 시장 문이 길 끝에 보인다.',
    layout: [
      '#####', // 0: 시장 입구 문
      '.....', // 1 (우: 입구의 상인)
      '.....', // 2
      '.....', // 3
      '.....', // 4 (길가의 반짝이는 것)
      '.....', // 5
      '.....', // 6 (시작 지점)
      '.....', // 7
    ],
    entities: [
      { id: 'market_gate', kind: 'exit', x: 2, y: 0, icon: '🏮', name: '고블린 시장 입구' },
      { id: 'gate_merchant', kind: 'npc', x: 4, y: 1, icon: '🛒', name: '입구의 상인' },
      { id: 'old_card', kind: 'poi', x: 1, y: 4, icon: '✨', name: '길가의 반짝이는 것' },
    ],
    exits: [{ entityId: 'market_gate', to: 'market', arrive: { x: 2, y: 7 }, direction: '북' }],
    playerStart: { x: 2, y: 6 },
  },
  market: {
    id: 'market',
    name: '입구 장터',
    regionId: 'goblin_market',
    code: 'GM-02',
    arrivalNote: '그리즐의 상자 좌판과 미라의 약초 좌판, 시장 게시판이 눈에 띈다. 오른쪽 기둥 옆으로 좁은 골목이 나 있다.',
    layout: [
      '#######', // 0: 북쪽 성벽 (창고 문)
      '.......', // 1
      '.......', // 2
      '.......', // 3
      '.......', // 4 (좌: 그리즐 좌판)
      '.......', // 5
      '.......', // 6 (중앙: 상자 더미 / 우: 미라 좌판)
      '.......', // 7
      '.......', // 8
      '.......', // 9 (남쪽: 진입로 방면)
    ],
    entities: [
      { id: 'warehouse_door', kind: 'exit', x: 3, y: 0, icon: '🚪', name: '오래된 창고 문' },
      { id: 'board', kind: 'poi', x: 5, y: 1, icon: '📜', name: '시장 게시판' },
      { id: 'goblin', kind: 'npc', x: 0, y: 4, icon: '👺', name: '그리즐' },
      { id: 'crates', kind: 'poi', x: 3, y: 6, icon: '📦', name: '부서진 상자 더미' },
      { id: 'mira', kind: 'npc', x: 6, y: 6, icon: '🧙', name: '약초상 미라' },
      { id: 'market_exit', kind: 'exit', x: 3, y: 9, icon: '🛤️', name: '남쪽 출구' },
      { id: 'central_market_passage', kind: 'exit', x: 6, y: 0, icon: '🏮', name: '기둥 옆 골목' },
    ],
    exits: [
      {
        entityId: 'warehouse_door',
        to: 'warehouse',
        arrive: { x: 2, y: 4 },
        direction: '북',
        requires: { unlocked: 'warehouse' },
        lockedHint: '녹슨 자물쇠가 걸려 있다.',
      },
      { entityId: 'market_exit', to: 'market_road', arrive: { x: 2, y: 2 }, direction: '남' },
      { entityId: 'central_market_passage', to: 'central_market', arrive: { x: 4, y: 7 }, direction: '북' },
    ],
    playerStart: { x: 2, y: 6 },
  },
  central_market: {
    id: 'central_market',
    name: '중앙 장터',
    regionId: 'goblin_market',
    code: 'GM-03',
    arrivalNote: '마주 보는 두 좌판에서 상인 둘이 언성을 높이고 있다. 길은 사방으로 뻗어 있지만 지금은 남쪽만 열려 있다.',
    layout: [
      '##.#.####', // 0: 북쪽 길 — 화물 수레가 막고 있음 (4,0)
      '##......#', // 1
      '.##...##.', // 2: 서쪽 길 (0,2) 짐 더미 / 동쪽 길 (8,2) 목재 바리케이드, 좌우 가운데 좌판
      '.##...##.', // 3
      '.........', // 4
      '##.....##', // 5
      '###...###', // 6 (시작 지점)
      '###...###', // 7
      '###...###', // 8: 남쪽 — 입구 장터로 가는 골목 (4,8)
    ],
    entities: [
      { id: 'gm03_south', kind: 'exit', x: 4, y: 8, icon: '🏮', name: '입구 장터 쪽 골목' },
      { id: 'gm03_north_cart', kind: 'poi', x: 4, y: 0, icon: '🛒', name: '길을 막은 화물 수레' },
      { id: 'gm03_west_pile', kind: 'poi', x: 0, y: 2, icon: '📦', name: '쌓아 둔 짐 더미' },
      { id: 'gm03_east_barricade', kind: 'poi', x: 8, y: 2, icon: '🚧', name: '목재 바리케이드' },
      { id: 's01_a', kind: 'npc', x: 2, y: 3, icon: '👴', name: '공방 상인' },
      { id: 's01_b', kind: 'npc', x: 6, y: 3, icon: '🧑', name: '되팔이 상인' },
      { id: 's01_guards', kind: 'poi', x: 4, y: 2, icon: '🎴', name: '두 개의 카드 가드' },
      { id: 's01_onlooker', kind: 'npc', x: 3, y: 5, icon: '🍢', name: '구경꾼' },
    ],
    exits: [{ entityId: 'gm03_south', to: 'market', arrive: { x: 6, y: 1 }, direction: '남' }],
    futureWays: [
      {
        entityId: 'gm03_north_cart',
        code: 'GM-07',
        label: '북쪽 길',
        direction: '북',
        lockedHint: '짐을 가득 실은 화물 수레가 길을 통째로 막고 있다. 짐꾼들은 "오늘은 못 치워!"라며 손을 내젓는다.',
      },
      {
        entityId: 'gm03_west_pile',
        code: 'GM-05',
        label: '서쪽 골목',
        direction: '서',
        lockedHint: '통과 짐 상자가 골목 입구에 산처럼 쌓여 있다. 사람이 지나갈 틈이 없다.',
      },
      {
        entityId: 'gm03_east_barricade',
        code: 'GM-04',
        label: '동쪽 길',
        direction: '동',
        lockedHint: '목재 바리케이드와 곡물 자루가 길을 막고 있다. 수리 중이라는 듯 망치 소리만 들려온다.',
      },
    ],
    playerStart: { x: 4, y: 6 },
  },
  warehouse: {
    id: 'warehouse',
    name: '오래된 창고',
    regionId: 'goblin_market',
    code: 'GM-02a',
    arrivalNote: '달빛이 먼지 쌓인 궤짝과 선반을 비춘다.',
    layout: [
      '#####', // 0: 안쪽 벽
      '.....', // 1 (궤짝)
      '.....', // 2 (선반의 낡은 장부)
      '.....', // 3
      '.....', // 4 (시작 지점)
      '.....', // 5 (남쪽 출구)
    ],
    entities: [
      { id: 'chest', kind: 'poi', x: 2, y: 1, icon: '🗝️', name: '먼지 쌓인 궤짝' },
      { id: 'ledger_scrap', kind: 'poi', x: 4, y: 2, icon: '📜', name: '선반의 낡은 장부' },
      { id: 'exit_door', kind: 'exit', x: 2, y: 5, icon: '🚪', name: '창고 문' },
    ],
    exits: [{ entityId: 'exit_door', to: 'market', arrive: { x: 3, y: 1 }, direction: '남' }],
    playerStart: { x: 2, y: 4 },
  },
  port_docks: {
    id: 'port_docks',
    name: '밤의 부두',
    regionId: 'trickster_port',
    arrivalNote: '부두 게시판과 정보상의 좌대, 선술집 문이 보인다.',
    layout: [
      '#######', // 0: 항구 방벽과 정문
      '.......', // 1
      '.......', // 2 (우: 선술집 문)
      '.......', // 3
      '.......', // 4 (우: 올드 핀의 좌대)
      '.......', // 5
      '.......', // 6 (좌: 하역된 밀수 화물)
      '.......', // 7
      '.......', // 8
      '.......', // 9
    ],
    entities: [
      { id: 'harbor_gate', kind: 'exit', x: 3, y: 0, icon: '⛩️', name: '항구 정문' },
      { id: 'pier_notice', kind: 'poi', x: 5, y: 1, icon: '📜', name: '부두 게시판' },
      { id: 'tavern_door', kind: 'poi', x: 6, y: 2, icon: '🍺', name: '선술집 문' },
      { id: 'fin', kind: 'npc', x: 6, y: 4, icon: '🧔', name: '정보상 올드 핀' },
      { id: 'cargo', kind: 'poi', x: 0, y: 6, icon: '📦', name: '하역된 밀수 화물' },
    ],
    // 지역 간 출입구: 해안길을 따라 고블린 시장 진입로로 (돌아오는 길은 월드맵)
    exits: [{ entityId: 'harbor_gate', to: 'market_road', arrive: { x: 2, y: 2 }, direction: '북' }],
    playerStart: { x: 3, y: 6 },
  },
};

// ── 아이템 정의 ────────────────────────────────────────────────

export const ITEMS: Record<string, ItemDef> = {
  old_spade_card: {
    id: 'old_spade_card',
    name: '낡은 스페이드 카드',
    icon: '🂡',
    desc: '시장으로 가는 길에서 주운 낡은 스페이드 에이스. 뒷면에 이렇게 적혀 있다 — "이 카드를 보여주는 사람을 믿지 마라." 누가, 왜 적었는지는 알 수 없다.',
  },
  old_key: {
    id: 'old_key',
    name: '낡은 열쇠',
    icon: '🗝️',
    desc: '그리즐의 상자에서 나온 녹슨 열쇠. 시장 어딘가의 자물쇠에 맞을 것 같다.',
  },
  goblin_tooth_chip: {
    id: 'goblin_tooth_chip',
    name: '이빨 자국 칩',
    icon: '🪙',
    desc: '그리즐이 분해서 깨문 카지노 칩. 고블린의 속임수를 간파한 기념품이다.',
  },
  invitation: {
    id: 'invitation',
    name: '수상한 초대장',
    icon: '✉️',
    desc: '"진짜 승부사만 오라." 사기꾼들의 항구에서 열리는 비밀 경기의 초대장. 다음 모험의 단서다.',
  },
};

// ── 퀘스트 정의 ────────────────────────────────────────────────

export const QUESTS: Record<string, QuestDef> = {
  q_prologue: {
    id: 'q_prologue',
    name: '이름 없는 승부사',
    type: 'main',
    regionId: 'goblin_market',
    stages: [
      { id: 'road', title: '시장으로 가는 길', objective: '불빛과 소음이 새어 나오는 고블린 시장 입구로 향한다. …길에 뭔가 반짝인다.' },
      { id: 'card', title: '낡은 카드', objective: '뒷면에 경고가 적힌 스페이드 카드를 주웠다. 시장 입구의 상인에게 가 보자.' },
      { id: 'merchant', title: '입구의 상인', objective: '상인이 카드를 알아본 듯하더니 말을 바꿨다. …일단 시장으로 들어가자.' },
      { id: 'done', title: '고블린 시장', objective: '시장에 도착했다. 승부사로서의 모험이 시작된다.' },
    ],
  },
  q_s01: {
    id: 'q_s01',
    name: '두 상인의 진품 소동',
    type: 'regional',
    regionId: 'goblin_market',
    stages: [
      { id: 'seen', title: '광장의 말다툼', objective: '중앙 장터의 두 상인이 서로 자기 카드 가드가 원본이라고 다툰다.' },
      { id: 'investigating', title: '흔적 확인', objective: '말이 아니라 직접 확인한 흔적으로 판단해 보자. 판단은 언제든 내릴 수 있다.' },
      { id: 'deferred', title: '나중으로 미룸', objective: '소동을 지켜보기만 했다. 시장을 돌아다니다 다시 오면 상황이 달라져 있을지도 모른다.' },
      { id: 'resolved', title: '판단을 내림', objective: '소동은 끝났다. 누가 옳았는지는 나의 판단으로 남았다.' },
    ],
  },
  q_invitation: {
    id: 'q_invitation',
    name: '수상한 초대장',
    type: 'main',
    regionId: 'goblin_market',
    stages: [
      { id: 'start', title: '시장의 소문', objective: '고블린 시장을 둘러보고 그리즐과 이야기한다.' },
      { id: 'boxes', title: '세 개의 상자', objective: '그리즐의 상자 대결에서 그의 속셈을 읽어낸다.' },
      { id: 'find_lock', title: '열쇠의 주인', objective: '낡은 열쇠에 맞는 자물쇠를 시장에서 찾는다.' },
      { id: 'open_warehouse', title: '오래된 창고', objective: '창고 안을 조사한다.' },
      { id: 'done', title: '다음 목적지', objective: '초대장을 손에 넣었다. 사기꾼들의 항구가 기다린다. 월드맵에서 항구로 이동할 수 있다.' },
    ],
  },
  q_black_chip: {
    id: 'q_black_chip',
    name: '그리즐의 검은 칩',
    type: 'character',
    regionId: 'goblin_market',
    stages: [
      { id: 'noticed', title: '비매품', objective: '그리즐의 좌판 구석에서 장식 하나 없는 검은 칩을 보았다.' },
      { id: 'refused', title: '수상한 거절', objective: '돈이라면 사족을 못 쓰는 그리즐이 칩만은 팔지 않는다. 이유가 있을 것이다.' },
      { id: 'inquiry', title: '조사', objective: '미라에게 묻거나, 시장과 창고의 흔적에서 단서를 찾아보자.' },
      { id: 'done', title: '지켜진 약속', objective: '그리즐은 사라진 친구와의 약속으로 칩을 지키고 있었다. 친구의 행방은 아직 아무도 모른다.' },
    ],
  },
  q_mira_past: {
    id: 'q_mira_past',
    name: '약초상의 말버릇',
    type: 'character',
    regionId: 'goblin_market',
    stages: [
      { id: 'slip', title: '이상한 말버릇', objective: '미라가 승부판에서나 쓰는 말을 아무렇지 않게 흘렸다. 약초상이 왜?' },
      { id: 'done', title: '전직 딜러', objective: '미라는 한때 여러 지역의 승부를 진행하던 딜러였다. 왜 그만두었는지는 말하지 않았다.' },
    ],
  },
  q_night_pier: {
    id: 'q_night_pier',
    name: '끝나지 않은 승부',
    type: 'main',
    regionId: 'trickster_port',
    stages: [
      { id: 'arrive', title: '항구 도착', objective: '사기꾼들의 항구, 밤의 부두에 도착했다. 초대장에 대해 아는 자를 찾아보자.' },
      { id: 'informant', title: '정보상', objective: '부두의 정보상 올드 핀이 무언가 아는 눈치다. 단, 저쪽도 이쪽을 떠보고 있다.' },
      { id: 'wager', title: '정보의 값', objective: '핀과의 거래 — 무엇을 걸고, 무엇을 숨길지는 내가 정한다.' },
      { id: 'done', title: '자리의 주인', objective: '초대장은 이름이 아니라 \'자리\'를 잇는다. 밤의 부두 비밀 경기가 다음 목적지다. (다음 이야기는 추후 개발)' },
    ],
  },
};

/** HUD 퀘스트 트래커가 보여줄 현재 퀘스트 — 우선순위 순서로 미완료 퀘스트를 고른다. */
const TRACK_ORDER = ['q_prologue', 'q_night_pier', 'q_invitation', 'q_s01', 'q_black_chip', 'q_mira_past'];

export function getTrackedQuest(
  state: GameState,
): { quest: QuestDef; stage: QuestStageDef } | null {
  for (const id of TRACK_ORDER) {
    const progress = state.quests[id];
    if (!progress || progress.stage === 'done') continue;
    const quest = QUESTS[id];
    const stage = quest?.stages.find((s) => s.id === progress.stage);
    if (quest && stage) return { quest, stage };
  }
  // 전부 완료되었거나 미시작이면 마지막으로 완료한 메인 퀘스트의 done 단계를 보여준다
  for (const id of TRACK_ORDER) {
    const progress = state.quests[id];
    const quest = QUESTS[id];
    const stage = quest?.stages.find((s) => s.id === progress?.stage);
    if (quest && stage) return { quest, stage };
  }
  return null;
}
