import type { DialogueChoice, DialogueNode, GameAction, GameState } from '../types';
import { pickIndex } from '../rng';
import type { RecordKind } from './records';

/**
 * S01 — 두 상인의 진품 소동 (GM-03 중앙 장터).
 *
 * 진실 상태(T1/T2/T3)는 중앙 장터에 처음 들어올 때 시드로 정해져 flags.s01_truth에 저장되고
 * 이후 바뀌지 않는다. 증거는 "무엇이 보이는가"(사실)만 말하고, 어느 가드가 진품인지는
 * 끝까지 플레이어의 추정(INFERENCE)으로만 기록한다.
 *
 * NPC 이름은 되돌릴 수 있는 임시 표시명이다 (내부 id: s01_a / s01_b).
 */

export type S01Truth = 'T1' | 'T2' | 'T3';
export type S01Verdict = 'A' | 'B' | 'neither' | 'mediated';

export const S01_TRUTHS: S01Truth[] = ['T1', 'T2', 'T3'];
export const S01_NAMES = { A: '공방 상인', B: '되팔이 상인', onlooker: '구경꾼' } as const;
/** 보류 후 사건이 진행되기까지 필요한 장소 이동 횟수 */
export const S01_DEFER_TRAVELS = 2;

export function pickS01Truth(seed: number): S01Truth {
  return S01_TRUTHS[pickIndex(seed + 7919, S01_TRUTHS.length)];
}

export function s01Truth(state: GameState): S01Truth | null {
  const t = state.flags.s01_truth;
  return t === 'T1' || t === 'T2' || t === 'T3' ? t : null;
}

/** 이 진실 상태에서 원본을 가진 쪽 (T3는 둘 다 아님) */
function genuineHolder(t: S01Truth): 'A' | 'B' | 'neither' {
  return t === 'T1' ? 'A' : t === 'T2' ? 'B' : 'neither';
}

// ── 증거 매트릭스: 보이는 것만 기술 ──

const SEAL_FACT: Record<S01Truth, string> = {
  T1: '공방 상인의 가드: 인장 가장자리가 닳아 둥글다. 뒷면 품번 7. / 되팔이 상인의 가드: 인장 선이 날카롭고 금박 아래 주물 자국이 있다. 뒷면 품번 13.',
  T2: '공방 상인의 가드: 인장 선이 날카롭고 금박 아래 주물 자국이 있다. 뒷면 품번 12. / 되팔이 상인의 가드: 인장 가장자리가 닳아 둥글다. 뒷면 품번 7.',
  T3: '공방 상인의 가드: 인장 선이 날카롭고 주물 자국이 있다. 뒷면 품번 12. / 되팔이 상인의 가드: 역시 인장 선이 날카롭고 주물 자국이 있다. 뒷면 품번 13.',
};

const RECEIPT_FACT: Record<S01Truth, string> = {
  T1: '영수증: 판매자 도장은 공방 문장이 아니라 "항구 잡화" 도장이다. 날짜는 지난 계절. 품번 칸은 비어 있다.',
  T2: '영수증: 판매자 도장은 공방 문장이다. 날짜는 지난 계절. 품번 7.',
  T3: '영수증: 판매자 도장은 공방 문장이다. 날짜는 지난 계절. 품번 7.',
};

const ONLOOKER_RUMOR: Record<S01Truth, string> = {
  T1: '"저 되팔이, 항구 잡화점 단골이야. 거기서 이것저것 떼어 온다더군."',
  T2: '"공방 영감이 지난 계절에 급전이 필요해서 물건을 좀 팔았다던데… 본인은 기억 못 하는 눈치야."',
  T3: '"요즘 그 공방 가드 가짜가 돈다더라. 진짜 하나는 전당포에 잡혀 있다는 얘기도 있고."',
};

const DEFER_RUMOR = '"아까 그 둘 아직도 싸우더라. 되팔이 녀석은 값을 내렸고, 이제 영수증을 아무한테나 보여 주고 다녀."';

// ── 결과: 진실 × 판결 → 반응·관계 (시드 시나리오의 동기와 일관) ──

