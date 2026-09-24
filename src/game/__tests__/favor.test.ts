import { describe, expect, it } from 'vitest';
import type { BoxIndex, GameState } from '../types';
import { createInitialState, reducer } from '../state';
import { getInteraction } from '../content/dialogues';
import { getDiscoveredRecords } from '../content/records';
import { getScenario } from '../encounter';
import { importSave } from '../save';

/** 그리즐을 한 번 만난 뒤 입구 장터(GM-02)에 있는 상태 */
function base(): GameState {
  const s = createInitialState();
  return {
    ...s,
    player: { ...s.player, location: 'market', x: 2, y: 4 },
    flags: { ...s.flags, prologue_done: true },
    npcs: { ...s.npcs, goblin: { meetCount: 1, caughtLying: false, fooledPlayer: false } as GameState['npcs'][string] },
    quests: { ...s.quests, q_invitation: { stage: 'start', completed: [] } },
  };
}

const at = (s: GameState, location: string): GameState => ({ ...s, player: { ...s.player, location } });
const travel = (s: GameState): GameState =>
  reducer(reducer(s, { type: 'GOTO_LOCATION', locationId: 'market', x: 6, y: 1 }), { type: 'GOTO_LOCATION', locationId: 'central_market', x: 4, y: 7 });

function choices(s: GameState, entityId: string, node = 'root'): string[] {
  const tree = getInteraction(entityId, s);
  return (tree.nodes[node] ?? tree.nodes[tree.entry]).choices.map((c) => c.text);
}

/** 선택지를 고르고, next 노드가 있으면 그 노드 텍스트도 돌려준다 */
function choose(s: GameState, entityId: string, textIncludes: string, node = 'root'): { s: GameState; next?: string } {
  const tree = getInteraction(entityId, s);
  const n = tree.nodes[node] ?? tree.nodes[tree.entry];
  const c = n.choices.find((x) => x.text.includes(textIncludes));
  if (!c) throw new Error(`no choice "${textIncludes}" in ${entityId}/${node}: ${n.choices.map((x) => x.text).join(' | ')}`);
  const out = (c.effects ?? []).reduce(reducer, s);
  return { s: out, next: c.next ? getInteraction(entityId, out).nodes[c.next]?.text : undefined };
}

const offer = (s: GameState) => choose(at(s, 'market'), 'goblin', '빈 것 같은데').s;
const seeStall = (s: GameState) => choose(at(s, 'market'), 'crates', '기억해 둔다').s;
const seeCart = (s: GameState) => choose(at(s, 'central_market'), 'gm03_north_cart', '칠한 상자를 살펴본다').s;
const giveBack = (s: GameState) => choose(at(s, 'market'), 'goblin', '돌려준다');

function winDuel(s: GameState): GameState {
  s = reducer(at(s, 'market'), { type: 'ENCOUNTER_START', npcId: 'goblin' });
  s = reducer(s, { type: 'ENCOUNTER_INTRO_DONE' });
  const idx = getScenario(s.activeEncounter!).boxes.indexOf('treasure') as BoxIndex;
  s = reducer(s, { type: 'ENCOUNTER_CHOOSE', box: idx });
  return reducer(s, { type: 'ENCOUNTER_CLOSE' });
}

const keyCount = (s: GameState) => s.inventory.filter((i) => i === 'old_key').length;

