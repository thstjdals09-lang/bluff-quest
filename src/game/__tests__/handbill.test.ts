import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { createInitialState, reducer } from '../state';
import { getInteraction } from '../content/dialogues';
import { getDiscoveredRecords } from '../content/records';
import { LOCATIONS } from '../content/world';
import { importSave } from '../save';
import { HB_MAX_POSTS } from '../content/handbill';

/** 그리즐을 만난 뒤 입구 장터 (5,2) — 게시판(5,1) 앞 */
function base(extraFlags: GameState['flags'] = {}): GameState {
  const s = createInitialState();
  return {
    ...s,
    player: { ...s.player, location: 'market', x: 5, y: 2 },
    flags: { ...s.flags, prologue_done: true, ...extraFlags },
    npcs: { ...s.npcs, goblin: { meetCount: 1, caughtLying: false, fooledPlayer: false } },
    quests: { ...s.quests, q_invitation: { stage: 'start', completed: [] } },
  };
}
const S01_DONE = { s01_truth: 'T1', s01_stage: 'resolved', s01_verdict: 'A', s01_rel_A: 'warm', s01_rel_B: 'neutral' } as const;

const at = (s: GameState, location: string): GameState => ({ ...s, player: { ...s.player, location } });
const go = (s: GameState, locationId: string): GameState => {
  const arrive: Record<string, [number, number]> = { market: [6, 1], central_market: [4, 7], market_road: [2, 2], warehouse: [2, 4] };
  const [x, y] = arrive[locationId];
  return reducer(s, { type: 'GOTO_LOCATION', locationId, x, y });
};
const reload = (s: GameState) => importSave(JSON.stringify(s))!;

function node(s: GameState, entityId: string, nodeId = 'root') {
  const t = getInteraction(entityId, s);
  return t.nodes[nodeId] ?? t.nodes[t.entry];
}
function texts(s: GameState, entityId: string, nodeId = 'root') {
  return node(s, entityId, nodeId).choices.map((c) => c.text);
}
/** 선택지 고르기 (nodeId 안에서) → 효과 적용, next 노드 텍스트 반환 */
function pick(s: GameState, entityId: string, textIncludes: string, nodeId = 'root'): { s: GameState; next?: string } {
  const n = node(s, entityId, nodeId);
  const c = n.choices.find((x) => x.text.includes(textIncludes));
  if (!c) throw new Error(`no "${textIncludes}" in ${entityId}/${nodeId}: ${n.choices.map((x) => x.text).join(' | ')}`);
  const out = (c.effects ?? []).reduce(reducer, s);
  return { s: out, next: c.next ? getInteraction(entityId, out).nodes[c.next]?.text : undefined };
}
/** 인물의 벽보 하위 메뉴에서 고르기 */
function menu(s: GameState, entityId: 's01_b' | 's01_onlooker', textIncludes: string) {
  const opened = pick(s, entityId, '벽보 이야기').s;
  return pick(opened, entityId, textIncludes, 'hb_menu');
}

const notice = (s: GameState) => pick(at(s, 'market'), 'board', '벽보를 자세히 본다').s;
const tear = (s: GameState) => pick(at(s, 'market'), 'board', '벽보를 뜯어낸다').s;
const culpritFacts = (s: GameState) => getDiscoveredRecords(s).filter((r) => r.kind === 'fact' && /되팔이 상인이 붙|붙였다/.test(r.text));