interface Outcome {
  relA: 'warm' | 'neutral' | 'cold';
  relB: 'warm' | 'neutral' | 'cold';
  a: string;
  b: string;
}

function outcome(t: S01Truth, v: S01Verdict, informed: boolean): Outcome {
  if (v === 'mediated') {
    return {
      relA: 'neutral',
      relB: 'neutral',
      a: '"...오늘은 그만두지. 손님들 앞에서 체면만 상했군."',
      b: '"쳇, 결론도 없이 끝이야? 뭐, 오늘은 접을게."',
    };
  }
  const holder = genuineHolder(t);
  if (v === 'A') {
    if (holder === 'A') {
      return {
        relA: 'warm',
        relB: informed ? 'neutral' : 'cold',
        a: '"그래, 이게 우리 공방 물건이야. 알아봐 줘서 고맙군."',
        b: informed
          ? '"품번이… 아니, 이건 항구 잡화에서 산 건데. 거기 녀석한테 따져야겠어." 되팔이는 씩씩거리며 영수증을 구겨 넣는다.'
          : '"근거도 없이 저 영감 편이야? 흥."',
      };
    }
    return {
      relA: 'warm',
      relB: 'cold',
      a: '"그렇지! 역시 보는 눈이 있어."',
      b: holder === 'B'
        ? '"영수증까지 있는데 이러기야? 두고 보자고."'
        : '"...둘 다 수상하다는 소리는 안 하는군. 됐어."',
    };
  }
  if (v === 'B') {
    if (holder === 'B') {
      return {
        relA: informed ? 'neutral' : 'cold',
        relB: 'warm',
        a: informed
          ? '"품번 7… 지난 계절에… 그래, 내가 팔았었지. 급전이 필요했던 때야." 장인은 가드를 조용히 내려놓는다.'
          : '"내 공방 물건을 내가 모를까 봐? 흥."',
        b: '"거봐, 내 말이 맞지! 고마워, 손님."',
      };
    }
    return {
      relA: 'cold',
      relB: 'warm',
      a: holder === 'A' ? '"내 인장을 몰라보다니. 두 번 다시 오지 마시오."' : '"...됐소. 오늘은 장사 접겠소."',
      b: '"하하, 역시 내 편이야!"',
    };
  }
  // neither
  if (holder === 'neither') {
    return {
      relA: 'neutral',
      relB: 'neutral',
      a: '"둘 다 새로 찍은 거라고…? 가짜가 돈다니, 공방 체면이 말이 아니군." 장인은 굳은 얼굴로 가드를 뒤집어 본다.',
      b: '"영수증 품번이랑 안 맞네… 나도 속은 거야?" 되팔이는 할 말을 잃는다.',
    };
  }
  return {
    relA: holder === 'A' ? 'cold' : 'neutral',
    relB: holder === 'B' ? 'cold' : 'neutral',
    a: holder === 'A' ? '"내 물건까지 가짜라고? 모욕이오."' : '"...그렇게 보인다면 할 수 없지."',
    b: holder === 'B' ? '"영수증까지 보여 줬는데 가짜라니, 너무하네."' : '"흠, 그런가…"',
  };
}

// ── 상태 헬퍼 ──

function stage(state: GameState): string {
  const s = state.flags.s01_stage;
  return typeof s === 'string' ? s : 'unseen';
}

function hasEvidence(state: GameState): boolean {
  return state.flags.s01_ev_seal === true || state.flags.s01_ev_receipt === true;
}

function markSeen(state: GameState): GameAction[] {
  if (stage(state) !== 'unseen') return [];
  return [
    { type: 'SET_FLAG', key: 's01_stage', value: 'seen' },
    { type: 'SET_QUEST_STAGE', questId: 'q_s01', stage: 'seen' },
  ];
}

function markInvestigating(state: GameState): GameAction[] {
  const st = stage(state);
  if (st === 'investigating' || st === 'resolved') return [];
  return [
    { type: 'SET_FLAG', key: 's01_stage', value: 'investigating' },
    { type: 'SET_QUEST_STAGE', questId: 'q_s01', stage: 'investigating' },
  ];
}

