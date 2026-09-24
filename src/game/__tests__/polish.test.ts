import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { createInitialState, reducer } from '../state';
import { getInteraction } from '../content/dialogues';
import { getDiscoveredRecords } from '../content/records';
import { EVENTS, resolveEventText } from '../content/events';
import { LOCATIONS } from '../content/world';
import { importSave } from '../save';

function at(s: GameState, location: string, x = 2, y = 4): GameState {
  return { ...s, player: { ...s.player, location, x, y } };
}

/** 대화 트리 lint에 쓰는 상태 표본 — 그리즐의 모든 root 분기를 한 번씩 거친다 */
function fixtures(): GameState[] {
  const s = createInitialState();
  const met = { ...s, npcs: { ...s.npcs, goblin: { meetCount: 1, fooledPlayer: false, caughtLying: false } } };
  const won = { ...met, inventory: ['old_key'], quests: { ...met.quests, q_invitation: { stage: 'find_lock', completed: ['boxes'] } } };
  return [
    s,
    met,
    won,
    { ...met, npcs: { goblin: { meetCount: 2, fooledPlayer: false, caughtLying: true } } },
    { ...met, npcs: { goblin: { meetCount: 2, fooledPlayer: true, caughtLying: false } } },
    { ...won, flags: { ...won.flags, found_invitation: true, warehouse_opened: true } },
    { ...met, flags: { ...met.flags, gf_stage: 'returned' } },
    { ...met, flags: { ...met.flags, gf_stage: 'found' } },
  ];
}

describe('GM-P3C 다듬기', () => {
  it('F2 lint: 모든 장소·엔티티의 root 마지막 선택지는 대결을 시작하지 않는 중립 종료다', () => {
    for (const st of fixtures()) {
      for (const loc of Object.values(LOCATIONS)) {
        for (const e of loc.entities) {
          const tree = getInteraction(e.id, at(st, loc.id));
          const root = tree.nodes[tree.entry];
          const last = root.choices[root.choices.length - 1];
          expect(last.startEncounter, `${loc.id}/${e.id}: "${last.text}"`).toBeFalsy();
        }
      }
    }
  });

  it('F2: 그리즐의 재대결 선택지는 종료 선택지 앞에 있다 (대결 승리 후·초대장 이후)', () => {
    const [, , won, , , invited] = fixtures();
    for (const s of [won, invited]) {
      const texts = getInteraction('goblin', at(s, 'market')).nodes.root.choices.map((c) => c.text);
      expect(texts.indexOf('다시 대결을 청한다')).toBeLessThan(texts.length - 1);
    }
  });

  it('H1: 미라의 카드 혼잣말은 입구 장터를 한 번 떠나면 소모되고, 새로고침으로는 소모되지 않는다', () => {
    let s = at({ ...createInitialState(), flags: { prologue_card: true, prologue_done: true } }, 'market', 2, 6);
    s = importSave(JSON.stringify(s))!;
    expect(s.flags.mira_card_bark_seen).toBeUndefined();
    s = reducer(s, { type: 'GOTO_LOCATION', locationId: 'central_market', x: 4, y: 7 });
    expect(s.flags.mira_card_bark_seen).toBe(true);
    expect(getDiscoveredRecords(s).some((r) => r.kind === 'claim' && r.text.includes('넣어 두는 게 좋아'))).toBe(true);
    // 카드가 없던 세이브에는 생기지 않는다
    let n = at(createInitialState(), 'market', 2, 6);
    n = reducer(n, { type: 'GOTO_LOCATION', locationId: 'central_market', x: 4, y: 7 });
    expect(n.flags.mira_card_bark_seen).toBeUndefined();
  });

  it('H3: 초대장 발견 장면에 질문 한 줄이 붙는다 (사실로 기록되지 않음)', () => {
    expect(EVENTS.found_invitation.text).toContain('누가 이걸 빈 창고에 둔 걸까.');
    const s = { ...createInitialState(), flags: { found_invitation: true } };
    expect(getDiscoveredRecords(s).some((r) => r.text.includes('빈 창고에 둔'))).toBe(false);
  });

  it('H4: 항구 도착 문구는 그리즐의 경고를 들은 경우에만 회상으로 바뀐다', () => {
    const ev = EVENTS.port_arrival;
    expect(resolveEventText(ev, {})).toBe(ev.text);
    expect(resolveEventText(ev, { heard_grizzle_port_warning: true })).toContain('그리즐이 그랬지');
    // 경고를 듣는 경로: 초대장 이후 그리즐의 어느 선택지든 기록된다
    const invited = fixtures()[5];
    const root = getInteraction('goblin', at(invited, 'market')).nodes.root;
    for (const c of root.choices.filter((x) => x.text === '씩 웃어 보인다' || x.text === '다시 대결을 청한다')) {
      expect((c.effects ?? []).some((e) => e.type === 'SET_FLAG' && e.key === 'heard_grizzle_port_warning')).toBe(true);
    }
  });
});
