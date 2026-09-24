import type { DialogueChoice, DialogueNode, GameAction, GameState } from '../types';
import type { RecordKind } from './records';

/**
 * GM-P3 — 그리즐의 부탁 (창고 열쇠의 대결 외 경로).
 *
 * 그리즐의 칠한 예비 경품 상자가 중앙 장터 북쪽 화물 수레에 실려 있다.
 * 좌판의 먼지 자국(사실)과 수레의 낙인 상자(사실)를 모두 확인하면 짐꾼에게 근거를 댈 수 있고,
 * 그렇지 않으면 그리즐 이름을 파는 떠보기만 가능하다. 거절당하면 장소를 한 번 옮겨야 다시 떠볼 수 있다
 * (flags.travel_count 기준 — 새로고침·시간 경과로는 풀리지 않는다).
 *
 * 보상은 기존 낡은 열쇠(old_key) 하나뿐이며, 대결로 이미 받았거나 창고를 열었으면 다시 주지 않는다.
 * 북쪽 수레는 막힌 미래 출구 그대로다 — 이 상호작용은 이동을 일으키지 않는다.
 */

export type FavorStage = 'offered' | 'found' | 'returned';

export const FAVOR_CART_ID = 'gm03_north_cart';
export const FAVOR_STALL_ID = 'crates';

export function favorStage(state: GameState): FavorStage | null {
  const s = state.flags.gf_stage;
  return s === 'offered' || s === 'found' || s === 'returned' ? s : null;
}

/** 부탁을 받은 뒤에만 좌판 흔적을 확인할 수 있다 */
function canObserve(state: GameState): boolean {
  return favorStage(state) === 'offered';
}

/** 떠보기 재시도 대기 중인가 (거절 후 장소 이동이 아직 없음) */
export function bluffOnCooldown(state: GameState): boolean {
  const at = state.flags.gf_refused_at;
  return typeof at === 'number' && Number(state.flags.travel_count ?? 0) <= at;
}

/** 이 시점에 상자를 돌려주면 열쇠가 나가는가 */
function keyAvailable(state: GameState): boolean {
  return !state.inventory.includes('old_key') && state.flags.warehouse_opened !== true;
}

// ── 그리즐 ──

/** 그리즐 대화에 끼워 넣을 부탁 선택지 (시작 / 반납) */
export function favorGrizzleChoices(state: GameState): DialogueChoice[] {
  const st = favorStage(state);
  if (st === null && keyAvailable(state)) {
    return [
      {
        text: '좌판이 왜 이리 허전해?',
        next: 'gf_offer',
        effects: [
          { type: 'SET_FLAG', key: 'gf_stage', value: 'offered' },
          { type: 'SET_QUEST_STAGE', questId: 'q_grizzle_favor', stage: 'offered' },
        ],
      },
    ];
  }
  if (st === 'found') {
    const effects: GameAction[] = [
      { type: 'SET_FLAG', key: 'gf_stage', value: 'returned' },
      { type: 'SET_QUEST_STAGE', questId: 'q_grizzle_favor', stage: 'returned' },
    ];
    if (keyAvailable(state)) {
      effects.push({ type: 'ADD_ITEM', itemId: 'old_key' }, { type: 'SET_FLAG', key: 'gf_key_given', value: true });
      if (state.flags.key_route === undefined) effects.push({ type: 'SET_FLAG', key: 'key_route', value: 'favor' });
      const inv = state.quests.q_invitation?.stage;
      if (inv === 'start' || inv === 'boxes') {
        effects.push({ type: 'SET_QUEST_STAGE', questId: 'q_invitation', stage: 'find_lock' });
      }
    }
    return [{ text: '칠한 상자를 돌려준다', next: 'gf_return', effects }];
  }
  return [];
}