function verdictChoices(state: GameState): DialogueChoice[] {
  const t = s01Truth(state);
  if (!t) return [];
  const informed = hasEvidence(state);
  const make = (v: S01Verdict, text: string): DialogueChoice => {
    const o = outcome(t, v, informed);
    return {
      text,
      next: 's01_reaction',
      effects: [
        { type: 'SET_FLAG', key: 's01_verdict', value: v },
        { type: 'SET_FLAG', key: 's01_informed', value: informed },
        { type: 'SET_FLAG', key: 's01_rel_A', value: o.relA },
        { type: 'SET_FLAG', key: 's01_rel_B', value: o.relB },
        { type: 'SET_FLAG', key: 's01_stage', value: 'resolved' },
        { type: 'SET_QUEST_STAGE', questId: 'q_s01', stage: 'resolved' },
      ],
    };
  };
  const out: DialogueChoice[] = [
    make('A', `${S01_NAMES.A}의 가드가 원본이라고 말한다`),
    make('B', `${S01_NAMES.B}의 가드가 원본이라고 말한다`),
  ];
  if (informed) out.push(make('neither', '둘 다 원본이 아닌 것 같다고 말한다'));
  out.push(make('mediated', '누가 옳은지 말하지 않고 둘을 떼어 놓는다'));
  return out;
}

function reactionNode(state: GameState): DialogueNode | null {
  const t = s01Truth(state);
  const v = state.flags.s01_verdict as S01Verdict | undefined;
  if (!t || !v) return null;
  const o = outcome(t, v, state.flags.s01_informed === true);
  return {
    id: 's01_reaction',
    speaker: '',
    text: `${S01_NAMES.A}: ${o.a}\n\n${S01_NAMES.B}: ${o.b}\n\n구경꾼들이 하나둘 흩어진다. 누구 말이 맞았는지는, 결국 당신의 판단으로 남았다.`,
    choices: [{ text: '자리를 정리한다' }],
  };
}

function afterLine(who: 'A' | 'B', state: GameState): string {
  const rel = state.flags[`s01_rel_${who}`];
  if (who === 'A') {
    return rel === 'warm'
      ? '"또 왔군. 자네 같은 눈썰미라면 공방에 들러도 좋소."'
      : rel === 'cold'
        ? '장인은 당신을 못 본 척 가드를 닦는다.'
        : '"...그 일은 잊읍시다. 뭘 찾으시오?"';
  }
  return rel === 'warm'
    ? '"어이, 내 편 들어 준 손님! 다음에 좋은 물건 들어오면 먼저 보여 줄게."'
    : rel === 'cold'
      ? '"흥, 당신이랑은 거래 안 해."'
      : '"그 가드 말이야? 이제 그냥 싸게 넘기려고."';
}

function tree(speaker: string, text: string, choices: DialogueChoice[], extra: DialogueNode[] = []) {
  const nodes: Record<string, DialogueNode> = { root: { id: 'root', speaker, text, choices } };
  for (const n of extra) nodes[n.id] = n;
  return { entry: 'root', nodes };
}

function deferChoice(state: GameState): DialogueChoice[] {
  if (stage(state) === 'deferred') return [];
  return [
    {
      text: '끼어들지 않고 나중에 다시 오겠다',
      effects: [
        { type: 'SET_FLAG', key: 's01_stage', value: 'deferred' },
        { type: 'SET_FLAG', key: 's01_deferred_at', value: Number(state.flags.travel_count ?? 0) },
        { type: 'SET_QUEST_STAGE', questId: 'q_s01', stage: 'deferred' },
      ],
    },
  ];
}

// ── 상호작용 ──

