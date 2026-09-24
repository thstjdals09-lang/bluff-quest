import type { DialogueChoice, DialogueNode, FlagValue, GameAction, GameState } from '../types';
import type { RecordKind } from './records';

/**
 * STORY-S2 EP1 '달 없는 밤' (H2–H5) — 티티 감수본 기준.
 * H2 핀에게 출발을 말한다 → H3 초대장 홀의 자리 주장 심리전 → H4 레오 / H5 하멜 → 카지노 서고 참조.
 *
 * 원칙
 * - 판정은 결정론: 무엇을 보여 줬는지·어떻게 말했는지·무엇을 물었는지로만 정한다(난수 없음).
 * - 판정 대상은 '현장 주장과 증거의 일치'이지 17번의 원래 주인·위조 여부가 아니다.
 * - 비밀(17번 원래 주인, 초대장을 둔 사람, 하멜의 옛 이름, 레오 형의 정체)은 어떤 기록·목표문에도 넣지 않는다.
 * - 추정(INFERENCE)은 플레이어가 고른 경우에만 남는다.
 * - 모든 상태는 플래그뿐 (v6 스키마 그대로).
 */

interface Tree {
  entry: string;
  nodes: Record<string, DialogueNode>;
}

const f = (s: GameState, k: string): FlagValue | undefined => s.flags[k];
const on = (s: GameState, k: string) => s.flags[k] === true;
const set = (key: string, value: FlagValue = true): GameAction => ({ type: 'SET_FLAG', key, value });
const node = (id: string, speaker: string, text: string, choices: DialogueChoice[]): DialogueNode => ({ id, speaker, text, choices });
const fx = (...a: (GameAction | null | false | undefined)[]): GameAction[] => a.filter(Boolean) as GameAction[];

// ── 퀘스트 단계 (되돌아가지 않는다) ──
const STAGE_RANK: Record<string, number> = { ready: 0, hall: 1, outside: 2, admitted: 3, done: 4 };
function stageTo(state: GameState, stage: string): GameAction | null {
  const cur = state.quests.q_moonless?.stage;
  if (cur !== undefined && (STAGE_RANK[cur] ?? -1) >= STAGE_RANK[stage]) return null;
  return { type: 'SET_QUEST_STAGE', questId: 'q_moonless', stage };
}
/** 카지노 서고 참조를 얻었다 — EP1의 완료 조건 (사람을 고르지 않아도 게시대·일지로 얻을 수 있다) */
function casinoRef(state: GameState, src: 'history' | 'notice' | 'log'): GameAction[] {
  return fx(set('ep1_casino_ref'), f(state, 'ep1_ref_src') === undefined && set('ep1_ref_src', src), stageTo(state, 'done'));
}

/** 밤의 부두 이야기가 끝난 세이브에 '달 없는 밤'을 연다 (장소 전환·핀의 정보 거래 때만 — 불러오기로는 움직이지 않음) */
export function moonlessReadyEffect(state: GameState): GameAction | null {
  if (state.quests.q_night_pier?.stage !== 'done' || state.quests.q_moonless) return null;
  return { type: 'SET_QUEST_STAGE', questId: 'q_moonless', stage: 'ready' };
}

const ADMITTED = ['evidence', 'bluff', 'witness'];
export function isAdmitted(state: GameState): boolean {
  return ADMITTED.includes(String(f(state, 'h3_outcome')));
}
const rumored = (s: GameState) => on(s, 'invitation_shown') || on(s, 'invitation_confirmed_to_fin');

// ════════════════════════════════════════════════════════════
// H2 — 핀: 직접 결심 (D8)
// ════════════════════════════════════════════════════════════

/** 핀의 기존 트리에 H2 선택지·노드를 더한다 (핀의 거래·정보 비용은 그대로) */
export function moonlessAugmentFin(state: GameState, t: Tree): Tree {
  const root = t.nodes.menu_root;
  if (!root || state.quests.q_night_pier?.stage !== 'done') return t;
  const at = Math.max(0, root.choices.length - 1); // '지나간다' 앞
  const nodes = { ...t.nodes };
  if (on(state, 'ep1_departed')) {
    const choices = [...root.choices];
    choices.splice(at, 0, { text: '부두 끝으로 간다', effects: [{ type: 'GOTO_LOCATION', locationId: 'night_pier_end', x: 3, y: 4 }] });
    nodes.menu_root = { ...root, choices };
    return { ...t, nodes };
  }
  const choices = [...root.choices];
  choices.splice(at, 0, { text: '밤의 부두 얘기를 꺼낸다', next: 'h2_ready', effects: fx(moonlessReadyEffect(state)) });
  nodes.menu_root = { ...root, choices };

  const pre = on(state, 'fin_bluff_called') ? '"내 넘겨짚기를 받아친 솜씨면, 거기서도 입은 다물 줄 알겠지."\n\n' : '';
  const post = rumored(state)
    ? '\n\n"아, 그리고… 네가 이름 없는 종이를 들고 다닌다는 얘기, 벌써 부두에 돌았어. 내가 판 소문이니 할 말은 없다만."'
    : '';
  const readyChoices = (): DialogueChoice[] => [
    {
      text: '"준비됐어. 밤의 부두로 가겠어."',
      next: 'h2_go',
    },
    ...(on(state, 'h2_asked') ? [] : [{ text: '"거기선 무슨 판이 벌어지지?"', next: 'h2_ask', effects: [set('h2_asked')] }]),
    { text: '"아직 확인할 일이 있어."', next: 'h2_later' },
  ];
  nodes.h2_ready = node(
    'h2_ready',
    '정보상 올드 핀',
    `${pre}"아직도 그 종이를 갖고 있나? 그럼 선택할 시간이지." 핀이 부두 끝, 불 꺼진 창고 쪽을 턱짓한다. "오늘은 달이 없어. 부두 끝에서 이름을 묻거든, 네 이름이 아니라 네가 앉을 자리를 대답해."${post}`,
    readyChoices(),
  );
  nodes.h2_ask = node(
    'h2_ask',
    '정보상 올드 핀',
    '"나도 안에서 본 적은 없어. 들은 건 이거야 — 종이를 든 놈들끼리 누가 자리에 앉을지를 따진다더군. 카드는 안 돌린대. 말이 돌지."\n\n핀이 어깨를 으쓱한다. "소문은 싸. 확인은 비싸지."',
    readyChoices().filter((c) => c.next !== 'h2_ask'),
  );
  nodes.h2_later = node('h2_later', '정보상 올드 핀', '"그래, 종이는 도망 안 가. 마음 정하면 와."', [{ text: '고개를 끄덕인다' }]);
  nodes.h2_go = node('h2_go', '정보상 올드 핀', '"난 거기까지 안 가. 뭘 봤다고 나중에 증언하라는 소린 하지 마." 핀이 등불 심지를 낮춘다.', [
    {
      text: '부두 끝으로 걷는다',
      event: 'moonless_night',
      effects: fx(
        moonlessReadyEffect(state),
        set('ep1_departed'),
        { type: 'SET_QUEST_STAGE', questId: 'q_moonless', stage: 'hall' },
        { type: 'GOTO_LOCATION', locationId: 'night_pier_end', x: 3, y: 4 },
      ),
    },
  ]);
  return { ...t, nodes };
}

// ════════════════════════════════════════════════════════════
// H3 — 초대장 홀 (D9)
// ════════════════════════════════════════════════════════════

