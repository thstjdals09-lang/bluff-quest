import type { GameState, ItemDef } from '../types';
import { ITEMS, QUESTS, isQuestFinished } from './world';
import { STORY_RECORDS, storyRecordsForFlags } from './records';
import type { RecordKind } from './records';

/**
 * 가방 (GM-P8) — 읽기 전용 보기.
 * 인벤토리의 순서·보유 여부를 그대로 보여 주고, 아이템마다 '실제로 이어진' 퀘스트·기록만 붙인다.
 * 연결은 아래 표에 명시된 것만 — 플레이어가 아직 얻지 않은 퀘스트·기록은 보이지 않고, 없는 연결을 지어내지 않는다.
 */

interface ItemLinkDef {
  /** 이 아이템이 목표·단계 문구에 직접 등장하는 퀘스트 */
  quests: readonly string[];
  /** 이 아이템을 직접 다루는 이야기 기록의 플래그 */
  recordFlags: readonly string[];
}

export const ITEM_LINKS: Record<string, ItemLinkDef> = {
  // 프롤로그 '낡은 카드' 단계 + 카드에 대한 반응 기록
  old_spade_card: { quests: ['q_prologue'], recordFlags: ['prologue_card', 'gate_merchant_met', 'mira_card_bark_seen'] },
  // '열쇠의 주인' 단계
  old_key: { quests: ['q_invitation'], recordFlags: [] },
  // 대결 기념품 — 이어진 퀘스트·기록 없음 (설명만)
  goblin_tooth_chip: { quests: [], recordFlags: [] },
  // 초대장을 얻은 퀘스트, 초대장을 들고 가는 퀘스트, 초대장에 대한 기록
  invitation: {
    quests: ['q_invitation', 'q_night_pier'],
    recordFlags: ['night_pier_hint', 'invitation_meaning_known', 'invitation_confirmed_to_fin', 'invitation_shown'],
  },
};

export interface BagEntry {
  item: ItemDef;
  quests: { id: string; name: string; stageTitle: string; done: boolean }[];
  records: { kind: RecordKind; text: string }[];
}

/** 첫 화면의 칸 수 — 아이템이 더 많으면 네 칸씩 늘어난다 */
export const BAG_MIN_SLOTS = 12;
export const BAG_COLUMNS = 4;

export function bagSlotCount(itemCount: number): number {
  return Math.max(BAG_MIN_SLOTS, Math.ceil(itemCount / BAG_COLUMNS) * BAG_COLUMNS);
}

/**
 * 인벤토리 순서 그대로. 정의가 없는 아이디는 지금처럼 건너뛴다.
 * `extra`는 화면 검수용 표시 전용 아이템(개발자 모드) — 세이브에 들어가지 않는다.
 */
export function getBag(state: GameState, extra: readonly ItemDef[] = []): BagEntry[] {
  const owned = state.inventory.flatMap((id) => (ITEMS[id] ? [ITEMS[id]] : []));
  return [...owned, ...extra].map((item) => {
    const link = ITEM_LINKS[item.id];
    const quests = (link?.quests ?? []).flatMap((qid) => {
      const p = state.quests[qid];
      const q = QUESTS[qid];
      const stage = p && q?.stages.find((s) => s.id === p.stage);
      return stage ? [{ id: qid, name: q.name, stageTitle: stage.title, done: isQuestFinished(qid, p.stage) }] : [];
    });
    const records = link ? storyRecordsForFlags(state, link.recordFlags) : [];
    return { item, quests, records };
  });
}

/** 연결 표가 실제 퀘스트·기록 플래그만 가리키는지 (테스트용) */
export function validateItemLinks(): string[] {
  const errs: string[] = [];
  const flags = new Set(STORY_RECORDS.map((r) => r.flag));
  for (const id of Object.keys(ITEMS)) if (!ITEM_LINKS[id]) errs.push(`no link entry: ${id}`);
  for (const [id, l] of Object.entries(ITEM_LINKS)) {
    if (!ITEMS[id]) errs.push(`unknown item: ${id}`);
    for (const q of l.quests) if (!QUESTS[q]) errs.push(`${id}: unknown quest ${q}`);
    for (const f of l.recordFlags) if (!flags.has(f)) errs.push(`${id}: unknown record flag ${f}`);
  }
  return errs;
}

// ── 아이콘 대체 그림 ──────────────────────────────────────────
// 이모지가 기기 글꼴에 없으면(예: 🪙 → ▯) 아이템 아이디로 정해지는 문장(紋章)을 그린다.
// 같은 아이디는 언제나 같은 모양·색. 새 그림 에셋이 아니라 SVG 도형과 이름 첫 글자다.

export interface ItemCrest {
  hue: number;
  shape: 'coin' | 'shield' | 'diamond' | 'hex';
  letter: string;
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function itemCrest(item: Pick<ItemDef, 'id' | 'name'>): ItemCrest {
  const h = fnv1a(item.id);
  const shapes: ItemCrest['shape'][] = ['coin', 'shield', 'diamond', 'hex'];
  return { hue: h % 360, shape: shapes[(h >>> 9) % shapes.length], letter: Array.from(item.name.trim())[0] ?? '?' };
}