export function s01Interaction(entityId: string, state: GameState) {
  const st = stage(state);
  const reaction = reactionNode(state);
  const extra = reaction ? [reaction] : [];
  const advanced = state.flags.s01_advanced === true;

  if (entityId === 's01_a') {
    if (st === 'resolved') return tree(S01_NAMES.A, afterLine('A', state), [{ text: '인사하고 물러난다' }], extra);
    const text = advanced
      ? '"아직도 저 녀석이 내 물건 흉내를 팔고 있소. 우리 공방 인장이 찍힌 게 원본이오. 그건 변하지 않아."'
      : '"우리 공방 인장이 찍힌 것이 원본이오! 저건 흉내 낸 물건이야." 장인이 가드를 높이 쳐든다.';
    return tree(S01_NAMES.A, text, [
      ...verdictChoices(state).map((c) => ({ ...c, effects: [...markSeenNpc(state, 'A'), ...(c.effects ?? [])] })),
      ...deferChoice(state).map((c) => ({ ...c, effects: [...markSeenNpc(state, 'A'), ...(c.effects ?? [])] })),
      { text: '자리를 뜬다', effects: markSeenNpc(state, 'A') },
    ], extra);
  }

  if (entityId === 's01_b') {
    if (st === 'resolved') return tree(S01_NAMES.B, afterLine('B', state), [{ text: '인사하고 물러난다' }], extra);
    const t = s01Truth(state);
    const text = advanced
      ? '"손님, 이거 반값에 줄게. 영수증도 여기 있어, 봐 봐!" 되팔이가 영수증을 먼저 내민다.'
      : '"지난 계절에 이 공방에서 산 거라고! 영수증도 있어." 되팔이가 품속을 두드린다.';
    const receipt: DialogueChoice[] =
      state.flags.s01_ev_receipt === true || !t
        ? []
        : [
            {
              text: '영수증을 보여 달라고 한다',
              next: 's01_receipt',
              effects: [...markSeenNpc(state, 'B'), ...markInvestigating(state), { type: 'SET_FLAG', key: 's01_ev_receipt', value: true }],
            },
          ];
    const receiptNode: DialogueNode[] = t
      ? [{ id: 's01_receipt', speaker: S01_NAMES.B, text: `되팔이가 구겨진 영수증을 펼쳐 보인다.\n\n${RECEIPT_FACT[t]}`, choices: [{ text: '기억해 둔다' }] }]
      : [];
    return tree(S01_NAMES.B, text, [
      ...receipt,
      ...verdictChoices(state).map((c) => ({ ...c, effects: [...markSeenNpc(state, 'B'), ...(c.effects ?? [])] })),
      ...deferChoice(state).map((c) => ({ ...c, effects: [...markSeenNpc(state, 'B'), ...(c.effects ?? [])] })),
      { text: '자리를 뜬다', effects: markSeenNpc(state, 'B') },
    ], [...extra, ...receiptNode]);
  }

  if (entityId === 's01_guards') {
    const t = s01Truth(state);
    if (!t) return tree('', '진열대에 가드 두 개가 놓여 있다.', [{ text: '확인' }]);
    if (state.flags.s01_ev_seal === true || st === 'resolved') {
      return tree('두 개의 카드 가드', SEAL_FACT[t], [{ text: '확인했다' }]);
    }
    return tree('두 개의 카드 가드', '진열대에 똑같이 생긴 금박 카드 가드 두 개가 나란히 놓여 있다. 두 상인이 서로 자기 것이 원본이라며 목소리를 높인다.', [
      {
        text: '두 가드를 자세히 살펴본다',
        next: 's01_seal',
        effects: [...markSeen(state), ...markInvestigating(state), { type: 'SET_FLAG', key: 's01_ev_seal', value: true }],
      },
      { text: '그냥 둔다', effects: markSeen(state) },
    ], [{ id: 's01_seal', speaker: '두 개의 카드 가드', text: SEAL_FACT[t], choices: [{ text: '기억해 둔다' }] }]);
  }

  if (entityId === 's01_onlooker') {
    const t = s01Truth(state);
    if (!t) return tree(S01_NAMES.onlooker, '"구경 났네, 구경 났어."', [{ text: '물러난다' }]);
    const heard = state.flags.s01_ev_bystander === true;
    const line = advanced ? `${ONLOOKER_RUMOR[t]}\n\n${DEFER_RUMOR}` : ONLOOKER_RUMOR[t];
    const effects: GameAction[] = [];
    if (!heard) effects.push(...markSeen(state), { type: 'SET_FLAG', key: 's01_ev_bystander', value: true });
    if (advanced && state.flags.s01_heard_defer !== true) {
      effects.push({ type: 'SET_FLAG', key: 's01_heard_defer', value: true });
    }
    return tree(S01_NAMES.onlooker, heard ? line : `꼬치를 씹던 구경꾼이 목소리를 낮춘다.\n\n${line}`, [
      { text: '고개를 끄덕인다', effects },
    ]);
  }
  return null;
}