type Card = 'own' | 'ledger' | 'edge' | 'receipt' | 'fin';
const SITE_FACTS: Card[] = ['ledger', 'edge', 'receipt'];

function cardLabel(state: GameState, c: Card): string {
  switch (c) {
    case 'own':
      return '[사실] 내 초대장 — 이름 칸이 없다';
    case 'ledger':
      return '[사실] 장부 17번 — 시장 경유 · 미발송 · 서명 공란';
    case 'edge':
      return '[사실] 바늘의 종이 — 날짜가 지워져 있다';
    case 'receipt':
      return on(state, 'b_consent') ? '[사실] 물결의 인수증 — 16번 (물결이 허락한 만큼)' : '[사실] 물결의 인수증 — 16번, 맡긴 사람 이름 없음';
    case 'fin':
      return '[주장] 핀의 말 — 자리는 초대장 수만큼';
  }
}
function availableCards(state: GameState): Card[] {
  const out: Card[] = ['own'];
  if (on(state, 'h3_f_ledger')) out.push('ledger');
  if (on(state, 'h3_f_edge')) out.push('edge');
  if (on(state, 'h3_f_receipt')) out.push('receipt');
  if (on(state, 'night_pier_hint')) out.push('fin');
  return out;
}
/** 패를 내는 효과 — 허락 없이 인수증을 까면 물결은 증인이 되어 주지 않는다 */
function revealEffects(state: GameState, slot: 't_p1' | 't_p2', c: Card): GameAction[] {
  return fx(set(slot, c), c === 'receipt' && !on(state, 'b_consent') && set('b_exposed'));
}
function reaction(state: GameState, c: Card): string {
  switch (c) {
    case 'own':
      return '네가 초대장을 들어 이름 칸을 보인다. 바늘이 코웃음 친다. "이름 없는 종이라. 그럼 누구 거든 될 수 있겠네."';
    case 'ledger':
      return '문지기가 장부의 17번 줄에 손가락을 올린다. 바늘이 인상을 쓴다. "시장 경유? 그게 무슨 상관이야."';
    case 'edge':
      return '네가 바늘의 종이 모서리를 가리킨다. 날짜가 긁힌 자리. 바늘의 턱에 힘이 들어간다.';
    case 'receipt':
      return on(state, 'b_consent')
        ? '물결이 고개를 끄덕인다. "16번이라는 것까지만. 약속대로네."'
        : '물결이 벌떡 일어선다. "그걸 왜 네가 까? 내 인수증이야."';
    case 'fin':
      return '문지기가 어깨를 으쓱한다. "핀의 말은 핀의 말이지."';
  }
}

type Question = 'edge' | 'ledger' | 'fin' | 'accuse';
type Result = 'evidence' | 'bluff' | 'fail_bluff' | 'fail_weak' | 'fail_nofact';

/** 판정 — 결정론. 근거 있는 질문 = 현장에서 본 구체 모순(날짜·장부)을 상대 앞에서 짚는 것 */
export function judgeTable(p1: string, p2: string, stance: string, q: Question): Result {
  const grounded = q === 'edge' || q === 'ledger';
  const siteFact = [p1, p2].some((c) => SITE_FACTS.includes(c as Card));
  if (stance === 'bluff') return grounded ? 'bluff' : 'fail_bluff';
  if (!grounded) return 'fail_weak';
  return siteFact ? 'evidence' : 'fail_nofact';
}

function questionEffects(state: GameState, q: Question): GameAction[] {
  const p1 = String(f(state, 't_p1') ?? '');
  const p2 = String(f(state, 't_p2') ?? '');
  const r = judgeTable(p1, p2, String(f(state, 't_stance') ?? ''), q);
  const out: GameAction[] = [set('t_q', q), set('t_res', r)];
  if (r === 'evidence' || r === 'bluff') {
    out.push(set('h3_outcome', r));
    const st = stageTo(state, 'admitted');
    if (st) out.push(st);
    for (const c of [p1, p2]) if (c) out.push(set(`h3_rev_${c}`));
    const linked = r === 'evidence' && [p1, p2].includes('ledger') && ([p1, p2].includes('own') || on(state, 'h3_i_seat17'));
    if (linked) out.push(set('h3_link'));
  } else {
    out.push(set('h3_fails', Number(f(state, 'h3_fails') ?? 0) + 1));
  }
  return out;
}

const TABLE_RESET: GameAction[] = [set('t_p1', ''), set('t_p2', ''), set('t_stance', ''), set('t_q', ''), set('t_res', '')];

function ledgerNode(id: string): DialogueNode {
  return node(
    id,
    '',
    '펼쳐진 장부. 빈 자리는 두 줄뿐이다.\n\n16 — 대리 수령 가능. 원 소지자 서명 있음(번져서 읽을 수 없음).\n17 — 고블린 시장 경유 · 미발송 보관. 명부 서명 공란. 원본 소지자 미상.\n\n나머지 줄에는 이름과 서명이 빽빽하다.',
    [
      { text: '"…내 종이가 17번일 수도 있겠군."', effects: [set('h3_f_ledger'), set('h3_i_seat17')] },
      { text: '장부를 덮는다', effects: [set('h3_f_ledger')] },
    ],
  );
}