export function favorGrizzleNodes(state: GameState): DialogueNode[] {
  const bluffLine = state.flags.gf_method === 'bluff' ? '\n\n"근데 짐꾼들이 내가 따지러 온다고 겁먹었다던데? 크크, 내 이름값 좀 했네."' : '';
  const returnText =
    state.flags.gf_key_given === true
      ? '"내 상자! 흠집 하나 없네." 그리즐이 상자를 끌어안더니, 경품 상자에서 녹슨 열쇠 하나를 꺼내 던진다. "약속한 경품이야. 어디 쓰는 건지는 나도 몰라. ...이 시장에서 자물쇠 달린 문이라면 창고 하나뿐이지만."'
      : '"내 상자! 흠집 하나 없네." 그리즐이 상자를 끌어안는다. "경품? 열쇠는 이미 가져갔잖아, 욕심쟁이. ...대신 이 일은 기억해 두지."';
  return [
    {
      id: 'gf_offer',
      speaker: '그리즐',
      text: '"...눈썰미 있네." 그리즐이 좌판 옆 빈자리를 흘끔 본다. "칠까지 해 둔 내 예비 경품 상자가 없어졌어. 아침에 짐꾼 놈들이 수레에 실어 간 게 틀림없어! 중앙 장터 북쪽에 서 있는 그 수레 말이야." 그리즐이 턱을 괸다. "찾아다 주면 경품 하나 줄게. 대결 없이, 공짜로."',
      choices: [{ text: '알아보겠다고 한다' }],
    },
    { id: 'gf_return', speaker: '그리즐', text: returnText + bluffLine, choices: [{ text: '고개를 끄덕인다' }] },
  ];
}

// ── 좌판 흔적 (입구 장터의 경품 상자 더미) ──

const STALL_FACT = '그리즐 좌판 옆 경품 상자 더미 곁에 상자 하나 크기의 네모난 먼지 자국이 있다. 남은 상자마다 이빨 자국 낙인이 찍혀 있다.';
const CART_FACT = '중앙 장터 북쪽 화물 수레의 짐 사이에 이빨 자국 낙인이 찍힌 칠한 상자가 끼어 있다.';

export function favorStallInteraction(state: GameState): { entry: string; nodes: Record<string, DialogueNode> } | null {
  if (!canObserve(state)) return null;
  const seen = state.flags.gf_seen_stall === true;
  const choices: DialogueChoice[] = seen
    ? [{ text: '확인했다' }]
    : [{ text: '기억해 둔다', effects: [{ type: 'SET_FLAG', key: 'gf_seen_stall', value: true }] }];
  return {
    entry: 'root',
    nodes: {
      root: {
        id: 'root',
        speaker: '부서진 상자 더미',
        text: `그리즐의 게임에서 나온 상자들이 쌓여 있다.\n\n${STALL_FACT}`,
        choices,
      },
    },
  };
}

// ── 북쪽 수레 (막힌 미래 출구 — 이동 없음) ──

