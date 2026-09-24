import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { createInitialState } from '../state';
import { ITEMS, QUESTS } from '../content/world';
import { STORY_RECORDS, getDiscoveredRecords } from '../content/records';
import { BAG_MIN_SLOTS, bagSlotCount, getBag, itemCrest, validateItemLinks } from '../content/bag';
import bagUi from '../../ui/BagPanel.tsx?raw';

const withInv = (inventory: string[], extra: Partial<GameState> = {}): GameState => ({ ...createInitialState(), inventory, ...extra });

describe('GM-P8 가방', () => {
  it('인벤토리 순서·보유 그대로, 정의 없는 아이디는 건너뛴다 (수량을 지어내지 않는다)', () => {
    const s = withInv(['invitation', 'nope', 'old_key', 'goblin_tooth_chip']);
    expect(getBag(s).map((b) => b.item.id)).toEqual(['invitation', 'old_key', 'goblin_tooth_chip']);
    expect(getBag(withInv([]))).toEqual([]);
  });

  it('칸 수: 최소 12칸, 넘치면 4칸씩 늘어난다', () => {
    expect(bagSlotCount(0)).toBe(BAG_MIN_SLOTS);
    expect(bagSlotCount(12)).toBe(12);
    expect(bagSlotCount(13)).toBe(16);
    expect(bagSlotCount(17)).toBe(20);
  });

  it('연결 표는 실제 아이템·퀘스트·기록 플래그만 가리킨다', () => {
    expect(validateItemLinks()).toEqual([]);
  });

  it('관련 사건·기록은 이 세이브가 가진 것만 — 없으면 비어 있고, 문구는 원문 그대로', () => {
    const bare = withInv(Object.keys(ITEMS), { quests: {} });
    for (const b of getBag(bare)) {
      expect(b.quests).toEqual([]);
      expect(b.records).toEqual([]);
    }
    const rich = withInv(['old_spade_card', 'invitation', 'goblin_tooth_chip'], {
      flags: { prologue_card: true, gate_merchant_met: true, night_pier_hint: true, invitation_meaning_known: 'claim', chip_refused: true },
      quests: { q_prologue: { stage: 'done', completed: [] }, q_invitation: { stage: 'done', completed: [] }, q_night_pier: { stage: 'wager', completed: [] } },
    });
    const before = JSON.stringify(rich);
    const bag = getBag(rich);
    expect(JSON.stringify(rich)).toBe(before);
    const discovered = new Set(getDiscoveredRecords(rich).map((r) => r.text));
    for (const b of bag) {
      for (const r of b.records) expect(discovered.has(r.text), r.text).toBe(true);
      for (const q of b.quests) {
        expect(q.name).toBe(QUESTS[q.id].name);
        expect(QUESTS[q.id].stages.map((st) => st.title)).toContain(q.stageTitle);
      }
    }
    const card = bag.find((b) => b.item.id === 'old_spade_card')!;
    expect(card.records.map((r) => r.kind)).toEqual(['fact', 'fact', 'claim']);
    const inv = bag.find((b) => b.item.id === 'invitation')!;
    expect(inv.quests.map((q) => [q.id, q.done])).toEqual([['q_invitation', true], ['q_night_pier', false]]);
    // 검은 칩 기록은 초대장·카드에 붙지 않는다 (없는 연결 금지)
    const chipText = STORY_RECORDS.find((r) => r.flag === 'chip_refused')!.text;
    expect(bag.flatMap((b) => b.records.map((r) => r.text))).not.toContain(chipText);
    expect(bag.find((b) => b.item.id === 'goblin_tooth_chip')!.records).toEqual([]);
  });

  it('대체 문장은 아이디로 결정된다', () => {
    const a = itemCrest(ITEMS.goblin_tooth_chip);
    expect(itemCrest(ITEMS.goblin_tooth_chip)).toEqual(a);
    expect(a.letter).toBe('이');
    const all = Object.values(ITEMS).map((i) => JSON.stringify(itemCrest(i)));
    expect(new Set(all).size).toBe(all.length);
  });

  it('지금 할 수 없는 사용·보여주기 버튼을 만들지 않는다', () => {
    expect(bagUi).not.toMatch(/>\s*(사용|보여주기|사용하기|보여 주기)\s*</);
  });
});