function usherTree(state: GameState): Tree {
  const nodes: Record<string, DialogueNode> = {};
  const admitted = isAdmitted(state);
  const outcome = String(f(state, 'h3_outcome') ?? '');

  const hub = (): DialogueChoice[] => {
    const c: DialogueChoice[] = [{ text: '규칙을 다시 듣는다', next: 'rules', effects: [set('h3_rules_heard')] }];
    c.push({ text: '"장부를 봐도 될까?"', next: 'ledger' });
    if (on(state, 'night_pier_hint')) c.push({ text: '"핀은 자리가 초대장 수만큼이라던데?"', next: 'fin', effects: [set('h3_fin_asked')] });
    if (!admitted) {
      if (!on(state, 'h3_witness_rule')) c.push({ text: '"공동 증언은 어떻게 받지?"', next: 'witness_rule', effects: [set('h3_witness_rule')] });
      else {
        const ok = on(state, 'b_goodwill') && !on(state, 'b_exposed');
        c.push({
          text: '물결에게 증인을 부탁한다',
          next: ok ? 'witness_ok' : 'witness_no',
          effects: ok ? fx(set('h3_outcome', 'witness'), stageTo(state, 'admitted')) : [],
        });
      }
      c.push({ text: '"판을 청하겠다."', next: 't_open', effects: TABLE_RESET });
    }
    c.push({ text: '물러난다' });
    // 한 화면 5개 이하 — 규칙 다시 듣기는 규칙을 이미 들었으면 뒤로 뺀다
    return c.length > 5 ? c.filter((x) => x.next !== 'rules') : c;
  };

  if (!on(state, 'h3_seen_intro')) {
    nodes.root = node('root', '문지기', '"종이." 문지기가 손을 내민다.\n\n접수대 위에 두꺼운 장부가 펼쳐져 있다. 벽 쪽 긴 의자에 세 사람이 서로 눈을 피한 채 앉아 있다.', [
      { text: '초대장을 내민다', next: 'hand', effects: [set('h3_seen_intro')] },
      { text: '"먼저 규칙부터 듣고 싶어."', next: 'rules', effects: [set('h3_seen_intro'), set('h3_rules_heard')] },
    ]);
  } else {
    const greet =
      outcome === 'evidence'
        ? `"잠정 조사 입장. 네 줄은 적어 뒀어.${on(state, 'h3_link') ? ' 17번 접수 건은 확인 중이고.' : ''} 좌석방은 저 문이야."`
        : outcome === 'bluff'
          ? '"잠정 입장. 네 말 중 반은 장부에 안 적었다. 잊지 마. 좌석방은 저 문이야."'
          : outcome === 'witness'
            ? '"증인석은 좌석방 문 옆이야. 판엔 안 앉아도 방엔 들어가."'
            : outcome === 'withdrew'
              ? '"나가는 문은 늘 열려 있었지. 다시 두드린 건가?"'
              : Number(f(state, 'h3_fails') ?? 0) > 0
                ? '"더 보고 왔나?"'
                : '"또 너군. 판을 청할 거야, 아니면 더 볼 거야?"';
    nodes.root = node('root', '문지기', greet, hub());
  }
  nodes.hand = node(
    'hand',
    '문지기',
    '문지기가 초대장을 불빛에 비춰 보고 장부를 몇 장 넘긴다. "…이름 칸이 없군. 요즘 그런 게 많아."\n\n그가 종이를 돌려준다. "서류는 세 장인데 자리는 둘이었지. 이제 네 장이 됐군."\n\n긴 의자의 세 사람이 동시에 너를 본다.',
    [{ text: '"규칙이 뭐지?"', next: 'rules', effects: [set('h3_rules_heard')] }],
  );
  nodes.rules = node(
    'rules',
    '문지기',
    '"규칙은 하나야. 본 걸 말해. 들은 걸 봤다고 하지는 말고." 그가 장부를 톡톡 친다. "남은 자리는 열여섯, 열일곱. 누가 누구 말을 믿는지는 당신들 몫이지. 난 종이를 살핀다.\n\n판을 청하면 그때 따져 보자고. 본 것 하나를 대고, 남의 말 하나를 제대로 따져 보는 사람한테 오늘 밤 잠정 자리를 주지. 소유권? 그건 내 일이 아냐."',
    [{ text: '알겠다', next: 'menu' }],
  );
  nodes.menu = node('menu', '문지기', '"뭘 할 거지?"', hub());
  nodes.ledger = ledgerNode('ledger');
  nodes.fin = node('fin', '문지기', '"핀? 부두 끝까지 와 본 적도 없는 녀석이지. 오늘 밤엔 종이가 자리보다 많아. 그게 다야."', [{ text: '알겠다', next: 'menu' }]);
  nodes.witness_rule = node(
    'witness_rule',
    '문지기',
    '"다른 종이 주인이 네 말이 맞다고 같이 서 주면 돼. 대신 그 사람 자리를 네가 뺏는 게 아니라면. 증인은 판엔 못 앉아도 방엔 들어와."',
    [{ text: '알겠다', next: 'menu' }],
  );
  nodes.witness_ok = node(
    'witness_ok',
    '물결 · 문지기',
    '물결이 머뭇거리다 일어선다. "이 사람은 종이 하나 들고 왔고, 누구 자리도 뺏겠단 말 안 했어. 내가 봤어."\n\n문지기가 장부에 짧게 적는다. "그럼 증인석. 판엔 안 앉지만 방엔 들어와."',
    [{ text: '고개를 끄덕인다' }],
  );
  nodes.witness_no = node(
    'witness_no',
    '물결',
    on(state, 'b_exposed') ? '물결이 고개를 돌린다. "판에서 내 인수증을 까 놓고? 내가 왜."' : '물결이 어깨를 움츠린다. "내가 왜? …미안, 난 내 심부름만 할래."',
    [{ text: '물러난다' }],
  );

  // ── 판 (H3-1) ──
  const p1 = String(f(state, 't_p1') ?? '') as Card | '';
  const p2 = String(f(state, 't_p2') ?? '') as Card | '';
  const cards = availableCards(state);
  const opener =
    '"좋아, 판을 열지." 세 사람이 접수대 앞으로 모인다. 바늘이 먼저 입을 연다. "17번은 내 거야."' +
    (rumored(state) ? '\n\n바늘이 덧붙인다. "어차피 이름 없는 종이라는 건 다 알아."' : '') +
    '\n\n문지기가 너를 본다. "네 차례. 무엇을 보여 줄지 골라."';
  nodes.t_open = node('t_open', '문지기', opener, [
    ...cards.map((c): DialogueChoice => ({ text: cardLabel(state, c), next: 't_r1', effects: revealEffects(state, 't_p1', c) })),
    { text: '아무것도 보여 주지 않는다', next: 't_stance' },
  ]);
  nodes.t_r1 = node('t_r1', '', `${p1 ? reaction(state, p1) : ''}\n\n"하나 더 보여 줄까?"`, [
    ...cards.filter((c) => c !== p1).map((c): DialogueChoice => ({ text: cardLabel(state, c), next: 't_r2', effects: revealEffects(state, 't_p2', c) })),
    { text: '이걸로 충분하다', next: 't_stance' },
  ]);
  nodes.t_r2 = node('t_r2', '', p2 ? reaction(state, p2) : '', [{ text: '계속한다', next: 't_stance' }]);
  nodes.t_stance = node('t_stance', '문지기', '"어떻게 말할 거지?" 문지기가 기다린다.', [
    { text: '"본 것만 말할게."', next: 't_chal', effects: [set('t_stance', 'fact')] },
    { text: '"원래 주인이 누군지는 나도 몰라. 그래도 이 종이는 여기 있어."', next: 't_chal', effects: [set('t_stance', 'unsure')] },
    { text: '"이 자리 주인은 날 기다리고 있어."', next: 't_chal', effects: [set('t_stance', 'bluff')] },
    { text: '지금은 말하지 않는다', next: 't_hold' },
    {
      text: '판을 접는다',
      next: 't_withdraw',
      effects: admitted ? [] : fx(set('h3_outcome', 'withdrew'), stageTo(state, 'outside')),
    },
  ]);
  nodes.t_hold = node('t_hold', '문지기', '"준비되면 다시 청해." 세 사람이 다시 긴 의자로 흩어진다.', [{ text: '물러난다' }]);
  nodes.t_withdraw = node('t_withdraw', '문지기', '"나가는 문은 늘 열려 있어. 들어오는 문은… 다시 두드려 봐." 문지기가 장부를 덮는다.', [{ text: '물러난다' }]);
  const bluffing = f(state, 't_stance') === 'bluff';
  const qs: DialogueChoice[] = [];
  if (on(state, 'h3_f_edge')) qs.push({ text: '"아무도. 그러니까 날짜부터 맞춰 보자. 네 종이 날짜는 왜 지워졌지?"', next: 't_res', effects: questionEffects(state, 'edge') });
  if (on(state, 'h3_f_ledger')) qs.push({ text: '"장부엔 17번이 \'시장 경유 미발송\'이라던데, 넌 그걸 어디서 받았지?"', next: 't_res', effects: questionEffects(state, 'ledger') });
  if (on(state, 'night_pier_hint')) qs.push({ text: '"핀은 자리가 초대장 수만큼이라던데?"', next: 't_res', effects: questionEffects(state, 'fin') });
  qs.push({ text: '"넌 거짓말을 하고 있어."', next: 't_res', effects: questionEffects(state, 'accuse') });
  nodes.t_chal = node(
    't_chal',
    '바늘',
    bluffing ? '"기다린다고? 누가? 이름도 없는 종이 주인이?" 바늘이 팔짱을 낀다. "좋아, 그럼 네가 물어봐. 뭘 따질 건데?"' : '"글쎄. 네 종이가 내 것보다 먼저 찍혔다고 누가 보증해?"',
    qs,
  );

  const res = String(f(state, 't_res') ?? '');
  const q = String(f(state, 't_q') ?? '');
  const concede = q === 'edge' ? '바늘이 입술을 깨문다. "…날짜는 내가 지운 거 아냐."' : '바늘이 머뭇거린다. "…어디서 받았는지는, 말 못 해."';
  let resText = '';
  if (res === 'evidence') {
    resText = `${concede}\n\n문지기가 장부에 적는다. "둘 다 확실하지 않다는 건 분명해졌군. 잠정 조사 입장이다. 누구 자리인지는 안 쓴다.${on(state, 'h3_link') ? ' 17번 접수 건은 잠정 확인 중이고.' : ''}"`;
  } else if (res === 'bluff') {
    resText = `${concede}\n\n갈매기가 킥킥 웃는다. "기다린다는 그 주인, 나중에 소개해 줘."\n\n문지기 "…잠정으로. 모순은 네가 짚었으니까. 대신 기다린다는 주인 얘긴 들은 걸로 치지 않겠어. 네 말 반은 장부에 안 적는다."`;
  } else if (res === 'fail_bluff') {
    resText = '바늘이 웃음을 터뜨린다. "기다린다고? 이름도 없는 종이 주인이 누굴 기다려."\n\n문지기가 고개를 젓는다. "모순이군. 오늘은 아니야. 더 보고 와."';
  } else if (res === 'fail_weak') {
    resText = '문지기가 한숨을 쉰다. "말은 많은데, 본 게 없군. 더 보고 와서 다시 청해."';
  } else if (res === 'fail_nofact') {
    resText = '"질문은 좋아." 문지기가 장부를 톡톡 친다. "근데 네가 여기서 본 건 하나도 안 댔어. 네 종이에 이름이 없다는 건 이미 알아. 여기서 본 걸 대고 다시 청해."';
  }
  nodes.t_res = node('t_res', '문지기', resText, [{ text: res === 'evidence' || res === 'bluff' ? '고개를 끄덕인다' : '물러난다' }]);
  return { entry: 'root', nodes };
}