describe('GM-P4-A 벽보 덮기', () => {
  it('그리즐을 만나기 전에는 벽보가 없고, 불러오기만으로는 시작되지 않는다', () => {
    const s = { ...base(), npcs: {} };
    expect(node(at(s, 'market'), 'board').text).not.toContain('벽보');
    expect(reload(base()).flags.hb_stage).toBeUndefined();
  });

  it('첫 게시판 조사에서 시작된다 (어느 선택지든) — 익명 비방은 주장으로만 기록', () => {
    let s = pick(at(base(), 'market'), 'board', '물러난다').s;
    expect(s.flags.hb_stage).toBe('noticed');
    expect(s.quests.q_handbill.stage).toBe('noticed');
    s = notice(base());
    const recs = getDiscoveredRecords(s);
    expect(recs.find((r) => r.text.includes('빈 상자 장사'))!.kind).toBe('claim');
    expect(recs.some((r) => r.kind === 'fact' && r.text.includes('절취선'))).toBe(true);
  });

  it('상태 머신: GM02→road→GM02 는 게시만 (빈 좌판 없음), 새로고침은 어느 단계도 전진시키지 않는다', () => {
    let s = tear(notice(base(S01_DONE)));
    expect(s.flags.hb_stage).toBe('away_pending');
    expect(reload(s).flags.hb_stage).toBe('away_pending');
    s = go(s, 'market_road');
    expect(s.flags.hb_stage).toBe('posting');
    expect(s.flags.hb_b_away).not.toBe(true);
    expect(reload(s).flags.hb_stage).toBe('posting');
    s = go(s, 'market');
    expect(s.flags.hb_stage).toBe('posted');
    expect(s.flags.hb_up).toBe(true);
    expect(s.flags.hb_posts).toBe(1);
    expect(reload(s).flags.hb_stage).toBe('posted');
  });

  it('상태 머신: GM02→GM03→GM02→GM03 — 빈 좌판(S01 해결 후) → 젖은 벽보 → 풀 자국 창 → 조사 중', () => {
    let s = tear(notice(base(S01_DONE)));
    s = go(s, 'central_market');
    expect(s.flags.hb_stage).toBe('posting');
    expect(s.flags.hb_b_away).toBe(true);
    // 빈 좌판은 되팔이의 S01 대화를 대신한다 (이 방문만)
    expect(node(s, 's01_b').text).toContain('좌판이 비어 있다');
    s = pick(s, 's01_b', '기억해 둔다').s;
    expect(s.flags.hb_seen_absent).toBe(true);
    const r = reload(s);
    expect(r.flags.hb_b_away).toBe(true); // 새로고침은 창을 없애지도, 전진시키지도 않는다
    s = go(s, 'market');
    expect(s.flags.hb_b_away).toBe(false);
    expect(s.flags.hb_stage).toBe('posted');
    const wet = pick(s, 'board', '벽보를 자세히 본다');
    expect(wet.next).toContain('마르지 않았다');
    s = wet.s;
    expect(s.flags.hb_seen_wet).toBe(true);
    s = go(s, 'central_market');
    expect(s.flags.hb_stage).toBe('gm03_window');
    s = menu(s, 's01_b', '손을 슬쩍 살핀다').s;
    expect(s.flags.hb_seen_hands).toBe(true);
    s = go(s, 'market');
    expect(s.flags.hb_stage).toBe('investigating');
  });

  it('젖은 벽보는 게시된 그 방문에서만 관찰된다', () => {
    let s = go(go(tear(notice(base())), 'market_road'), 'market');
    s = go(go(s, 'market_road'), 'market'); // 다음 방문: 더 이상 젖어 있지 않다
    const t = pick(s, 'board', '벽보를 자세히 본다');
    expect(t.next).not.toContain('마르지 않았다');
    expect(t.s.flags.hb_seen_wet).toBeUndefined();
  });

  it('S01이 미해결이면 빈 좌판 증거를 만들지 않고 S01 선택지도 그대로 — 종이·영수증 경로로 해결 가능', () => {
    let s = go(at(base(), 'market'), 'central_market'); // S01 진입 (진실 확정)
    const s01Before = texts(s, 's01_b');
    s = go(s, 'market');
    s = tear(notice(s));
    s = go(s, 'central_market');
    expect(s.flags.hb_stage).toBe('posting');
    expect(s.flags.hb_b_away).not.toBe(true);
    const now = texts(s, 's01_b');
    for (const t of s01Before) expect(now).toContain(t);
    expect(now[now.length - 1]).toBe(s01Before[s01Before.length - 1]); // 종료 선택지는 여전히 마지막
    s = menu(s, 's01_b', '계산대를 훑어본다').s; // pad
    expect(s.flags.hb_seen_pad).toBe(true);
    // 종이(paper)는 첫 조사에서 이미 봤다 → 흔적 들이밀기 가능
    s = menu(s, 's01_b', '흔적을 들이민다').s;
    expect(s.flags.hb_resolved).toBe('evidence');
    expect(s.flags.s01_stage).not.toBe('resolved'); // S01 상태는 건드리지 않는다
  });

  it('떠보기: 사실 0개면 실패 → 같은 이동 횟수·새로고침으로는 재시도 불가 → 이동 + 사실 확보 후 성공', () => {
    let s = pick(at(base(S01_DONE), 'market'), 'board', '물러난다').s; // noticed, paper 미확인
    s = go(s, 'central_market');
    const f = menu(s, 's01_b', '떠본다');
    expect(f.next).toContain('사람 잡지 마');
    s = f.s;
    expect(s.flags.hb_bluff_failed_at).toBe(Number(s.flags.travel_count));
    expect(menu(s, 's01_b', '떠본다').next).toContain('증거라도 들고 와');
    expect(menu(reload(s), 's01_b', '떠본다').next).toContain('증거라도 들고 와');
    s = go(s, 'market');
    s = notice(s); // paper FACT
    s = go(s, 'central_market');
    const ok = menu(s, 's01_b', '떠본다');
    expect(ok.next).toContain('다신 안 붙여');
    expect(ok.s.flags.hb_resolved).toBe('bluff');
  });

  it('설득은 기존 s01_rel_B=warm을 읽기만 한다 (없으면 선택지 없음, 값을 만들지 않음)', () => {
    let s = notice(base({ ...S01_DONE, s01_rel_B: 'warm' }));
    s = go(s, 'central_market');
    expect(texts(pick(s, 's01_b', '벽보 이야기').s, 's01_b', 'hb_menu').join()).toContain('타이른다');
    s = menu(s, 's01_b', '타이른다').s;
    expect(s.flags.hb_resolved).toBe('persuaded');
    expect(s.flags.s01_rel_B).toBe('warm');
    let n = go(notice(base(S01_DONE)), 'central_market');
    expect(texts(pick(n, 's01_b', '벽보 이야기').s, 's01_b', 'hb_menu').join()).not.toContain('타이른다');
    n = menu(n, 's01_b', '계산대').s;
    expect(n.flags.s01_rel_B).toBe('neutral');
  });

  it('구경꾼을 잘못 짚으면 관계·소문만 바뀌고 범인 사실은 생기지 않으며 사건은 계속된다', () => {
    let s = go(notice(base(S01_DONE)), 'central_market');
    s = menu(s, 's01_onlooker', '가루를 본다').s;
    expect(s.flags.hb_seen_chalk).toBe(true);
    s = menu(s, 's01_onlooker', '벽보 붙인 게 당신이지').s;
    expect(s.flags.hb_onlooker_rel).toBe('cold');
    expect(s.flags.hb_stage).toBe('noticed');
    expect(culpritFacts(s)).toHaveLength(0);
    expect(getDiscoveredRecords(s).some((r) => r.kind === 'rumor' && r.text.includes('남 탓'))).toBe(true);
    // 알리바이는 게시 중 방문에서만
    s = go(s, 'market');
    s = tear(s);
    s = go(s, 'central_market');
    s = menu(s, 's01_onlooker', '뭘 적고 있었는지').s;
    expect(s.flags.hb_seen_alibi).toBe(true);
  });

  it('그리즐에게 알리기: 되팔이를 가리키는 관찰이 있어야 나타나고, 해결은 추정으로만 기록된다', () => {
    let s = notice(base(S01_DONE));
    expect(texts(pick(s, 'goblin', '벽보 얘기').s, 'goblin', 'hb_g_claim').join()).not.toContain('되팔이');
    s = go(s, 'central_market');
    s = menu(s, 's01_b', '계산대').s;
    s = go(s, 'market');
    s = pick(pick(s, 'goblin', '벽보 얘기').s, 'goblin', '되팔이 상인이 붙인', 'hb_g_claim').s;
    expect(s.flags.hb_resolved).toBe('grizzle');
    expect(culpritFacts(s)).toHaveLength(0);
    expect(getDiscoveredRecords(s).some((r) => r.kind === 'inference' && r.text.includes('그리즐에게'))).toBe(true);
  });

  it('다른 해결 뒤에는 그리즐에게 한 번 전할 수 있다 (누군지 묻지 않음)', () => {
    let s = notice(base({ ...S01_DONE, s01_rel_B: 'warm' }));
    s = menu(go(s, 'central_market'), 's01_b', '타이른다').s;
    s = go(s, 'market');
    const t = pick(s, 'goblin', '안 붙을 거라고 전한다');
    expect(t.next).toContain('누군진 안 물을게');
    expect(texts(t.s, 'goblin').join()).not.toContain('안 붙을 거라고');
  });

  it(`재게시는 최대 ${HB_MAX_POSTS}회 — 이후 뜯어도 더 붙지 않고, 모든 해결 선택지가 남는다`, () => {
    let s = notice(base(S01_DONE));
    for (let i = 0; i < HB_MAX_POSTS; i++) s = go(go(tear(s), 'market_road'), 'market');
    expect(s.flags.hb_posts).toBe(HB_MAX_POSTS);
    s = tear(s);
    expect(s.flags.hb_stage).toBe('investigating');
    s = go(go(s, 'market_road'), 'market');
    expect(s.flags.hb_up).toBe(false);
    expect(s.flags.hb_posts).toBe(HB_MAX_POSTS);
    s = go(s, 'central_market');
    const m = texts(pick(s, 's01_b', '벽보 이야기').s, 's01_b', 'hb_menu').join();
    expect(m).toContain('떠본다');
    s = menu(s, 's01_b', '계산대').s;
    expect(texts(pick(s, 's01_b', '벽보 이야기').s, 's01_b', 'hb_menu').join()).toContain('흔적을 들이민다');
  });

  it('무시해도 진행을 막지 않고 열쇠·부탁·창고·S01 플래그를 건드리지 않는다', () => {
    const b = notice(base(S01_DONE));
    const after = go(go(go(tear(b), 'central_market'), 'market'), 'central_market');
    for (const k of ['s01_stage', 's01_verdict', 's01_rel_A', 's01_rel_B', 'gf_stage', 'key_route', 'warehouse_opened', 'found_invitation']) {
      expect(after.flags[k]).toBe(b.flags[k]);
    }
    expect(after.inventory).toEqual(b.inventory);
    expect(after.quests.q_invitation).toEqual(b.quests.q_invitation);
    // 그리즐 대결 시작 선택지는 그대로
    expect(getInteraction('goblin', at(after, 'market')).nodes.root.choices.some((c) => c.startEncounter)).toBe(true);
  });

  it('구버전 v6 세이브(벽보 플래그 없음)는 안전하게 로드되고 조사 전까지 아무 변화가 없다', () => {
    const legacy = JSON.parse(JSON.stringify(base()));
    delete legacy.flags.travel_count;
    let s = reload(legacy);
    s = go(go(s, 'central_market'), 'market');
    expect(s.flags.hb_stage).toBeUndefined();
  });

  it('F2 lint (벽보 상태 포함): 모든 root의 마지막 선택지는 대결을 시작하지 않는다', () => {
    const states = [notice(base(S01_DONE)), go(tear(notice(base(S01_DONE))), 'central_market'), menu(go(notice(base({ ...S01_DONE, s01_rel_B: 'warm' })), 'central_market'), 's01_b', '타이른다').s];
    for (const st of states) {
      for (const loc of Object.values(LOCATIONS)) {
        for (const e of loc.entities) {
          const t = getInteraction(e.id, at(st, loc.id));
          const root = t.nodes[t.entry];
          expect(root.choices[root.choices.length - 1].startEncounter, `${loc.id}/${e.id}`).toBeFalsy();
        }
      }
    }
  });
});
