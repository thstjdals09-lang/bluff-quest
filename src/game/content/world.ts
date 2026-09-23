import type { GameState, ItemDef, LocationDef, QuestDef, QuestStageDef } from '../types';

// ── 지역 정의 ──────────────────────────────────────────────────

/**
 * 논리 그리드: '#'=이동 불가(벽), '.'=이동 가능.
 * 엔티티가 서 있는 칸도 이동 불가로 처리된다(state.ts isWalkable).
 * 그리드는 배경 플레이트(scenes.ts)의 길 영역에 원근 투영된다.
 */
export const LOCATIONS: Record<string, LocationDef> = {
  market: {
    id: 'market',
    name: '고블린 시장',
    layout: [
      '#######', // 0: 북쪽 성벽 (창고 문)
      '.......', // 1
      '.......', // 2
      '.......', // 3
      '.......', // 4 (좌: 그리즐 좌판)
      '.......', // 5
      '.......', // 6 (중앙: 상자 더미 / 우: 미라 좌판)
      '.......', // 7
      '.......', // 8 (시작 지점)
      '.......', // 9
    ],
    entities: [
      { id: 'warehouse_door', kind: 'poi', x: 3, y: 0, icon: '🚪', name: '잠긴 창고' },
      { id: 'board', kind: 'poi', x: 5, y: 1, icon: '📜', name: '시장 게시판' },
      { id: 'goblin', kind: 'npc', x: 0, y: 4, icon: '👺', name: '그리즐' },
      { id: 'crates', kind: 'poi', x: 3, y: 6, icon: '📦', name: '부서진 상자 더미' },
      { id: 'mira', kind: 'npc', x: 6, y: 6, icon: '🧙', name: '약초상 미라' },
    ],
    playerStart: { x: 2, y: 6 },
  },
  warehouse: {
    id: 'warehouse',
    name: '오래된 창고',
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
      { id: 'exit_door', kind: 'poi', x: 2, y: 5, icon: '🚪', name: '시장으로 나가는 문' },
    ],
    playerStart: { x: 2, y: 4 },
  },
  port_docks: {
    id: 'port_docks',
    name: '사기꾼들의 항구 — 밤의 부두',
    layout: [
      '#######', // 0: 항구 방벽과 정문
      '.......', // 1
      '.......', // 2 (우: 선술집 문)
      '.......', // 3
      '.......', // 4 (우: 올드 핀의 좌대)
      '.......', // 5
      '.......', // 6 (좌: 하역된 밀수 화물)
      '.......', // 7
      '.......', // 8 (시작 지점)
      '.......', // 9
    ],
    entities: [
      { id: 'harbor_gate', kind: 'poi', x: 3, y: 0, icon: '⛩️', name: '항구 정문 — 시장 방면' },
      { id: 'pier_notice', kind: 'poi', x: 5, y: 1, icon: '📜', name: '부두 게시판' },
      { id: 'tavern_door', kind: 'poi', x: 6, y: 2, icon: '🍺', name: '선술집 문' },
      { id: 'fin', kind: 'npc', x: 6, y: 4, icon: '🧔', name: '정보상 올드 핀' },
      { id: 'cargo', kind: 'poi', x: 0, y: 6, icon: '📦', name: '하역된 밀수 화물' },
    ],
    playerStart: { x: 3, y: 6 },
  },
};

// ── 아이템 정의 ────────────────────────────────────────────────

export const ITEMS: Record<string, ItemDef> = {
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
const TRACK_ORDER = ['q_night_pier', 'q_invitation', 'q_black_chip', 'q_mira_past'];

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