function seatATree(state: GameState): Tree {
  const nodes: Record<string, DialogueNode> = {};
  const first = !on(state, 'h3_c_a');
  const text = first
    ? '"늦게 온 사람이 제일 시끄럽지. 난 17번 서류를 먼저 받았어. 먼저 받은 사람이 앉는 게 순서 아닌가?"'
    : isAdmitted(state) && f(state, 'h3_outcome') !== 'witness'
      ? '"두고 보자. 종이는 도망 안 가."'
      : Number(f(state, 'h3_fails') ?? 0) > 0
        ? '"또 왔네. 이번엔 뭘 보고 왔는데?"'
        : '바늘이 종이를 무릎에 누른 채 너를 본다.';
  const c: DialogueChoice[] = [];
  if (!on(state, 'h3_f_edge')) c.push({ text: '"그 종이, 좀 볼 수 있을까?"', next: 'show', effects: [set('h3_c_a'), set('h3_f_edge')] });
  if (!on(state, 'h3_c_a_src')) c.push({ text: '"누구한테 받았는데?"', next: 'src', effects: [set('h3_c_a'), set('h3_c_a_src')] });
  if (rumored(state) && !on(state, 'h3_rumor')) c.push({ text: '"내 얘길 벌써 들었나 보네."', next: 'rumor', effects: [set('h3_c_a'), set('h3_rumor')] });
  c.push({ text: '물러난다', effects: [set('h3_c_a')] });
  nodes.root = node('root', '바늘', text, c);
  nodes.show = node(
    'show',
    '바늘',
    '바늘이 잠시 망설이다 종이 모서리만 내민다. "모서리만. 나머진 판에서."\n\n모서리의 절취선 무늬가 접수대 서식과 같아 보인다. 그 옆, 발행 날짜가 찍혀 있어야 할 자리가 긁혀 지워져 있다.',
    [{ text: '기억해 둔다' }],
  );
  nodes.src = node('src', '바늘', '"그걸 왜 너한테 말해? …부두에서 산 건 아니야. 그 정도만."', [{ text: '물러난다' }]);
  nodes.rumor = node('rumor', '바늘', '"시장에서 온 이름 없는 종이. 핀이 여기저기 팔고 다니더군. 그러니까 넌 이미 패 하나를 깐 셈이야."', [{ text: '물러난다' }]);
  return { entry: 'root', nodes };
}

function seatBTree(state: GameState): Tree {
  const nodes: Record<string, DialogueNode> = {};
  const first = !on(state, 'h3_c_b');
  const text = on(state, 'b_exposed')
    ? '물결이 너를 보자 고개를 돌린다.'
    : first
      ? '"난 싸우러 온 거 아니야. 누가 이 종이를 맡아 달라고 했어. 자리 좀 잡아 두라고. 주인이라고는 안 했어, 난."'
      : '물결이 구겨진 인수증을 만지작거린다.';
  const c: DialogueChoice[] = [];
  if (!on(state, 'b_exposed')) {
    if (!on(state, 'h3_f_receipt'))
      c.push({ text: '"인수증을 보여 줄 수 있어?"', next: 'receipt', effects: [set('h3_c_b'), set('h3_f_receipt'), set('b_goodwill')] });
    if (!on(state, 'h3_c_b_who')) c.push({ text: '"맡긴 사람이 누군데?"', next: 'who', effects: [set('h3_c_b'), set('h3_c_b_who')] });
    if (on(state, 'h3_f_ledger') && !on(state, 'b_16'))
      c.push({ text: '"그럼 네 자리는 16번이겠네."', next: 'b16', effects: [set('h3_c_b'), set('b_16'), set('b_goodwill')] });
    if (on(state, 'h3_f_receipt') && !on(state, 'b_consent'))
      c.push({ text: '"판에서 인수증 얘기를 해도 될까?"', next: 'consent', effects: [set('h3_c_b'), set('b_consent')] });
  }
  c.push({ text: '물러난다', effects: [set('h3_c_b')] });
  nodes.root = node('root', '물결', text, c);
  nodes.receipt = node(
    'receipt',
    '물결',
    '"보여 줘도 돼. 어차피 이름은 없거든."\n\n인수증에는 \'종이 한 장 · 16번 · 대리 보관\'과 날짜뿐이다. 맡긴 사람의 이름 칸은 비어 있다.',
    [{ text: '기억해 둔다' }],
  );
  nodes.who = node('who', '물결', '"몰라. 돈 받고 심부름한 거야. 모자를 눌러쓴 사람이었어… 그게 다야."', [{ text: '물러난다' }]);
  nodes.b16 = node('b16', '물결', '"그렇겠지? 장부에 대리 수령 가능이라고 돼 있다며. …고마워, 그렇게 말해 줘서."', [{ text: '물러난다' }]);
  nodes.consent = node('consent', '물결', '물결이 인수증을 접었다 편다. "…16번이라는 것까지만. 맡긴 사람 얘긴 빼. 나도 모르니까."', [{ text: '약속한다' }]);
  return { entry: 'root', nodes };
}