function markSeenNpc(state: GameState, who: 'A' | 'B'): GameAction[] {
  const key = `s01_heard_${who}`;
  const out: GameAction[] = [...markSeen(state)];
  if (state.flags[key] !== true) {
    out.push({ type: 'SET_FLAG', key, value: true }, { type: 'NPC_MET', npcId: who === 'A' ? 's01_a' : 's01_b' });
  }
  return out;
}

// ── 장면 진입 훅 (리듀서에서 호출) ──

/** 중앙 장터 진입 시: 진실 상태 시드 확정, 보류 후 진행 판정. 새로고침만으로는 호출되지 않는다. */
export function onEnterCentralMarket(state: GameState, seed: number): GameState {
  let flags = state.flags;
  if (!s01Truth(state)) flags = { ...flags, s01_truth: pickS01Truth(seed) };
  if (
    flags.s01_stage === 'deferred' &&
    flags.s01_advanced !== true &&
    Number(flags.travel_count ?? 0) >= Number(flags.s01_deferred_at ?? 0) + S01_DEFER_TRAVELS
  ) {
    // 시장 반응이 바뀐다: 되팔이는 값을 내리고, 구경꾼 사이에 새 소문이 돈다 (선택지는 그대로)
    flags = { ...flags, s01_advanced: true };
  }
  return flags === state.flags ? state : { ...state, flags };
}

// ── 일지 기록 ──

export function s01Records(state: GameState): { kind: RecordKind; text: string }[] {
  const t = s01Truth(state);
  if (!t) return [];
  const f = state.flags;
  const out: { kind: RecordKind; text: string }[] = [];
  if (f.s01_heard_A === true) out.push({ kind: 'claim', text: `${S01_NAMES.A}: "우리 공방 인장이 찍힌 것이 원본이다."` });
  if (f.s01_heard_B === true) out.push({ kind: 'claim', text: `${S01_NAMES.B}: "지난 계절에 이 공방에서 샀다. 영수증도 있다."` });
  if (f.s01_ev_seal === true) out.push({ kind: 'fact', text: `두 카드 가드를 직접 살펴봤다 — ${SEAL_FACT[t]}` });
  if (f.s01_ev_receipt === true) out.push({ kind: 'fact', text: `되팔이 상인의 ${RECEIPT_FACT[t]}` });
  if (f.s01_ev_bystander === true) out.push({ kind: 'rumor', text: `구경꾼: ${ONLOOKER_RUMOR[t]}` });
  if (f.s01_heard_defer === true) out.push({ kind: 'rumor', text: `구경꾼: ${DEFER_RUMOR}` });
  const v = f.s01_verdict;
  if (v === 'A' || v === 'B' || v === 'neither') {
    const who = v === 'A' ? `${S01_NAMES.A}의 가드가 원본` : v === 'B' ? `${S01_NAMES.B}의 가드가 원본` : '두 가드 모두 원본이 아님';
    out.push({
      kind: 'inference',
      text: `내 판단: ${who}. ${f.s01_informed === true ? '직접 확인한 흔적을 근거로 내린 판단이다.' : '확인한 근거 없이 내린 판단이다.'}`,
    });
  } else if (v === 'mediated') {
    out.push({ kind: 'inference', text: '내 판단: 누가 옳은지 말하지 않고 두 상인을 떼어 놓았다.' });
  }
  return out;
}
