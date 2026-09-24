import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { createInitialState, reducer } from '../state';
import { getInteraction } from '../content/dialogues';
import { getNotebook } from '../content/incidents';
import { importSave } from '../save';
import { fxS01EvidenceOptions } from '../content/finExchange';
import finSrc from '../content/finExchange.ts?raw';

/** 핀을 이미 만난 뒤 부두 */
function base(flags: GameState['flags'] = {}, met = true): GameState {
  const s = createInitialState();
  return {
    ...s,
    player: { ...s.player, location: 'port_docks', x: 6, y: 5 },
    flags: { ...s.flags, prologue_done: true, pier_rumor: true, ...flags },
    npcs: met ? { ...s.npcs, fin: { meetCount: 1, caughtLying: false, fooledPlayer: false } } : {},
    quests: { ...s.quests, q_night_pier: { stage: 'informant', completed: ['arrive'] } },
  };
}
const FX_KEYS = ['fx_favor', 'fx_favor_at_stage', 'fx_favor_ok', 'fx_s01', 'fx_s01_claim', 'fx_hb', 'fin_trade_rep'];
const strip = (s: GameState): GameState => ({ ...s, flags: Object.fromEntries(Object.entries(s.flags).filter(([k]) => !FX_KEYS.includes(k))) });

function node(s: GameState, id: string) {
  const t = getInteraction('fin', s);
  return t.nodes[id];
}
function pick(s: GameState, nodeId: string, textIncludes: string): { s: GameState; next?: string } {
  const n = node(s, nodeId);
  const c = n.choices.find((x) => x.text.includes(textIncludes));
  if (!c) throw new Error(`no "${textIncludes}" in fin/${nodeId}: ${n.choices.map((x) => x.text).join(' | ')}`);
  const out = (c.effects ?? []).reduce(reducer, s);
  return { s: out, next: c.next ? getInteraction('fin', out).nodes[c.next]?.text : undefined };
}
const texts = (s: GameState, id: string) => node(s, id).choices.map((c) => c.text);

const FAVOR_FOUND_EVIDENCE = { gf_stage: 'found', gf_method: 'evidence', gf_seen_stall: true, gf_seen_cart: true };