function seatCTree(state: GameState): Tree {
  const nodes: Record<string, DialogueNode> = {};
  const first = !on(state, 'h3_c_c');
  const text = first ? '"내 종이를 보여 주면 네가 먼저 훔칠 거잖아. 번호도 안 알려 줘."' : on(state, 'c_rapport') ? '"또 왔어? 여전히 안 보여 줄 거야. 너도 그렇지?"' : '갈매기가 품속의 종이를 누른 채 곁눈질한다.';
  const c: DialogueChoice[] = [];
  if (!on(state, 'c_rapport')) c.push({ text: '"나도 안 보여 줄게. 공평하지?"', next: 'fair', effects: [set('h3_c_c'), set('c_rapport')] });
  if (!on(state, 'h3_c_c_why')) c.push({ text: '"왜 번호를 숨기지?"', next: 'why', effects: [set('h3_c_c'), set('h3_c_c_why')] });
  if (state.inventory.includes('old_spade_card') && !on(state, 'h3_card_shown'))
    c.push({ text: '낡은 스페이드 카드를 보여 준다', next: 'card', effects: [set('h3_c_c'), set('h3_card_shown')] });
  c.push({ text: '물러난다', effects: [set('h3_c_c')] });
  nodes.root = node('root', '갈매기', text, c);
  nodes.fair = node('fair', '갈매기', '"…말이 통하네."', [{ text: '물러난다' }]);
  nodes.why = node('why', '갈매기', '"여기선 번호가 곧 표적이거든. 너도 곧 알게 될 거야."', [{ text: '물러난다' }]);
  nodes.card = node(
    'card',
    '갈매기',
    '갈매기의 눈이 카드 뒷면에 오래 멎는다.\n\n"\'이 카드를 보여주는 사람을 믿지 마라\'… 재밌는 글씨네. 여기 사람들한테 딱 맞는 말이야." 입꼬리가 올라간다. "근데 그걸 보여 주는 너는?"',
    [{ text: '카드를 거둔다' }],
  );
  return { entry: 'root', nodes };
}

function seatsDoorTree(state: GameState): Tree {
  const nodes: Record<string, DialogueNode> = {};
  const outcome = String(f(state, 'h3_outcome') ?? '');
  if (!isAdmitted(state)) {
    nodes.root = node('root', '좌석방 문', '문 안쪽에서 의자 끄는 소리가 난다. 문지기가 고개를 젓는다. "잠정 자리라도 받고 와."', [{ text: '물러난다' }]);
    return { entry: 'root', nodes };
  }
  const tag =
    outcome === 'witness'
      ? '문 옆 증인석 의자에 \'증인\' 딱지가 붙어 있다. 좌석판의 자리들과는 따로다.'
      : outcome === 'bluff'
        ? '출입 명단 끝에 네 줄이 하나 생겼다. \'잠정 입장 — 기록 일부 보류\'.'
        : on(state, 'h3_link')
          ? '출입 명단 끝에 네 줄이 하나 생겼다. \'잠정 조사 입장\'. 17번 줄 옆에는 \'접수 관련 — 잠정 확인 중\'이라는 작은 표시.'
          : '출입 명단 끝에 네 줄이 하나 생겼다. \'잠정 조사 입장\'.';
  const board = `벽의 좌석판. 1번부터 17번까지, 대부분 이름패가 끼워져 있다. 17번 칸에는 이름패가 없다.\n\n${tag} 네 이름은 어디에도 없다.`;
  const c: DialogueChoice[] = [];
  if (outcome === 'bluff') c.push({ text: '좌석 이력부를 청한다', next: 'blocked', effects: [set('seats_seen')] });
  else c.push({ text: '좌석 이력부를 본다', next: 'history', effects: fx(set('seats_seen'), set('h3_f_history'), ...casinoRef(state, 'history')) });
  c.push({ text: '나온다', effects: [set('seats_seen')] });
  nodes.root = node('root', '좌석방', board, c);
  nodes.history = node(
    'history',
    '좌석방',
    '지난 판들의 좌석 이력 사본. 승패와 날짜는 또렷한데, 이름 칸이 비어 있는 줄이 드문드문 있다.\n\n그중 한 줄 끝에 작은 글씨: \'원본 — 유령 카지노 서고 보관.\'\n\n나오는 길에 문지기가 턱짓한다. "밖에 게시대 앞에서 형을 찾는다는 녀석이 아까부터 이 이력부 얘길 하더군."',
    [{ text: '기억해 둔다' }],
  );
  nodes.blocked = node(
    'blocked',
    '문지기',
    '"이력부는 장부에 제대로 적힌 사람만 봐. 네 말 반은 안 적었다고 했지." 문지기가 문 밖을 가리킨다. "궁금하면 게시대나 대기실에서 알아봐. 부두엔 입이 많으니까."',
    [{ text: '물러난다' }],
  );
  return { entry: 'root', nodes };
}

// ════════════════════════════════════════════════════════════
// H4 — 레오 / 기록 게시대
// ════════════════════════════════════════════════════════════

const NOTICE_TEXT =
  "명부 사본 두 장.\n\n오래된 승부 명부 — 승자 칸이 '—'로 비었고, 결과와 시각은 또렷하다. 끝에: '원본 — 유령 카지노 서고, 참조 3-나-12'.\n\n승선 명부 — 다른 이름인데, 서명 끝 획이 승부 명부의 한 서명과 같은 모양으로 말려 올라간다.";

function noticeTree(state: GameState): Tree {
  const nodes: Record<string, DialogueNode> = {};
  const seen = on(state, 'h4_f_notice');
  nodes.root = node(
    'root',
    '기록 게시대',
    '찾는 사람 벽보와 오래된 명부 사본이 겹겹이 붙어 있다. 맨 위 벽보:\n\n"찾는 사람 — 이름 모름. 검은 돛 배에서 내린 뒤 행방불명."\n\n항구 게시판에서 본 벽보와 같은 글씨다.',
    seen
      ? [
          { text: '명부 사본을 다시 본다', next: 'copy' },
          { text: '물러난다' },
        ]
      : [
          { text: '명부 사본을 옮겨 적는다', next: 'copy', effects: fx(set('h4_f_notice'), ...casinoRef(state, 'notice')) },
          { text: '물러난다' },
        ],
  );
  nodes.copy = node('copy', '기록 게시대', NOTICE_TEXT, [
    ...(on(state, 'h4_i_same') ? [] : [{ text: '"같은 사람일지도 모르겠네."', effects: [set('h4_i_same')] }]),
    { text: '다 옮겨 적었다' },
  ]);
  return { entry: 'root', nodes };
}