export function favorCartInteraction(state: GameState, label: string, lockedHint: string) {
  const st = favorStage(state);
  if (st === null) return null;
  if (st !== 'offered') {
    return {
      entry: 'root',
      nodes: {
        root: { id: 'root', speaker: label, text: `${lockedHint}\n\n짐 사이, 칠한 상자가 끼어 있던 자리가 비어 있다.`, choices: [{ text: '물러난다' }] },
      },
    };
  }
  const f = state.flags;
  const seenCart = f.gf_seen_cart === true;
  const seenStall = f.gf_seen_stall === true;
  const got = (method: 'evidence' | 'bluff'): GameAction[] => [
    { type: 'SET_FLAG', key: 'gf_stage', value: 'found' },
    { type: 'SET_FLAG', key: 'gf_method', value: method },
    { type: 'SET_FLAG', key: 'gf_seen_cart', value: true },
    { type: 'SET_QUEST_STAGE', questId: 'q_grizzle_favor', stage: 'found' },
  ];

  const choices: DialogueChoice[] = [];
  if (!seenCart) {
    choices.push({
      text: '짐 사이의 칠한 상자를 살펴본다',
      next: 'gf_box',
      effects: [
        { type: 'SET_FLAG', key: 'gf_seen_cart', value: true },
        { type: 'SET_FLAG', key: 'gf_heard_porter', value: true },
      ],
    });
  }
  if (seenCart && seenStall) {
    choices.push({ text: '짐꾼에게 낙인과 좌판의 먼지 자국을 짚어 보인다', next: 'gf_got_evidence', effects: got('evidence') });
  }
  const bluffText = '짐꾼을 떠본다: "그리즐이 직접 따지러 온다더라"';
  if (bluffOnCooldown(state)) {
    choices.push({ text: bluffText, next: 'gf_cooldown' });
  } else if (seenStall) {
    choices.push({ text: bluffText, next: 'gf_got_bluff', effects: got('bluff') });
  } else {
    choices.push({
      text: bluffText,
      next: 'gf_refused',
      effects: [
        { type: 'SET_FLAG', key: 'gf_refused_at', value: Number(f.travel_count ?? 0) },
        { type: 'SET_FLAG', key: 'gf_heard_porter', value: true },
      ],
    });
  }
  choices.push({ text: '물러난다' });

  const boxLine = seenCart ? CART_FACT : '짐 사이로 칠한 상자 하나가 삐죽 나와 있다.';
  const nodes: Record<string, DialogueNode> = {
    root: { id: 'root', speaker: label, text: `${lockedHint}\n\n${boxLine}`, choices },
    gf_box: {
      id: 'gf_box',
      speaker: label,
      text: `${CART_FACT}\n\n수레 뒤에서 짐꾼이 소리친다. "거기 손대지 마! 수레에 실린 건 다 우리 짐이야."`,
      choices: [{ text: '다시 수레 쪽을 본다', next: 'root' }, { text: '물러난다' }],
    },
    gf_got_evidence: {
      id: 'gf_got_evidence',
      speaker: '짐꾼',
      text: '"...낙인이 똑같네. 그 자국 크기도 딱 이 상자만 하고." 짐꾼이 머리를 긁적인다. "아침에 좌판 옆에 굴러다니길래 버린 건 줄 알았지. 가져가, 가져가."',
      choices: [{ text: '상자를 챙긴다' }],
    },
    gf_got_bluff: {
      id: 'gf_got_bluff',
      speaker: '짐꾼',
      text: '"그 고블린이 직접? 좌판 옆에 네모난 자국까지 남았다고?" 짐꾼의 얼굴이 굳는다. "...귀찮은 건 질색이야. 가져가고, 우린 모르는 일로 해."',
      choices: [{ text: '상자를 챙긴다' }],
    },
    gf_refused: {
      id: 'gf_refused',
      speaker: '짐꾼',
      text: '"그리즐? 그 고블린이 뭘 잃어버렸는지나 알고 하는 소리야?" 짐꾼이 코웃음 친다. 그리즐 좌판 사정을 모르니 말이 먹히지 않는다.\n\n(다른 장소에 다녀온 뒤 다시 떠볼 수 있다.)',
      choices: [{ text: '물러난다' }],
    },
    gf_cooldown: {
      id: 'gf_cooldown',
      speaker: '짐꾼',
      text: '"방금 그 소리 또 하려고? 딴 데 갔다 와."\n\n(장소를 한 번 옮긴 뒤 다시 떠볼 수 있다.)',
      choices: [{ text: '물러난다' }],
    },
  };
  return { entry: 'root', nodes };
}

// ── 일지 기록 ──

export function favorRecords(state: GameState): { kind: RecordKind; text: string }[] {
  const st = favorStage(state);
  if (st === null) return [];
  const f = state.flags;
  const out: { kind: RecordKind; text: string }[] = [
    { kind: 'claim', text: '그리즐: "짐꾼 놈들이 내 칠한 예비 경품 상자를 수레에 실어 갔어."' },
  ];
  if (f.gf_seen_stall === true) out.push({ kind: 'fact', text: STALL_FACT });
  if (f.gf_seen_cart === true) out.push({ kind: 'fact', text: CART_FACT });
  if (f.gf_heard_porter === true) out.push({ kind: 'claim', text: '짐꾼: "수레에 실린 건 다 우리 짐이야."' });
  if (f.gf_seen_stall === true && f.gf_seen_cart === true) {
    out.push({ kind: 'inference', text: '수레의 낙인 상자는 그리즐 좌판에서 빠진 그 상자로 보인다. 같은 낙인, 같은 크기의 자국.' });
  }
  if (st === 'found' || st === 'returned') {
    out.push({ kind: 'fact', text: '짐꾼에게서 칠한 상자를 받아 왔다.' });
    if (f.gf_method === 'bluff') out.push({ kind: 'inference', text: '그리즐 이름을 팔아 짐꾼을 떠봤다. 근거를 보여 준 것은 아니다.' });
  }
  if (st === 'returned') {
    out.push({ kind: 'fact', text: '칠한 상자를 그리즐에게 돌려줬다.' });
    if (f.gf_key_given === true) {
      out.push({ kind: 'fact', text: '그리즐이 경품 상자에서 낡은 열쇠를 꺼내 줬다.' });
      out.push({ kind: 'claim', text: '그리즐: "어디 쓰는 건지는 나도 몰라."' });
    }
  }
  return out;
}
