import type { ItemDef, LocationDef, QuestDef } from '../types';

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
    playerStart: { x: 3, y: 8 },
  },
  warehouse: {
    id: 'warehouse',
    name: '오래된 창고',
    layout: [
      '#####', // 0: 안쪽 벽
      '.....', // 1 (궤짝)
      '.....', // 2
      '.....', // 3
      '.....', // 4 (시작 지점)
      '.....', // 5 (남쪽 출구)
    ],
    entities: [
      { id: 'chest', kind: 'poi', x: 2, y: 1, icon: '🗝️', name: '먼지 쌓인 궤짝' },
      { id: 'exit_door', kind: 'poi', x: 2, y: 5, icon: '🚪', name: '시장으로 나가는 문' },
    ],
    playerStart: { x: 2, y: 4 },
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
    stages: [
      { id: 'start', title: '시장의 소문', objective: '고블린 시장을 둘러보고 그리즐과 이야기한다.' },
      { id: 'boxes', title: '세 개의 상자', objective: '그리즐의 상자 대결에서 그의 속셈을 읽어낸다.' },
      { id: 'find_lock', title: '열쇠의 주인', objective: '낡은 열쇠에 맞는 자물쇠를 시장에서 찾는다.' },
      { id: 'open_warehouse', title: '오래된 창고', objective: '창고 안을 조사한다.' },
      { id: 'done', title: '다음 목적지', objective: '초대장을 손에 넣었다. 사기꾼들의 항구가 기다린다. (다음 지역은 추후 개발)' },
    ],
  },
};