function leoTree(state: GameState): Tree {
  const nodes: Record<string, DialogueNode> = {};
  if (!on(state, 'h3_seen_intro')) {
    nodes.root = node('root', '벽보 붙이는 사람', '벽보를 붙이던 사람이 너를 흘끔 본다. "안에 들어가려고? …다녀와. 이 벽보는 그때도 여기 있을 테니까."', [{ text: '물러난다' }]);
    return { entry: 'root', nodes };
  }
  const outcome = String(f(state, 'h3_outcome') ?? '');
  const choiceOnce = (v: string) => (f(state, 'leo_choice') === undefined ? set('leo_choice', v) : null);
  const menu = (): DialogueChoice[] => {
    const c: DialogueChoice[] = [];
    if (!on(state, 'h4_f_notice'))
      c.push({ text: '공고 원문을 같이 본다', next: 'notice', effects: fx(set('leo_met'), choiceOnce('records'), set('h4_f_notice'), ...casinoRef(state, 'notice')) });
    else if (!on(state, 'h4_i_same')) c.push({ text: '공고를 다시 같이 본다', next: 'notice', effects: [set('leo_met')] });
    if (!on(state, 'leo_accompany')) c.push({ text: '"같이 찾아볼까?"', next: 'acc', effects: fx(set('leo_met'), choiceOnce('accompany'), set('leo_accompany')) });
    if (!on(state, 'leo_habit')) c.push({ text: '"그 사람, 나도 알 것 같은데."', next: 'probe', effects: fx(set('leo_met'), choiceOnce('probe')) });
    if (f(state, 'leo_choice') === undefined) c.push({ text: '"지금은 도울 수 없어."', next: 'decline', effects: fx(set('leo_met'), choiceOnce('declined')) });
    c.push({ text: '물러난다', effects: [set('leo_met')] });
    return c;
  };
  if (!on(state, 'leo_met')) {
    const opener =
      outcome === 'evidence' || outcome === 'witness'
        ? '"안에 들어갔다며. 좌석방 이력부, 이름 칸 빈 줄들 봤어?"'
        : outcome === 'bluff'
          ? '"안에 들어갔다며. 뭐라도 봤어?"'
          : outcome === 'withdrew'
            ? '"안에 안 들어갔어? …나도 못 들어가. 종이가 없거든."'
            : Number(f(state, 'h3_fails') ?? 0) > 0
              ? '"안에서 쫓겨났어? 나도 그랬어. 종이가 없거든."'
              : '"안에 들어가 봤어? 난 종이가 없어서 못 들어가."';
    nodes.root = node(
      'root',
      '레오',
      `${opener}\n\n"난 레오야. …이 벽보, 내가 붙인 거야. 부두 게시판에 붙은 것도. 이름을 못 써서 '이름 모름'이라고." 쓴웃음. "형 얼굴도, 웃는 소리도 기억해. 이름을 물어보면… 명부에 적힌 낯선 글자부터 나오더라. 형이 여기서 판을 벌였다는 사람도 있고, 여기서 사라졌다는 사람도 있어."`,
      menu(),
    );
  } else {
    const text = f(state, 'leo_trust') === 'low' ? '"…또 떠보려는 거면 사양이야. 볼일 있으면 말해."' : '"형 얘기, 뭐라도 들으면 알려 줘."';
    nodes.root = node('root', '레오', text, menu());
  }
  nodes.notice = node('notice', '레오', `${NOTICE_TEXT.replace('명부 사본 두 장.\n\n', '')}\n\n레오가 서명 끝을 짚는다. "형 거랑 똑같아. …내 눈에만 그런가."`, [
    ...(on(state, 'h4_i_same') ? [] : [{ text: '"같은 사람일지도 모르겠네."', effects: [set('h4_i_same')] }]),
    { text: '고개를 끄덕인다' },
  ]);
  nodes.acc = node('acc', '레오', '"정말? …고마워. 대신 형 이름을 찾으면, 그 이름을 부르는 건 내가 먼저야."', [{ text: '약속한다' }]);
  nodes.probe = node('probe', '레오', '"정말? 형은 판 돌릴 때 버릇이 있었어. 뭐였는지 말해 봐."', [
    { text: '"칩을 손가락 사이로 굴렸지."', next: 'probe_wrong', effects: [set('leo_trust', 'low'), set('leo_habit')] },
    { text: '"말수가 적었어."', next: 'probe_wrong', effects: [set('leo_trust', 'low'), set('leo_habit')] },
    { text: '"미안, 떠본 거야."', next: 'probe_honest', effects: [set('leo_habit')] },
  ]);
  nodes.probe_wrong = node('probe_wrong', '레오', '레오의 얼굴이 굳는다. "…아니야. 형은 칩은 안 만졌어. 늘 카드 모서리를 두 번 두드렸지." 그가 한 걸음 물러선다. "모르면 모른다고 해."', [{ text: '물러난다' }]);
  nodes.probe_honest = node('probe_honest', '레오', '"그럴 줄 알았어. 괜찮아, 다들 그래. …형은 카드 모서리를 두 번 두드렸어. 혹시 그런 사람 보면 알려 줘."', [{ text: '기억해 둔다' }]);
  nodes.decline = node('decline', '레오', '"그래. 난 여기 더 있을 거야. 벽보는 옮겨 적어도 돼."', [{ text: '물러난다' }]);
  return { entry: 'root', nodes };
}

// ════════════════════════════════════════════════════════════
// H5 — 선원 대기실 / 하멜
// ════════════════════════════════════════════════════════════

function diceSailorTree(state: GameState): Tree {
  if (!on(state, 'h5_gossip')) {
    return {
      entry: 'root',
      nodes: {
        root: node(
          'root',
          '주사위 굴리는 선원',
          '"저 구석 친구? 옛날엔 이름난 승부사였다던데. 물어보면 화내. 그러니까 묻지 마." 선원이 주사위를 굴린다. "이름? 하멜이야. 지금은."',
          [{ text: '고맙다고 한다', effects: [set('h5_gossip')] }],
        ),
      },
    };
  }
  return { entry: 'root', nodes: { root: node('root', '주사위 굴리는 선원', '"주사위 할래? 아니면 구경만?" 대답을 기다리지도 않고 다시 굴린다.', [{ text: '구경만 한다' }]) } };
}