describe('GM-P3 그리즐의 부탁 (열쇠의 대결 외 경로)', () => {
  it('부탁 전에는 아무 진행도 없고, 장소 진입·새로고침만으로 진행되지 않는다', () => {
    let s = base();
    expect(choices(at(s, 'market'), 'crates').join()).not.toContain('기억해 둔다');
    expect(choices(at(s, 'central_market'), 'gm03_north_cart')).toEqual(['물러난다']);
    s = travel(s);
    s = importSave(JSON.stringify(s))!;
    expect(s.flags.gf_stage).toBeUndefined();
    expect(choices(at(s, 'market'), 'goblin').join()).toContain('빈 것 같은데');
  });

  for (const order of ['stall-first', 'cart-first'] as const) {
    it(`근거 경로 (${order}): 두 사실을 모두 확인해야 근거 선택지가 나타난다`, () => {
      let s = offer(base());
      s = order === 'stall-first' ? seeStall(s) : seeCart(s);
      expect(choices(at(s, 'central_market'), 'gm03_north_cart').join()).not.toContain('짚어 보인다');
      s = order === 'stall-first' ? seeCart(s) : seeStall(s);
      expect(choices(at(s, 'central_market'), 'gm03_north_cart').join()).toContain('짚어 보인다');
      s = choose(at(s, 'central_market'), 'gm03_north_cart', '짚어 보인다').s;
      expect(s.flags.gf_stage).toBe('found');
      expect(s.flags.gf_method).toBe('evidence');
      expect(s.player.location).toBe('central_market'); // 수레는 막힌 길 그대로
    });
  }

  it('떠보기: 좌판 사실 없이 거절 → 같은 이동 횟수·새로고침으로는 재시도 불가 → 이동 후 재시도(여전히 거절) → 좌판 확인 후 성공', () => {
    let s = at(offer(base()), 'central_market');
    const r = choose(s, 'gm03_north_cart', '떠본다');
    s = r.s;
    expect(r.next).toContain('직접 와서 말하라');
    expect(s.flags.gf_refused_at).toBe(Number(s.flags.travel_count ?? 0));
    // 같은 이동 횟수: 대기 안내만, 상태 변화 없음
    const again = choose(s, 'gm03_north_cart', '떠본다');
    expect(again.next).toContain('나중에 와');
    expect(again.s.flags).toEqual(s.flags);
    // 새로고침으로는 풀리지 않는다
    s = importSave(JSON.stringify(s))!;
    expect(choose(s, 'gm03_north_cart', '떠본다').next).toContain('나중에 와');
    // 이동 후 재시도: 아직 좌판 사실이 없으니 같은 거절 논리
    s = travel(s);
    const r2 = choose(s, 'gm03_north_cart', '떠본다');
    expect(r2.next).toContain('직접 와서 말하라');
    s = r2.s;
    expect(s.flags.gf_refused_at).toBe(Number(s.flags.travel_count));
    // 좌판 사실 확보 + 이동 → 떠보기 성공
    s = travel(seeStall(s));
    s = at(s, 'central_market');
    s = choose(s, 'gm03_north_cart', '떠본다').s;
    expect(s.flags.gf_stage).toBe('found');
    expect(s.flags.gf_method).toBe('bluff');
  });

  it('거절은 근거 경로를 막지 않는다 (대기 중에도 두 사실이 있으면 근거 제시 가능)', () => {
    let s = at(offer(base()), 'central_market');
    s = choose(s, 'gm03_north_cart', '떠본다').s;
    s = seeCart(seeStall(s));
    s = at(s, 'central_market');
    expect(choices(s, 'gm03_north_cart').join()).toContain('짚어 보인다');
    s = choose(s, 'gm03_north_cart', '짚어 보인다').s;
    expect(s.flags.gf_stage).toBe('found');
  });

  it('부탁 먼저: 상자 반납 → 열쇠 1개, key_route=favor, 초대장 퀘스트 find_lock → 이후 대결 승리도 열쇠 중복·경로 변경 없음', () => {
    let s = seeCart(seeStall(offer(base())));
    s = choose(at(s, 'central_market'), 'gm03_north_cart', '짚어 보인다').s;
    s = importSave(JSON.stringify(s))!; // 되찾은 상자는 새로고침 후에도 유지
    expect(s.flags.gf_stage).toBe('found');
    const ret = giveBack(s);
    s = ret.s;
    expect(ret.next).toContain('녹슨 열쇠');
    expect(keyCount(s)).toBe(1);
    expect(s.flags.key_route).toBe('favor');
    expect(s.quests.q_invitation.stage).toBe('find_lock');
    expect(choices(at(s, 'market'), 'goblin').join()).not.toContain('돌려준다'); // 반납은 한 번뿐
    expect(getInteraction('goblin', at(s, 'market')).nodes.root.text).toContain('상자 찾아 준 손님'); // 경로별 사회적 반응
    s = winDuel(s);
    expect(keyCount(s)).toBe(1);
    expect(s.flags.key_route).toBe('favor');
    expect(s.quests.q_invitation.stage).toBe('find_lock');
    // 대결은 계속 가능
    expect(getInteraction('goblin', at(s, 'market')).nodes.root.choices.some((c) => c.startEncounter)).toBe(true);
  });

  it('대결 먼저: key_route=duel, 열쇠가 있으면 부탁은 새로 시작되지 않는다', () => {
    const s = winDuel(base());
    expect(keyCount(s)).toBe(1);
    expect(s.flags.key_route).toBe('duel');
    expect(choices(at(s, 'market'), 'goblin').join()).not.toContain('빈 것 같은데');
  });

  it('교차: 부탁 수락 → 대결로 열쇠 → 상자 반납은 이야기만 (열쇠·경로·퀘스트 불변)', () => {
    let s = offer(base());
    s = winDuel(s);
    const stageBefore = s.quests.q_invitation.stage;
    s = seeCart(seeStall(s));
    s = choose(at(s, 'central_market'), 'gm03_north_cart', '짚어 보인다').s;
    const ret = giveBack(s);
    s = ret.s;
    expect(ret.next).toContain('전에 챙겨 갔잖아');
    expect(keyCount(s)).toBe(1);
    expect(s.flags.key_route).toBe('duel');
    expect(s.flags.gf_key_given).toBeUndefined();
    expect(s.quests.q_invitation.stage).toBe(stageBefore);
    expect(s.quests.q_grizzle_favor.stage).toBe('returned');
  });

  it('창고를 이미 연 뒤: 반납해도 열쇠를 주지 않고 창고를 다시 잠그지 않는다', () => {
    let s = offer(base());
    s = { ...s, flags: { ...s.flags, warehouse_opened: true }, unlocked: ['warehouse'] };
    s = choose(at(s, 'central_market'), 'gm03_north_cart', '떠본다').s; // 좌판 사실 없음 → 거절
    s = travel(seeStall(s));
    s = choose(at(s, 'central_market'), 'gm03_north_cart', '떠본다').s;
    s = giveBack(s).s;
    expect(s.inventory).not.toContain('old_key');
    expect(s.unlocked).toContain('warehouse');
    expect(s.flags.gf_stage).toBe('returned');
  });

  it('초대장 이후의 그리즐 대화에도 반납 선택지가 붙는다', () => {
    let s = seeCart(seeStall(offer(base())));
    s = choose(at(s, 'central_market'), 'gm03_north_cart', '짚어 보인다').s;
    s = { ...s, flags: { ...s.flags, found_invitation: true } };
    expect(choices(at(s, 'market'), 'goblin').join()).toContain('돌려준다');
  });

  it('구버전 v6 세이브(부탁 플래그 없음)도 안전하게 부탁을 시작할 수 있다', () => {
    const legacy = JSON.parse(JSON.stringify(base()));
    delete legacy.flags.travel_count;
    const s = importSave(JSON.stringify(legacy))!;
    expect(s.flags.gf_stage).toBeUndefined();
    const s2 = choose(at(offer(s), 'central_market'), 'gm03_north_cart', '떠본다').s;
    expect(s2.flags.gf_refused_at).toBe(0);
  });

  it('일지: 좌판·수레는 사실, 그리즐·짐꾼 말은 주장, "같은 상자"는 추정', () => {
    let s = seeCart(seeStall(offer(base())));
    const recs = getDiscoveredRecords(s);
    const kinds = (k: string) => recs.filter((r) => r.kind === k).map((r) => r.text);
    expect(kinds('fact')).toHaveLength(2);
    expect(kinds('fact').every((t) => !t.includes('그리즐의 상자') && !t.includes('같은'))).toBe(true);
    expect(kinds('claim').some((t) => t.startsWith('그리즐:'))).toBe(true);
    expect(kinds('claim').some((t) => t.startsWith('짐꾼:'))).toBe(true);
    expect(kinds('inference').some((t) => t.includes('그 상자로 보인다'))).toBe(true);
    s = choose(at(s, 'central_market'), 'gm03_north_cart', '떠본다').s;
    expect(getDiscoveredRecords(s).some((r) => r.kind === 'inference' && r.text.includes('떠봤다'))).toBe(true);
  });

  it('수레 대화는 어떤 선택지도 이동을 일으키지 않는다 (막힌 미래 출구 유지)', () => {
    const s = at(offer(base()), 'central_market');
    const tree = getInteraction('gm03_north_cart', s);
    const all = Object.values(tree.nodes).flatMap((n) => n.choices).flatMap((c) => c.effects ?? []);
    expect(all.some((e) => e.type === 'USE_EXIT' || e.type === 'GOTO_LOCATION')).toBe(false);
  });
});
