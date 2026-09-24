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
  // 창고가 이미 열렸다는 근거가 하나라도 있으면 열쇠는 더 이상 필요 없다 (구버전 세이브의 flag 누락 대비)
  return (
    !state.inventory.includes('old_key') &&
    state.flags.warehouse_opened !== true &&
    !state.unlocked.includes('warehouse') &&
    state.flags.found_invitation !== true
  );
}

// ── 그리즐 ──

/** 그리즐 대화에 끼워 넣을 부탁 선택지 (시작 / 반납) */
export function favorGrizzleChoices(state: GameState): DialogueChoice[] {
  const st = favorStage(state);
  if (st === null && keyAvailable(state)) {
    return [
      {
        text: '상자가 하나 빈 것 같은데?',
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
  const bluffLine = state.flags.gf_method === 'bluff' ? '\n\n"근데 짐꾼들이 내가 따지러 온다고 벌벌 떨었다며? ...내 이름 판 값은 나중에 받을 거야."' : '';
  const returnText =
    state.flags.gf_key_given === true
      ? '"그걸 정말 찾아왔군." 그리즐이 상자를 받아 뚜껑을 열자, 바닥에서 녹슨 열쇠 하나가 굴러 나온다.\n\n"...흥, 약속은 약속이지. 상자 안에서 나온 건데, 네가 가져. 난 이런 거 넣은 기억 없어."'
      : '"그걸 정말 찾아왔군." 그리즐이 상자를 받아 든다.\n\n"열쇠는 전에 챙겨 갔잖아. ...그래도 상자를 돌려준 건 기억해 두지."';
  return [
    {
      id: 'gf_offer',
      speaker: '그리즐',
      text: '"상자가 하나 비었네, 하고? ...잘도 봤군." 그리즐이 좌판 옆 빈자리를 못마땅하게 노려본다.\n\n"짐꾼들이 내 물건까지 싣고 갔어. 중앙 장터에 수레 세워 둔 그놈들 말이야. 찾아오면 빈손으로 돌려보내진 않지."',
      choices: [{ text: '찾아보지' }],
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
      text: '칠한 상자를 살펴본다',
      next: 'gf_box',
      effects: [
        { type: 'SET_FLAG', key: 'gf_seen_cart', value: true },
        { type: 'SET_FLAG', key: 'gf_heard_porter', value: true },
      ],
    });
  }
  if (seenCart && seenStall) {
    choices.push({ text: '좌판 상자와 같은 이빨 자국을 짚어 보인다', next: 'gf_got_evidence', effects: got('evidence') });
  }
  const bluffText = '그리즐이 직접 따지러 온다고 떠본다';
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
      text: `${CART_FACT}\n\n짐꾼이 수레 뒤에서 고개를 내민다. "수레에 오른 건 우리 짐이야. 남의 장사에 끼어들지 마."`,
      choices: [{ text: '짐꾼 쪽으로 돌아선다', next: 'root' }, { text: '물러난다' }],
    },
    gf_got_evidence: {
      id: 'gf_got_evidence',
      speaker: '짐꾼',
      text: '"좌판에 남은 상자들과 이 상자에 같은 이빨 자국이 있어. 빈자리 크기도 딱 이만하고. 주인한테 확인해 보자."\n\n짐꾼이 낙인을 들여다보다 혀를 찬다. "...그 표시까지 봤다고? 가져가. 대신 내가 내줬다는 말은 하지 마."',
      choices: [{ text: '상자를 챙긴다' }],
    },
    gf_got_bluff: {
      id: 'gf_got_bluff',
      speaker: '짐꾼',
      text: '"그리즐 좌판 상자가 딱 하나 비더군. 전부 이빨 자국 낙인이고. 그 양반 성질 알지?"\n\n짐꾼이 입술을 씰룩인다. "...상자 수까지 세고 왔어? 에이, 귀찮게 됐네. 가져가. 우린 모르는 일이야."',
      choices: [{ text: '상자를 챙긴다' }],
    },
    gf_refused: {
      id: 'gf_refused',
      speaker: '짐꾼',
      text: '"그리즐이 온다고? 그 양반이 직접 와서 말하라 그래. 수레에 오른 건 우리 짐이야."\n\n짐꾼은 등을 돌려 짐 끈을 조인다. 지금은 더 말해 봐야 소용없다.',
      choices: [{ text: '물러난다' }],
    },
    gf_cooldown: {
      id: 'gf_cooldown',
      speaker: '짐꾼',
      text: '"또 그 소리야? 바쁘니까 나중에 와."\n\n(다른 곳에 다녀온 뒤 다시 말을 걸어 보자.)',
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
    { kind: 'claim', text: '그리즐: "짐꾼들이 내 물건까지 싣고 갔어." — 칠한 경품 상자 하나가 없어졌다고 한다.' },
  ];
  if (f.gf_seen_stall === true) out.push({ kind: 'fact', text: STALL_FACT });
  if (f.gf_seen_cart === true) out.push({ kind: 'fact', text: CART_FACT });
  if (f.gf_heard_porter === true) out.push({ kind: 'claim', text: '짐꾼: "수레에 오른 건 우리 짐이야."' });
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
      out.push({ kind: 'fact', text: '돌려준 상자 바닥에서 낡은 열쇠가 나왔고, 그리즐이 가지라며 건넸다.' });
      out.push({ kind: 'claim', text: '그리즐: "난 이런 거 넣은 기억 없어."' });
    }
  }
  return out;
}