describe('GM-P6 핀에게 시장 소식 팔기', () => {
  it('입구: 핀을 만났고 사건을 하나 이상 알 때만, 기존 종료 선택지 바로 앞에', () => {
    expect(texts(base(), 'menu_root')).not.toContain('시장 소식을 판다');
    expect(getInteraction('fin', base(FAVOR_FOUND_EVIDENCE, false)).entry).toBe('first'); // 첫 만남 트리는 그대로
    expect(getInteraction('fin', base(FAVOR_FOUND_EVIDENCE, false)).nodes.first.choices.map((c) => c.text).join()).not.toContain('시장 소식');
    const t = texts(base(FAVOR_FOUND_EVIDENCE), 'menu_root');
    expect(t).toEqual(['거래를 들어본다', '시장 소식을 판다', '지나간다']);
  });

  it('기존 핀 트리는 새 입구·노드를 빼면 어떤 평판·거래 플래그에서도 동일하다', () => {
    const variants: GameState['flags'][] = [
      {},
      { fin_trade_rep: 'reliable', fx_favor: 'a1', fx_favor_at_stage: 'found', fx_favor_ok: true },
      { fin_trade_rep: 'loose', fx_hb: 'smear_as_fact' },
      { fx_s01: 'vague' },
    ];
    for (const extra of variants) {
      for (const st of [base({ ...FAVOR_FOUND_EVIDENCE, hb_stage: 'noticed', s01_stage: 'resolved', ...extra }), base({ ...extra, fin_bluff_called: true, gf_stage: 'offered' })]) {
        const aug = getInteraction('fin', st);
        const plain = getInteraction('fin', strip({ ...st, flags: { ...st.flags, gf_stage: undefined as unknown as string, hb_stage: undefined as unknown as string, s01_stage: undefined as unknown as string } }));
        const cleaned = {
          entry: aug.entry,
          nodes: Object.fromEntries(
            Object.entries(aug.nodes)
              .filter(([k]) => !k.startsWith('fx_'))
              .map(([k, n]) => [k, k === 'menu_root' ? { ...n, choices: n.choices.filter((c) => c.text !== '시장 소식을 판다') } : n]),
          ),
        };
        expect(JSON.stringify(cleaned)).toBe(JSON.stringify(plain));
      }
    }
  });

  it('CASE A: 짐꾼이 겪은 결과·방식과 맞으면 신용, 다르면 의심 — 같은 단계 반복은 대사만', () => {
    let s = base(FAVOR_FOUND_EVIDENCE);
    const m = pick(s, 'fx_a', '낙인을 짚어');
    expect(m.next).toContain('딱 맞네');
    s = m.s;
    expect(s.flags.fin_trade_rep).toBe('reliable');
    expect(s.flags.fx_favor_ok).toBe(true);
    expect(texts(s, 'fx_a')).toEqual(['그만둔다']);
    expect(node(s, 'fx_a').text).toContain('이미 들었어');
    // 거짓: 수레에 있다고 우김 (이미 받아냈는데) — 다른 세이브
    const lie = pick(base(FAVOR_FOUND_EVIDENCE), 'fx_a', '아직 수레에');
    expect(lie.next).toContain('다르던데');
    expect(lie.s.flags.fin_trade_rep).toBe('loose');
  });

  it('CASE A: 모르는 방식은 말할 수 없다 (떠보기를 안 해 봤으면 그 선택지 없음), 단계가 바뀌면 다시 가능 → 평판 회복', () => {
    let s = base({ gf_stage: 'offered' });
    expect(texts(s, 'fx_a').join()).not.toContain('그리즐 이름을 대서');
    expect(texts(s, 'fx_a').join()).not.toContain('낙인을 짚어');
    // 받기 전인데 받았다고… 할 방법 자체가 없고, "아직 수레에"는 사실
    s = pick(s, 'fx_a', '아직 수레에').s;
    expect(s.flags.fin_trade_rep).toBe('reliable');
    // 떠보기로 받아낸 뒤, 증거로 받았다고 거짓말하려 해도 그 방식을 모르면 선택지가 없다
    let b = base({ gf_stage: 'found', gf_method: 'bluff', gf_seen_stall: true, gf_refused_at: 1 });
    expect(texts(b, 'fx_a').join()).not.toContain('낙인을 짚어');
    b = pick(b, 'fx_a', '아직 수레에').s; // 거짓 → loose
    expect(b.flags.fin_trade_rep).toBe('loose');
    b = { ...b, flags: { ...b.flags, gf_stage: 'returned' } };
    b = pick(b, 'fx_a', '그리즐 이름을 대서').s; // 새 단계에서 사실 → 회복
    expect(b.flags.fin_trade_rep).toBe('reliable');
  });

  it('CASE B: 근거 선택지는 이 세이브가 확인한 S01 사실에서만 — 진실(시드)은 읽지 않는다', () => {
    const none = base({ s01_stage: 'investigating', s01_truth: 'T1' });
    expect(fxS01EvidenceOptions(none)).toHaveLength(0);
    const seal = base({ s01_stage: 'investigating', s01_truth: 'T1', s01_ev_seal: true });
    expect(fxS01EvidenceOptions(seal).map((c) => c.text)).toEqual(['"두 가드의 인장과 뒷면 품번을 직접 봤다"']);
    const both = base({ s01_stage: 'resolved', s01_truth: 'T3', s01_verdict: 'neither', s01_ev_seal: true, s01_ev_receipt: true });
    expect(fxS01EvidenceOptions(both)).toHaveLength(2);
    // 시드가 달라도 거래 노드는 같다
    const t1 = getInteraction('fin', base({ s01_stage: 'resolved', s01_truth: 'T1', s01_verdict: 'A', s01_ev_seal: true }));
    const t2 = getInteraction('fin', base({ s01_stage: 'resolved', s01_truth: 'T2', s01_verdict: 'A', s01_ev_seal: true }));
    for (const id of ['fx_b', 'fx_b2', 'fx_b_detailed']) expect(JSON.stringify(t1.nodes[id])).toBe(JSON.stringify(t2.nodes[id]));
    // 주석을 뺀 코드에서 숨은 진실·범인 관련 플래그를 읽지 않는다
    const code = (finSrc as string).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/s01_truth|hb_resolved|hb_seen_hands|hb_b_away/);
    // 흐름: 판가름 주장 → 근거(사실) → 평판 불변, 한 번뿐
    let s = pick(both, 'fx_b', '판가름했다').s;
    const d = pick(s, 'fx_b2', '인장과 뒷면');
    expect(d.next).toContain('구체적이군');
    s = d.s;
    expect(s.flags.fx_s01).toBe('detailed');
    expect(s.flags.fin_trade_rep).toBeUndefined();
    expect(texts(s, 'fx_b')).toEqual(['그만둔다']);
  });

  it('CASE C: 벽보 보고는 무난, 비방을 "다들 그러던데"로 팔면 의심 — 핀은 범인·조작을 단정하지 않는다', () => {
    const r = pick(base({ hb_stage: 'noticed' }), 'fx_c', '익명 벽보가 붙고');
    expect(r.s.flags.fx_hb).toBe('reported');
    expect(r.s.flags.fin_trade_rep).toBeUndefined();
    let s = pick(base({ hb_stage: 'noticed' }), 'fx_c', '벽보 내용을 그대로 옮긴다').s;
    expect(s.flags.fx_hb).toBeUndefined(); // 옮기기만 해서는 아직 아무것도 기록되지 않는다
    const labeled = pick(s, 'fx_c2', '쓰여 있었을 뿐');
    expect(labeled.s.flags.fx_hb).toBe('labeled');
    expect(labeled.s.flags.fin_trade_rep).toBeUndefined();
    s = pick(s, 'fx_c2', '다들 그러던데').s;
    expect(s.flags.fx_hb).toBe('smear_as_fact');
    expect(s.flags.fin_trade_rep).toBe('loose');
    expect(texts(s, 'fx_c')).toEqual(['그만둔다']);
    const all = Object.values(getInteraction('fin', s).nodes).map((n) => n.text).join('\n');
    expect(all).not.toMatch(/되팔이|사기가 맞|조작했/);
  });

  it('효과는 fx_*·fin_trade_rep 플래그뿐 — 금화·퀘스트·아이템·접근 불변, 새로고침 후 유지', () => {
    const st = base({ ...FAVOR_FOUND_EVIDENCE, hb_stage: 'noticed', s01_stage: 'resolved', s01_verdict: 'A', s01_ev_seal: true });
    const tree = getInteraction('fin', st);
    const effects = Object.entries(tree.nodes)
      .filter(([k]) => k.startsWith('fx_'))
      .flatMap(([, n]) => n.choices.flatMap((c) => c.effects ?? []));
    expect(effects.every((e) => e.type === 'SET_FLAG' && (e.key.startsWith('fx_') || e.key === 'fin_trade_rep'))).toBe(true);
    const after = pick(st, 'fx_a', '낙인을 짚어').s;
    expect(after.player.gold).toBe(st.player.gold);
    expect(after.quests).toEqual(st.quests);
    expect(after.inventory).toEqual(st.inventory);
    const r = importSave(JSON.stringify(after))!;
    expect(r.flags.fin_trade_rep).toBe('reliable');
    expect(texts(r, 'fx_a')).toEqual(['그만둔다']);
  });

  it('일지: 핀의 말은 주장으로, 언급한 사건 묶음에 붙는다', () => {
    let s = base({ ...FAVOR_FOUND_EVIDENCE, hb_stage: 'noticed' });
    s = { ...s, quests: { ...s.quests, q_grizzle_favor: { stage: 'found', completed: ['offered'] }, q_handbill: { stage: 'noticed', completed: [] } } };
    s = pick(s, 'fx_a', '낙인을 짚어').s;
    s = pick(s, 'fx_c', '익명 벽보가 붙고').s;
    const nb = getNotebook(s);
    const favor = nb.incidents.find((i) => i.id === 'favor')!;
    const hb = nb.incidents.find((i) => i.id === 'handbill')!;
    expect(favor.records.some((r) => r.kind === 'claim' && r.text.startsWith('핀:'))).toBe(true);
    expect(hb.records.some((r) => r.kind === 'claim' && r.text.includes('처음 듣는군'))).toBe(true);
    expect(nb.general.some((r) => r.text.startsWith('핀: "짐꾼'))).toBe(false);
  });

  it('구버전 v6: 거래 플래그 없음 → 사건을 알면 입구만 보이고, 불러오기로는 아무것도 변하지 않는다', () => {
    const legacy = JSON.parse(JSON.stringify(base({ gf_stage: 'returned', gf_method: 'evidence' })));
    const s = importSave(JSON.stringify(legacy))!;
    for (const k of FX_KEYS) expect(s.flags[k]).toBeUndefined();
    expect(texts(s, 'menu_root')).toContain('시장 소식을 판다');
  });

  it('F2 lint: 핀 루트의 마지막 선택지는 여전히 중립 종료', () => {
    const t = texts(base(FAVOR_FOUND_EVIDENCE), 'menu_root');
    expect(t[t.length - 1]).toBe('지나간다');
  });
});
