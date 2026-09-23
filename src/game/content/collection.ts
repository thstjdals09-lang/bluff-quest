import type { GameState } from '../types';
import { CHAMPIONS } from './regions';

/**
 * 컬렉션 정의 — 발견 기록(state.discovered)과 실제 보유(state.inventory)를 구분한다.
 * 아이템을 사용해 인벤토리에서 사라져도 발견 기록은 컬렉션에 남는다.
 */

export type CollectionEntryStatus =
  | 'obtainable' // 현재 게임에서 실제로 획득 가능
  | 'coming_soon' // 획득 콘텐츠가 아직 개발되지 않음
  | 'unrevealed'; // 존재만 암시 — 획득 조건 미공개

export interface CollectionEntryDef {
  id: string;
  name: string;
  icon: string;
  /** 실제 아이템과 연결되는 경우 (발견 여부는 state.discovered로 판정) */
  itemId?: string;
  desc: string;
  status: CollectionEntryStatus;
}

export interface CollectionCategoryDef {
  id: string;
  name: string;
  desc: string;
  entries: CollectionEntryDef[];
}

export const COLLECTION: CollectionCategoryDef[] = [
  {
    id: 'special_cards',
    name: '특별한 카드',
    desc: '세계 곳곳의 사건에 얽힌 단 한 장뿐인 카드들.',
    entries: [
      { id: 'card_slot_1', name: '???', icon: '🂠', desc: '미공개', status: 'unrevealed' },
      { id: 'card_slot_2', name: '???', icon: '🂠', desc: '미공개', status: 'unrevealed' },
    ],
  },
  {
    id: 'chips',
    name: '포커 칩',
    desc: '지역과 사건의 기념이 담긴 칩.',
    entries: [
      {
        id: 'goblin_tooth_chip',
        name: '이빨 자국 칩',
        icon: '🪙',
        itemId: 'goblin_tooth_chip',
        desc: '그리즐이 분해서 깨문 칩. 고블린의 거짓말을 간파한 증표.',
        status: 'obtainable',
      },
      { id: 'chip_slot_1', name: '???', icon: '🂠', desc: '미공개', status: 'unrevealed' },
    ],
  },
  {
    id: 'card_guards',
    name: '카드 가드',
    desc: '승부사의 개성을 보여주는 카드 가드.',
    entries: [
      { id: 'guard_slot_1', name: '???', icon: '🂠', desc: '미공개', status: 'unrevealed' },
    ],
  },
  {
    id: 'badges',
    name: '지역 배지',
    desc: '각 지역 챔피언을 꺾은 증표. (챔피언전은 개발 예정)',
    entries: Object.values(CHAMPIONS).map((c) => ({
      id: `badge_${c.id}`,
      name: c.badgeName,
      icon: '🎖️',
      desc: `${c.tentativeName}을(를) 꺾으면 얻는다.`,
      status: 'coming_soon' as const,
    })),
  },
  {
    id: 'quest_items',
    name: '모험 아이템',
    desc: '사건과 장소를 잇는 특별한 아이템.',
    entries: [
      {
        id: 'old_key',
        name: '낡은 열쇠',
        icon: '🗝️',
        itemId: 'old_key',
        desc: '그리즐의 상자에서 나온 열쇠. 시장의 잠긴 창고를 연다.',
        status: 'obtainable',
      },
      {
        id: 'invitation',
        name: '수상한 초대장',
        icon: '✉️',
        itemId: 'invitation',
        desc: '사기꾼들의 항구, 밤의 부두의 비밀 경기 초대장.',
        status: 'obtainable',
      },
    ],
  },
];

export function isDiscovered(entry: CollectionEntryDef, state: GameState): boolean {
  return entry.itemId !== undefined && state.discovered.includes(entry.itemId);
}

export function countDiscovered(state: GameState): { found: number; total: number } {
  let found = 0;
  let total = 0;
  for (const cat of COLLECTION) {
    for (const e of cat.entries) {
      total += 1;
      if (isDiscovered(e, state)) found += 1;
    }
  }
  return { found, total };
}