function hamelTree(state: GameState): Tree {
  const nodes: Record<string, DialogueNode> = {};
  const named = on(state, 'hamel_named') || on(state, 'h5_gossip');
  const speaker = named ? '하멜' : '그물 깁는 선원';
  const choice = String(f(state, 'sailor_choice') ?? '');
  const canC1 = on(state, 'sailor_knows_grizzle') && !choice;

  const menu = (): DialogueChoice[] => {
    const c: DialogueChoice[] = [];
    if (!on(state, 'sailor_past_heard'))
      c.push(
        on(state, 'h5_gossip')
          ? { text: '"옛날엔 승부사였다던데."', next: 'past', effects: [set('sailor_met'), set('sailor_past_heard'), set('hamel_named')] }
          : { text: '"이름이 뭐야?"', next: 'name', effects: [set('sailor_met'), set('hamel_named')] },
      );
    if (!on(state, 'sailor_knows_grizzle')) c.push({ text: '"고블린 시장에서 왔어."', next: 'grizzle', effects: [set('sailor_met'), set('sailor_knows_grizzle')] });
    else if (canC1) c.push({ text: '그리즐 얘기를 마저 한다', next: 'c1', effects: [set('sailor_met')] });
    if (state.inventory.includes('invitation') && !on(state, 'h5_inv_shown'))
      c.push({ text: '초대장을 보여 준다', next: 'inv', effects: [set('sailor_met'), set('h5_inv_shown')] });
    c.push({ text: '물러난다', effects: [set('sailor_met')] });
    return c;
  };

  const text = !on(state, 'sailor_met')
    ? '"…뭘 봐. 주사위 할 거면 저쪽이야."'
    : choice === 'protect'
      ? '"…네가 한 말, 기억하고 있다."'
      : choice === 'expose'
        ? '"그리즐한테 말했어? …상관없어. 난 여기 있을 거야."'
        : choice === 'message'
          ? '"전했어? …아니면 아직이야? 급할 건 없어."'
          : '하멜이 그물코를 센다. "또 왔군."';
  nodes.root = node('root', speaker, text, menu());
  nodes.name = node('name', '하멜', '"하멜. 선원이야. 그거면 됐지." 바늘이 다시 그물을 파고든다.', [{ text: '물러난다' }]);
  nodes.past = node('past', '하멜', '"일이 끝나고 여기로 오면 다들 전 이름으로 부르더군. 난 그 이름으로 돌아갈 생각 없어." 잠깐 손이 멈춘다. "지금 이름은 하멜이야. 그걸로 불러."', [{ text: '고개를 끄덕인다' }]);
  nodes.inv = node('inv', speaker, '그의 눈이 밀랍 인장에 오래 머문다. "…그 종이, 어디서 났어?"', [{ text: '"시장 창고에서."', next: 'inv2' }]);
  nodes.inv2 = node('inv2', speaker, '"창고라." 그는 더 묻지 않는다. "그걸로 부두 끝에 갔으면, 거기서 뭘 봤는지는 너 혼자 알고 있어."', [{ text: '종이를 거둔다' }]);

  const chip = f(state, 'chip_done');
  const infer: DialogueChoice[] = chip !== undefined && !on(state, 'h5_i_friend')
    ? [{ text: '(속으로) 이 사람이 그리즐에게 칩을 맡긴 친구일까?', next: 'c1', effects: [set('h5_i_friend')] }]
    : [];
  nodes.grizzle = node('grizzle', speaker, '하멜이 손을 멈춘다. "시장… 그리즐? 걘 아직도 값을 깎으려 들겠지." 잠깐 말이 끊긴다. "…걔는 잘 지내?"', [
    ...(chip === 'warm' ? [{ text: '"그리즐이 친구와의 약속을 지키고 있더라."', next: 'g_warm' }] : []),
    ...(chip === 'cold' ? [{ text: '"그리즐한테 뭘 캐물었다가 혼났어."', next: 'g_cold' }] : []),
    { text: '"잘 지내. 여전히 시끄러워."', next: 'g_fine' },
  ]);
  nodes.g_warm = node('g_warm', speaker, '하멜의 표정이 굳는다. "…그래. 그 녀석답네." 더는 말하지 않는다.', [...infer, { text: '기다린다', next: 'c1' }]);
  nodes.g_cold = node('g_cold', speaker, '"그랬겠지. 걘 약속 얘기 나오면 이빨부터 드러내."', [...infer, { text: '기다린다', next: 'c1' }]);
  nodes.g_fine = node('g_fine', speaker, '"다행이네."', [...infer, { text: '기다린다', next: 'c1' }]);
  const advice: DialogueChoice = { text: '…', next: 'advice', effects: [set('h5_advice')] };
  nodes.c1 = node('c1', speaker, '하멜이 그물을 내려놓는다. "그리즐 얘기를 꺼낸 걸 보니, 날 찾아온 셈이군. 이제 뭘 할 건데?"', [
    { text: '"그리즐에게 네가 여기 있다고 말하겠다."', next: 'c1_expose', effects: [set('sailor_choice', 'expose')] },
    { text: '"원하지 않으면 말하지 않을게."', next: 'c1_protect', effects: [set('sailor_choice', 'protect')] },
    { text: '"그리즐에게 네가 보내는 말만 전할까?"', next: 'c1_message', effects: [set('sailor_choice', 'message'), set('sailor_message', '약속 지켜 줘서 고맙다')] },
    { text: '아직 정하지 않는다', next: 'c1_later' },
  ]);
  nodes.c1_expose = node('c1_expose', speaker, '"…네 마음대로 해. 대신 알아 둬. 걔가 찾아와도 난 안 돌아가."', [advice]);
  nodes.c1_protect = node('c1_protect', speaker, '"…고맙다곤 안 할게. 그래도 기억은 해 두지."', [advice]);
  nodes.c1_message = node('c1_message', speaker, '하멜이 한참 화로를 본다. "…\'약속 지켜 줘서 고맙다.\' 그거면 돼. 어디 있는지는 빼고."', [advice]);
  nodes.c1_later = node('c1_later', speaker, '"그럼 정하고 와." 다시 그물을 집어 든다.', [{ text: '물러난다' }]);
  nodes.advice = node('advice', speaker, '"하나만 말해 주지. 명부를 믿기 전에, 누가 손댔는지 봐."', [{ text: '고개를 끄덕인다' }]);
  return { entry: 'root', nodes };
}

function sailorLogTree(state: GameState): Tree {
  const seen = on(state, 'h5_f_log');
  return {
    entry: 'root',
    nodes: {
      root: node(
        'root',
        '벤치의 항해 일지',
        seen ? '같은 도장이다. \'유령 카지노 서고 — 물품 인수.\'' : '펼쳐진 항해 일지. 짐 목록 한 줄에 도장이 찍혀 있다.\n\n\'유령 카지노 서고 — 물품 인수.\'',
        seen ? [{ text: '덮는다' }] : [{ text: '기억해 둔다', effects: fx(set('h5_f_log'), ...casinoRef(state, 'log')) }],
      ),
    },
  };
}

/**
 * 핀에게 출발을 말하기 전(W0: 누구나 부두 끝에 걸어올 수 있다)의 부두 끝 사람들 —
 * 이야기·단서·기록 없이 생활감 한 줄만. 달 없는 밤이 시작되면 같은 자리에서 사건이 열린다.
 */
const DAY_LINES: Record<string, [string, string]> = {
  usher: ['문지기', '"오늘은 판이 없어." 문지기가 장부를 덮는다. "달 없는 밤에나 문을 열지."'],
  hall_ledger: ['장부', '두꺼운 장부가 덮여 있다. 문지기가 손바닥으로 누른다. "구경거리 아니야."'],
  seat_a: ['바늘', '마른 사내가 의자에 기대 졸고 있다. 말을 걸어도 눈을 뜨지 않는다.'],
  seat_b: ['물결', '"심부름 중이야. 할 일이 없으면 저리 가."'],
  seat_c: ['갈매기', '누군가 품속을 누른 채 벽 쪽을 보고 앉아 있다. 대답이 없다.'],
  seats_door: ['좌석방 문', '안쪽 문이 잠겨 있다. 안쪽은 조용하다.'],
  notice_stand: ['기록 게시대', '찾는 사람 벽보가 겹겹이 붙어 있다. 맨 위 벽보:\n\n"찾는 사람 — 이름 모름. 검은 돛 배에서 내린 뒤 행방불명."'],
  leo: ['벽보 붙이는 사람', '벽보를 붙이던 사람이 너를 흘끔 본다. "…벽보 붙이는 중이야."'],
  dice_sailor: ['주사위 굴리는 선원', '"주사위 할래? 물때가 안 좋아서 다들 놀고 있어."'],
  hamel: ['그물 깁는 선원', '구석에서 누군가 그물을 깁고 있다. "…뭘 봐. 주사위 할 거면 저쪽이야."'],
  sailor_log: ['벤치의 항해 일지', '펼쳐진 항해 일지. 물때와 날씨 기록이 빽빽하다.'],
};

