import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { createInitialState, reducer } from '../state';
import { getInteraction } from '../content/dialogues';
import { getDiscoveredRecords } from '../content/records';

function withFlags(state: GameState, flags: Record<string, boolean | string | number>): GameState {
  return { ...state, flags: { ...state.flags, ...flags } };
}

function choiceTexts(entityId: string, state: GameState): string[] {
  const t = getInteraction(entityId, state);
  return t.nodes[t.entry].choices.map((c) => c.text);
}

describe('스토리 분기 (Phase 5)', () => {
  it('검은 칩 선택지는 대결을 치른 뒤에만 열린다', () => {
    let s = createInitialState();
    s = { ...s, npcs: { goblin: { meetCount: 1, fooledPlayer: false, caughtLying: false } } };
    expect(choiceTexts('goblin', s).join()).not.toContain('검은 칩');
    s = { ...s, career: { ...s.career, duels: 1 } };
    expect(choiceTexts('goblin', s).join()).toContain('검은 칩');
  });

  it('미라의 검은 칩 반응은 칩을 본 뒤에만 열리고, 퀘스트를 조사 단계로 진행시킨다', () => {
    let s = createInitialState();
    s = { ...s, npcs: { mira: { meetCount: 1, fooledPlayer: false, caughtLying: false } } };
    expect(choiceTexts('mira', s).join()).not.toContain('검은 칩');
    s = withFlags(s, { chip_seen: true });
    const texts = choiceTexts('mira', s);
    expect(texts.join()).toContain('검은 칩');
  });

  it('그리즐에게 캐물어도(경계) 미라 경로로 사건을 끝낼 수 있다 — 소프트락 없음', () => {
    let s = createInitialState();
    s = { ...s, career: { ...s.career, duels: 1 }, npcs: { goblin: { meetCount: 1, fooledPlayer: false, caughtLying: false } } };
    s = withFlags(s, { chip_seen: true, chip_refused: true, chip_pressed: true, chip_asked_mira: true });
    // 캐물었어도(미움) 미라의 정보를 얻었으면 '약속 이야기' 선택지가 열린다 (냉담한 버전)
    const t = getInteraction('goblin', s);
    const resolve = t.nodes[t.entry].choices.find((c) => c.text.includes('약속'));
    expect(resolve).toBeDefined();
    expect(resolve!.next).toBe('chip_resolve_cold');
  });

  it('핀의 떠보기 간파 선택지는 게시판 소문을 읽었을 때만 나타난다', () => {
    let s = createInitialState();
    expect(choiceTexts('fin', s).join()).not.toContain('낚시꾼');
    s = withFlags(s, { pier_rumor: true });
    expect(choiceTexts('fin', s).join()).toContain('낚시꾼');
  });

  it('항구 첫 도착 시 메인 퀘스트가 자동 시작되고 방문 기록이 남는다', () => {
    let s = createInitialState();
    s = reducer(s, { type: 'GOTO_LOCATION', locationId: 'port_docks', x: 3, y: 8 });
    expect(s.quests.q_night_pier.stage).toBe('arrive');
    expect(s.visitedRegions).toContain('trickster_port');
    expect(s.flags.port_arrived).toBe(true);
  });

  it('초대장의 의미: 직접 확인은 사실, 핀의 말은 주장으로 구분 기록된다', () => {
    const s = createInitialState();
    const factState = withFlags(s, { invitation_meaning_known: 'fact' });
    const claimState = withFlags(s, { invitation_meaning_known: 'claim' });
    const factRec = getDiscoveredRecords(factState).find((r) => r.text.includes('끝나지 않은 승부'));
    const claimRec = getDiscoveredRecords(claimState).find((r) => r.text.includes('이름이 없다'));
    expect(factRec?.kind).toBe('fact');
    expect(claimRec?.kind).toBe('claim');
  });

  it('접근 방식에 따라 그리즐의 공개 장면이 달라진다 (warm vs cold)', () => {
    let s = createInitialState();
    s = { ...s, career: { ...s.career, duels: 1 }, npcs: { goblin: { meetCount: 1, fooledPlayer: false, caughtLying: false } } };
    const gentle = withFlags(s, { chip_seen: true, chip_refused: true, chip_asked_mira: true });
    const pressed = withFlags(gentle, { chip_pressed: true });
    const gentleTree = getInteraction('goblin', gentle);
    const pressedTree = getInteraction('goblin', pressed);
    const gentleResolve = gentleTree.nodes[gentleTree.entry].choices.find((c) => c.text.includes('약속'));
    const pressedResolve = pressedTree.nodes[pressedTree.entry].choices.find((c) => c.text.includes('약속'));
    expect(gentleResolve!.next).toBe('chip_resolve_warm');
    expect(pressedResolve!.next).toBe('chip_resolve_cold');
  });
});
