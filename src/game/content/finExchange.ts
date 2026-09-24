import type { DialogueChoice, DialogueNode, GameAction, GameState } from '../types';
import type { RecordKind } from './records';

/**
 * GM-P6 — 핀에게 시장 소식 팔기 (사기꾼들의 항구).
 *
 * 핀이 스스로 확인할 수 있는 것은 부두에서 드러나는 공개 결과뿐이다.
 *  - 그리즐의 상자(부탁): 북쪽 수레 짐꾼들이 부두 화물을 나른다 → 상자가 수레에 남았는지, 짐꾼이 어떻게 설득당했는지를 안다.
 *  - 진품 소동(S01) · 벽보: 부두로 이어 줄 사람이 없다 → 핀은 모른다(UNKNOWN). 구체성만 가늠할 뿐 진위는 판정하지 않는다.
 * 플레이어의 사적 근거를 묻는 선택지는 이 세이브가 실제로 발견한 사실(FACT) 플래그로만 만든다.
 * 숨은 진실(s01_truth, 벽보 범인)은 읽지 않는다. 핀의 말은 모두 주장(CLAIM)으로만 기록된다.
 *
 * 결과(fin_trade_rep)는 이 하위 메뉴의 인사말과 핀의 관계 기록 한 줄에만 쓰인다.
 * 기존 핀 대화·거래 비용·초대장·밤의 부두 퀘스트·금화·항구 접근은 바꾸지 않는다.
 */

const set = (key: string, value: boolean | number | string): GameAction => ({ type: 'SET_FLAG', key, value });
const FIN = '정보상 올드 핀';

type Rep = 'reliable' | 'loose';

function caseA(state: GameState) {
  const s = state.flags.gf_stage;
  return s === 'offered' || s === 'found' || s === 'returned';
}
function caseB(state: GameState) {
  const s = state.flags.s01_stage;
  return s === 'investigating' || s === 'deferred' || s === 'resolved';
}
function caseC(state: GameState) {
  return typeof state.flags.hb_stage === 'string';
}

export function fxEligible(state: GameState): boolean {
  return (state.npcs.fin?.meetCount ?? 0) > 0 && (caseA(state) || caseB(state) || caseC(state));
}

// ── CASE A: 그리즐의 상자 (핀이 짐꾼에게 들은 공개 결과로 확인) ──

type AClaim = 'a1' | 'a2' | 'a3';

/** 짐꾼이 목격한 사실과 주장이 맞는가 — 부탁 진행 단계와 짐꾼이 겪은 설득 방식만 쓴다 */
function porterMatches(state: GameState, claim: AClaim): boolean {
  const st = state.flags.gf_stage;
  const handed = st === 'found' || st === 'returned';
  const method = state.flags.gf_method;
  if (claim === 'a1') return handed && method === 'evidence';
  if (claim === 'a2') return handed && method === 'bluff';
  return st === 'offered';
}

function aChoices(state: GameState): DialogueChoice[] {
  const f = state.flags;
  if (f.fx_favor_at_stage === f.gf_stage) return [{ text: '그만둔다' }];
  const pick = (claim: AClaim, text: string): DialogueChoice => {
    const ok = porterMatches(state, claim);
    const effects: GameAction[] = [set('fx_favor', claim), set('fx_favor_at_stage', String(f.gf_stage)), set('fx_favor_ok', ok), set('fin_trade_rep', ok ? 'reliable' : 'loose')];
    return { text, next: ok ? 'fx_a_match' : 'fx_a_mismatch', effects };
  };
  const out: DialogueChoice[] = [];
  // 플레이어가 실제로 겪었거나 알게 된 방식만 말할 수 있다
  if (f.gf_method === 'evidence' || (f.gf_seen_stall === true && f.gf_seen_cart === true)) {
    out.push(pick('a1', '"낙인을 짚어 보여서 짐꾼한테 상자를 받아냈다"'));
  }
  if (f.gf_method === 'bluff' || typeof f.gf_refused_at === 'number') {
    out.push(pick('a2', '"그리즐 이름을 대서 짐꾼한테 상자를 받아냈다"'));
  }
  out.push(pick('a3', '"그 상자, 아직 수레에 있다"'));
  out.push({ text: '그만둔다' });
  return out;
}

// ── CASE B: 진품 소동 (핀은 확인 불가 — 구체성만) ──