/** EP1 장소의 대상 상호작용 (없으면 null) */
export function moonlessInteraction(entityId: string, state: GameState): Tree | null {
  const day = DAY_LINES[entityId];
  if (day && !on(state, 'ep1_departed')) {
    return { entry: 'root', nodes: { root: node('root', day[0], day[1], [{ text: '물러난다' }]) } };
  }
  switch (entityId) {
    case 'usher':
      return usherTree(state);
    case 'hall_ledger':
      return { entry: 'root', nodes: { root: { ...ledgerNode('root'), speaker: '접수대 장부' } } };
    case 'seat_a':
      return seatATree(state);
    case 'seat_b':
      return seatBTree(state);
    case 'seat_c':
      return seatCTree(state);
    case 'seats_door':
      return seatsDoorTree(state);
    case 'notice_stand':
      return noticeTree(state);
    case 'leo':
      return leoTree(state);
    case 'dice_sailor':
      return diceSailorTree(state);
    case 'hamel':
      return hamelTree(state);
    case 'sailor_log':
      return sailorLogTree(state);
    default:
      return null;
  }
}

// ════════════════════════════════════════════════════════════
// 사건 수첩 '달 없는 밤' — 플래그에서만 파생 (비밀 없음)
// ════════════════════════════════════════════════════════════

export function moonlessRecords(state: GameState): { kind: RecordKind; text: string }[] {
  const r: { kind: RecordKind; text: string }[] = [];
  const add = (cond: boolean, kind: RecordKind, text: string) => {
    if (cond) r.push({ kind, text });
  };
  add(on(state, 'ep1_departed'), 'claim', '핀: "부두 끝에서 이름을 묻거든, 네 이름이 아니라 네가 앉을 자리를 대답해."');
  add(on(state, 'h2_asked'), 'rumor', '핀이 들은 말: 밤의 부두의 판은 카드를 돌리지 않고, 종이를 든 사람들이 누가 자리에 앉을지를 따진다.');
  add(on(state, 'h3_rules_heard'), 'claim', '문지기: 본 것 하나를 대고 남의 말 하나를 제대로 따지면 오늘 밤 잠정 자리를 준다. 소유권은 판정하지 않는다.');
  add(on(state, 'h3_fin_asked'), 'claim', '문지기: 오늘 밤엔 종이가 자리보다 많다. (핀은 자리가 초대장 수만큼이라고 했다.)');
  add(on(state, 'h3_witness_rule'), 'claim', '문지기: 다른 종이 주인이 같이 서 주면 증인으로 방에 들어갈 수 있다.');
  add(on(state, 'h3_f_ledger'), 'fact', '접수대 장부 — 빈 자리는 16·17번. 17번: "고블린 시장 경유 · 미발송 보관", 명부 서명 공란, 원본 소지자 미상.');
  add(on(state, 'h3_i_seat17'), 'inference', '내 초대장은 시장 창고 궤짝에서 나왔고, 17번은 "시장 경유 미발송"이다. 같은 종이일 수 있다 — 확인된 건 아니다.');
  add(on(state, 'h3_c_a'), 'claim', '바늘: "난 17번 서류를 먼저 받았어."');
  add(on(state, 'h3_c_a_src'), 'claim', '바늘: 부두에서 산 종이가 아니다.');
  add(on(state, 'h3_f_edge'), 'fact', '바늘의 종이 — 모서리 서식은 접수대 것과 같아 보이나, 발행 날짜가 긁혀 지워졌다.');
  add(on(state, 'h3_rumor'), 'rumor', '부두 사람들은 내가 이름 없는 초대장을 가졌다는 소문을 이미 들었다.');
  add(on(state, 'h3_c_b'), 'claim', '물결: 자리를 맡아 달라는 부탁을 받았을 뿐, 주인이라고 한 적 없다.');
  add(on(state, 'h3_c_b_who'), 'claim', '물결: 종이를 맡긴 사람은 모자를 눌러쓴 사람이었다.');
  add(on(state, 'h3_f_receipt'), 'fact', '물결의 인수증 — "종이 한 장 · 16번 · 대리 보관", 맡긴 사람 이름 칸 공란.');
  add(on(state, 'b_consent'), 'claim', '물결: 판에서 인수증 얘기는 "16번이라는 것까지만" 해도 된다.');
  add(on(state, 'h3_c_c'), 'claim', '갈매기: 종이도 번호도 보여 주지 않겠다.');
  add(on(state, 'h3_c_c_why'), 'claim', '갈매기: 여기선 번호가 곧 표적이다.');
  add(on(state, 'h3_card_shown'), 'fact', '갈매기가 낡은 스페이드 카드 뒷면의 글귀를 오래 보았다. (왜 그랬는지는 모른다.)');
  add(on(state, 'h3_card_shown'), 'claim', '갈매기: "여기 사람들한테 딱 맞는 말이야. 근데 그걸 보여 주는 너는?"');
  add(on(state, 'seats_seen'), 'fact', '좌석판 17번 칸에는 이름패가 없다.');
  add(on(state, 'h3_f_history'), 'fact', '좌석 이력부 — 이름 칸이 빈 줄이 여러 개 있고, 한 줄의 원본은 "유령 카지노 서고 보관"이라 적혀 있다.');
  add(on(state, 'leo_met'), 'claim', '레오: 형의 얼굴과 목소리는 기억하지만, 이름을 대려 하면 명부의 낯선 글자부터 떠오른다.');
  add(on(state, 'leo_met'), 'claim', '레오: 부두의 "이름 모름" 벽보는 자기가 붙였다. 형이 이 부두에서 판을 벌였다고도, 사라졌다고도 한다.');
  add(on(state, 'h4_f_notice'), 'fact', '게시대의 승부 명부 사본 — 승자 칸이 비었고, 원본은 "유령 카지노 서고, 참조 3-나-12"에 있다.');
  add(on(state, 'h4_f_notice'), 'fact', '승선 명부 사본의 다른 이름 서명 끝 획이, 승부 명부의 한 서명과 같은 모양으로 말려 올라간다.');
  add(on(state, 'h4_i_same'), 'inference', '두 명부의 서명은 같은 사람의 것일 수 있다 — 이름은 다르다.');
  add(on(state, 'leo_habit'), 'claim', '레오: 형은 판을 돌릴 때 카드 모서리를 두 번 두드리는 버릇이 있었다.');
  add(on(state, 'h5_gossip'), 'rumor', '대기실 선원들 말로는, 구석에서 그물 깁는 선원 하멜은 한때 이름난 승부사였다.');
  add(on(state, 'sailor_past_heard'), 'claim', '하멜: 예전 이름으로 돌아갈 생각이 없다.');
  add(on(state, 'sailor_knows_grizzle'), 'claim', '하멜: 고블린 시장의 그리즐을 안다. "…걔는 잘 지내?"');
  add(on(state, 'h5_inv_shown'), 'fact', '하멜이 내 초대장의 밀랍 인장을 오래 보았다. (왜 그랬는지는 모른다.)');
  add(on(state, 'h5_inv_shown'), 'claim', '하멜: "거기서 뭘 봤는지는 너 혼자 알고 있어."');
  add(on(state, 'h5_i_friend'), 'inference', '하멜은 그리즐에게 칩을 맡긴 사라진 친구일 수 있다 — 본인은 그렇게 말하지 않았다.');
  add(on(state, 'h5_advice'), 'claim', '하멜: 명부를 믿기 전에, 누가 손댔는지 봐라.');
  add(on(state, 'h5_f_log'), 'fact', '대기실 항해 일지 — 짐 목록 한 줄에 "유령 카지노 서고 — 물품 인수" 도장이 찍혀 있다.');
  return r;
}