function bClaimChoices(state: GameState): DialogueChoice[] {
  if (typeof state.flags.fx_s01 === 'string') return [{ text: '그만둔다' }];
  const out: DialogueChoice[] = [];
  if (typeof state.flags.s01_verdict === 'string') out.push({ text: '"중앙 장터 진품 소동, 내가 판가름했다"', next: 'fx_b2', effects: [set('fx_s01_claim', 'b1')] });
  out.push({ text: '"중앙 장터에서 진품 소동이 벌어지고 있다"', next: 'fx_b2', effects: [set('fx_s01_claim', 'b2')] });
  out.push({ text: '그만둔다' });
  return out;
}

/** 근거 질문의 답 — 이 세이브가 실제로 확인한 S01 사실에서만 만든다 */
export function fxS01EvidenceOptions(state: GameState): DialogueChoice[] {
  const f = state.flags;
  const out: DialogueChoice[] = [];
  if (f.s01_ev_seal === true) out.push({ text: '"두 가드의 인장과 뒷면 품번을 직접 봤다"', next: 'fx_b_detailed', effects: [set('fx_s01', 'detailed')] });
  if (f.s01_ev_receipt === true) out.push({ text: '"되팔이 상인의 영수증을 직접 봤다"', next: 'fx_b_detailed', effects: [set('fx_s01', 'detailed')] });
  return out;
}

function bEvidenceChoices(state: GameState): DialogueChoice[] {
  if (typeof state.flags.fx_s01 === 'string') return [{ text: '그만둔다' }];
  return [
    ...fxS01EvidenceOptions(state),
    { text: '"근거는 없다"', next: 'fx_b_honest', effects: [set('fx_s01', 'honest')] },
    { text: '"봤지, 확실히"', next: 'fx_b_vague', effects: [set('fx_s01', 'vague')] },
  ];
}

// ── CASE C: 벽보 (핀은 확인 불가 — 비방을 옮기는 방식만 가늠) ──

function cChoices(state: GameState): DialogueChoice[] {
  if (typeof state.flags.fx_hb === 'string') return [{ text: '그만둔다' }];
  return [
    { text: '"시장 게시판에 익명 벽보가 붙고 있다"', next: 'fx_c_reported', effects: [set('fx_hb', 'reported')] },
    { text: '벽보 내용을 그대로 옮긴다: "그리즐 상자 게임은 빈 상자 장사라더라"', next: 'fx_c2' },
    { text: '그만둔다' },
  ];
}

// ── 트리 조립 ──

function fxNodes(state: GameState): DialogueNode[] {
  const rep = state.flags.fin_trade_rep as Rep | undefined;
  const greet =
    rep === 'reliable' ? '"또 정확한 얘기 가져왔나? 앉아 봐."' : rep === 'loose' ? '"이번엔 진짜야? 지난번 건 영 아니던데."' : '"시장 소식? 쓸 만하면 들어 주지. 공짜로."';
  const menu: DialogueChoice[] = [];
  if (caseA(state)) menu.push({ text: '그리즐 좌판 상자 이야기를 한다', next: 'fx_a' });
  if (caseB(state)) menu.push({ text: '진품 소동 이야기를 한다', next: 'fx_b' });
  if (caseC(state)) menu.push({ text: '게시판 벽보 이야기를 한다', next: 'fx_c' });
  menu.push({ text: '그만둔다' });
  const f = state.flags;
  return [
    { id: 'fx_menu', speaker: FIN, text: greet, choices: menu },
    {
      id: 'fx_a',
      speaker: FIN,
      text: f.fx_favor_at_stage === f.gf_stage ? '"그 얘긴 이미 들었어. 짐꾼들한테도 확인했고."' : '"그리즐 좌판 상자? 짐꾼들 수레 얘기군. 그래서, 어떻게 됐는데?"',
      choices: aChoices(state),
    },
    { id: 'fx_a_match', speaker: FIN, text: '"짐꾼들한테 들은 거랑 딱 맞네." 핀이 고개를 끄덕인다. "정확한 얘기는 값이 나가지."', choices: [{ text: '고개를 끄덕인다' }] },
    { id: 'fx_a_mismatch', speaker: FIN, text: '"짐꾼들 얘기는 다르던데?" 핀이 금니를 드러내며 웃는다. "부두에선 그런 게 금방 들통나."', choices: [{ text: '물러난다' }] },
    {
      id: 'fx_b',
      speaker: FIN,
      text: typeof f.fx_s01 === 'string' ? '"그 얘긴 이미 들었어."' : '"진품 소동? 부두까지 온 얘기는 없어."',
      choices: bClaimChoices(state),
    },
    { id: 'fx_b2', speaker: FIN, text: '"그래서, 근거는?"', choices: bEvidenceChoices(state) },
    { id: 'fx_b_detailed', speaker: FIN, text: '"구체적이군." 핀이 턱을 쓰다듬는다. "믿을지는 내가 정하지. 확인할 길은 없으니까."', choices: [{ text: '고개를 끄덕인다' }] },
    { id: 'fx_b_honest', speaker: FIN, text: '"솔직하군. 그럼 그건 소문값이야."', choices: [{ text: '고개를 끄덕인다' }] },
    { id: 'fx_b_vague', speaker: FIN, text: '"그런 말은 공짜야. 부두엔 확실하다는 놈이 제일 많거든."', choices: [{ text: '물러난다' }] },
    {
      id: 'fx_c',
      speaker: FIN,
      text: typeof f.fx_hb === 'string' ? '"그 얘긴 이미 들었어."' : '"게시판 벽보? 시장 벽보 얘긴 부두까지 안 왔는데."',
      choices: cChoices(state),
    },
    { id: 'fx_c_reported', speaker: FIN, text: '"시장 벽보 얘긴 처음 듣는군. 누가 붙이는지는 모르고?" 핀은 더 묻지 않는다.', choices: [{ text: '고개를 끄덕인다' }] },
    {
      id: 'fx_c2',
      speaker: FIN,
      text: '"오? 어느 상자에서, 어떻게 속였는데?"',
      choices: [
        { text: '"벽보에 그렇게 쓰여 있었을 뿐이다"', next: 'fx_c_labeled', effects: [set('fx_hb', 'labeled')] },
        { text: '"다들 그러던데"', next: 'fx_c_smear', effects: [set('fx_hb', 'smear_as_fact'), set('fin_trade_rep', 'loose')] },
      ],
    },
    { id: 'fx_c_labeled', speaker: FIN, text: '"익명 벽보를 사실인 양 팔면 안 돼. 그렇게 말해 주니 됐어."', choices: [{ text: '고개를 끄덕인다' }] },
    { id: 'fx_c_smear', speaker: FIN, text: '"다들 그런다는 건 근거가 아니야." 핀이 좌대를 두드린다. "그런 걸 파는 놈은 다음에도 그런 걸 팔지."', choices: [{ text: '물러난다' }] },
  ];
}

/** 핀 대화에 '시장 소식을 판다'를 끼워 넣는다 — 만난 뒤의 루트(menu_root)에서, 기존 종료 선택지 앞에만 */
export function fxAugmentFin<T extends { entry: string; nodes: Record<string, DialogueNode> }>(state: GameState, tree: T): T {
  if (!fxEligible(state) || tree.entry !== 'menu_root') return tree;
  const root = tree.nodes.menu_root;
  const choices = [...root.choices];
  choices.splice(Math.max(0, choices.length - 1), 0, { text: '시장 소식을 판다', next: 'fx_menu' });
  const nodes: Record<string, DialogueNode> = { ...tree.nodes, menu_root: { ...root, choices } };
  for (const n of fxNodes(state)) if (!nodes[n.id]) nodes[n.id] = n;
  return { ...tree, nodes };
}

// ── 일지 (해당 사건 묶음에 표시) ──

export function fxRecords(state: GameState): { kind: RecordKind; text: string; scope: 's01' | 'favor' | 'handbill' }[] {
  const f = state.flags;
  const out: { kind: RecordKind; text: string; scope: 's01' | 'favor' | 'handbill' }[] = [];
  if (typeof f.fx_favor === 'string') {
    out.push({ kind: 'claim', scope: 'favor', text: f.fx_favor_ok === true ? '핀: "짐꾼들한테 들은 거랑 딱 맞네."' : '핀: "짐꾼들 얘기는 다르던데."' });
  }
  if (typeof f.fx_s01 === 'string') out.push({ kind: 'claim', scope: 's01', text: '핀: "진품 소동 얘기는 부두까지 오지 않았다."' });
  if (f.fx_hb === 'reported') out.push({ kind: 'claim', scope: 'handbill', text: '핀: "시장 벽보 얘긴 처음 듣는군."' });
  if (f.fx_hb === 'labeled') out.push({ kind: 'claim', scope: 'handbill', text: '핀: "익명 벽보를 사실인 양 팔면 안 돼."' });
  if (f.fx_hb === 'smear_as_fact') out.push({ kind: 'claim', scope: 'handbill', text: '핀: "다들 그런다는 건 근거가 아니야."' });
  return out;
}
