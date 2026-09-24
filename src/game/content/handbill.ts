import type { DialogueChoice, DialogueNode, GameAction, GameState } from '../types';
import type { RecordKind } from './records';

/**
 * GM-P4-A — 벽보 덮기 (입구 장터 GM02 + 중앙 장터 GM03).
 *
 * 누군가 시장 게시판에 그리즐의 상자 게임을 비방하는 익명 벽보를 붙인다. 진실은 고정: 되팔이 상인(s01_b)이
 * 그리즐 쪽 손님을 중앙 장터로 끌어오려고 붙인다. 구경꾼(s01_onlooker)의 분필 손은 오해를 부르는 흔적이다.
 *
 * 상태 머신 (flags.hb_stage) — 장소 전환(gotoLocation)에서만 전진하고, 불러오기·새로고침으로는 절대 움직이지 않는다:
 *   noticed       그리즐을 만난 뒤 게시판을 처음 살펴보면 시작. 벽보가 붙어 있다.
 *   away_pending  벽보를 뜯어냈다. 플레이어가 입구 장터를 떠나기를 기다린다.
 *   posting       입구 장터를 떠났다 → 되팔이가 새 벽보를 붙이러 자리를 비운다.
 *                 이때 곧장 중앙 장터로 가면(그리고 S01이 해결된 뒤라면) 빈 좌판을 볼 수 있다.
 *   posted        입구 장터로 돌아오면 새 벽보가 붙어 있고, 이번 방문 동안 풀이 젖어 있다.
 *   gm03_window   그 뒤 처음 중앙 장터에 들어가면 되팔이 손가락에 풀 자국이 남아 있다.
 *   investigating 창을 지나 조사 중 (벽보는 뜯거나 둘 수 있다).
 *   resolved      직면·설득·떠보기 성공·그리즐에게 알림 중 하나로 끝.
 * 재게시는 최대 3회. 그 뒤에도 모든 해결 선택지는 남는다 (소프트락 없음).
 *
 * 사실(FACT)은 관찰만 기록한다. 범인에 대한 판단은 플레이어가 직면·떠보기·알림을 고를 때에만 추정(INFERENCE)으로 남는다.
 */

export type HbStage = 'noticed' | 'away_pending' | 'posting' | 'posted' | 'gm03_window' | 'investigating' | 'resolved';
export const HB_MAX_POSTS = 3;

export function hbStage(state: GameState): HbStage | null {
  const s = state.flags.hb_stage;
  return s === 'noticed' || s === 'away_pending' || s === 'posting' || s === 'posted' || s === 'gm03_window' || s === 'investigating' || s === 'resolved'
    ? s
    : null;
}

const tc = (state: GameState) => Number(state.flags.travel_count ?? 0);
const set = (key: string, value: boolean | number | string): GameAction => ({ type: 'SET_FLAG', key, value });

function eligible(state: GameState): boolean {
  return (state.npcs.goblin?.meetCount ?? 0) > 0;
}

function s01Resolved(state: GameState): boolean {
  return state.flags.s01_stage === 'resolved';
}

/** 되팔이 상인을 가리키는 관찰 사실이 하나라도 있는가 (떠보기·설득의 근거) */
function anyFact(state: GameState): boolean {
  const f = state.flags;
  return f.hb_seen_paper === true || f.hb_seen_pad === true || f.hb_seen_absent === true || f.hb_seen_wet === true || f.hb_seen_hands === true;
}

/** 직접 들이밀 만한 흔적 조합 */
function hasEvidence(state: GameState): boolean {
  const f = state.flags;
  return f.hb_seen_hands === true || (f.hb_seen_paper === true && f.hb_seen_pad === true) || (f.hb_seen_absent === true && f.hb_seen_wet === true);
}

// ── 장소 전환 훅 (gotoLocation 끝에서 호출) ──

export function hbOnTransition(fromLoc: string, next: GameState): GameState {
  const st = hbStage(next);
  const to = next.player.location;
  const t = tc(next);
  let f = next.flags;
  const put = (k: string, v: boolean | number | string) => {
    f = { ...f, [k]: v };
  };
  // 방문 단위 표시는 매 전환마다 초기화
  if (f.hb_b_away === true) put('hb_b_away', false);
  if (st === null || st === 'resolved') return f === next.flags ? next : { ...next, flags: f };

  if (st === 'away_pending' && fromLoc === 'market' && to !== 'market') {
    put('hb_stage', 'posting');
    if (to === 'central_market') {
      put('hb_away_at', t);
      // S01이 끝난 뒤에만 빈 좌판을 보여 준다 (진행 중인 S01 장면은 건드리지 않음)
      if (s01Resolved(next)) put('hb_b_away', true);
    }
  } else if (st === 'posting' && to === 'market') {
    put('hb_stage', 'posted');
    put('hb_up', true);
    put('hb_posts', Number(f.hb_posts ?? 0) + 1);
    put('hb_posted_at', t);
  } else if (st === 'posted' && to === 'central_market') {
    put('hb_stage', 'gm03_window');
    put('hb_window_at', t);
  } else if (st === 'gm03_window' && fromLoc === 'central_market' && to !== 'central_market') {
    put('hb_stage', 'investigating');
  }
  return f === next.flags ? next : { ...next, flags: f };
}

// ── 게시판 ──

const SMEAR = '"그리즐 상자 게임 = 빈 상자 장사. 속지 마라."';
const PAPER_FACT = '벽보 종이는 거친 갈색 영수증 종이다. 한쪽 끝에 절취선이 있다.';
const WET_FACT = '방금 다시 붙은 벽보 — 풀이 아직 마르지 않았다.';

export function hbBoardAugment(state: GameState): { text: string; choices: DialogueChoice[]; nodes: DialogueNode[]; armEffects: GameAction[] } | null {
  const st = hbStage(state);
  if (st === null) {
    if (!eligible(state)) return null;
    // 그리즐을 만난 뒤 처음 게시판을 살펴보면 사건이 시작된다 (어느 선택지든 시작 처리)
    const arm: GameAction[] = [set('hb_stage', 'noticed'), set('hb_up', true), { type: 'SET_QUEST_STAGE', questId: 'q_handbill', stage: 'noticed' }];
    return {
      text: `맨 위에 서명 없는 새 벽보: ${SMEAR}`,
      choices: [{ text: '벽보를 자세히 본다', next: 'hb_paper', effects: [...arm, set('hb_seen_paper', true)] }],
      nodes: [paperNode(false)],
      armEffects: arm,
    };
  }
  if (state.flags.hb_up !== true) {
    return { text: '맨 위, 벽보를 뜯어낸 자리에 풀 자국만 남아 있다.', choices: [], nodes: [], armEffects: [] };
  }
  const wet = st === 'posted' && state.flags.hb_posted_at === tc(state);
  const posts = Number(state.flags.hb_posts ?? 0);
  const tearNext: HbStage = posts >= HB_MAX_POSTS ? 'investigating' : 'away_pending';
  const look: GameAction[] = [set('hb_seen_paper', true)];
  if (wet) look.push(set('hb_seen_wet', true));
  return {
    text: `맨 위에 익명 벽보: ${SMEAR}${wet ? ' 가장자리가 번들거린다.' : ''}`,
    choices: [
      { text: '벽보를 자세히 본다', next: 'hb_paper', effects: look },
      {
        text: '벽보를 뜯어낸다',
        next: 'hb_torn',
        effects: [set('hb_up', false), set('hb_stage', tearNext), { type: 'SET_QUEST_STAGE', questId: 'q_handbill', stage: 'investigating' }],
      },
    ],
    nodes: [
      paperNode(wet),
      {
        id: 'hb_torn',
        speaker: '시장 게시판',
        text:
          posts >= HB_MAX_POSTS
            ? '벽보를 뜯어냈다. 몇 번을 붙였는지, 게시판 모서리가 종이 자국으로 너덜너덜하다.'
            : '벽보를 뜯어냈다. 풀이 아직 끈적하게 남아 있다. ...붙인 사람은 또 붙이러 올까?',
        choices: [{ text: '확인했다' }],
      },
    ],
    armEffects: [],
  };
}

function paperNode(wet: boolean): DialogueNode {
  return {
    id: 'hb_paper',
    speaker: '익명 벽보',
    text: `${SMEAR}\n\n${PAPER_FACT}${wet ? `\n${WET_FACT}` : ''}`,
    choices: [{ text: '기억해 둔다' }],
  };
}

// ── 인물별 추가 선택지 (기존 대화 트리에 끼워 넣는다 — 기존 선택지는 바꾸지 않음) ──

interface Augment {
  choices: DialogueChoice[];
  nodes: DialogueNode[];
}

const resolveWith = (kind: 'evidence' | 'persuaded' | 'bluff' | 'grizzle'): GameAction[] => [
  set('hb_stage', 'resolved'),
  set('hb_resolved', kind),
  set('hb_up', false),
  { type: 'SET_QUEST_STAGE', questId: 'q_handbill', stage: 'resolved' },
];

function resellerAugment(state: GameState): Augment {
  const st = hbStage(state);
  if (st === null) return { choices: [], nodes: [] };
  const f = state.flags;
  const out: Augment = { choices: [], nodes: [] };
  const menu: DialogueChoice[] = [];
  const resolved = st === 'resolved';

  if (!resolved && st === 'gm03_window' && f.hb_window_at === tc(state) && f.hb_seen_hands !== true) {
    menu.push({ text: '손을 슬쩍 살핀다', next: 'hb_hands', effects: [set('hb_seen_hands', true)] });
  }
  if (!resolved && f.hb_seen_pad !== true) {
    menu.push({ text: '계산대를 훑어본다', next: 'hb_pad', effects: [set('hb_seen_pad', true), set('hb_heard_b', true)] });
  }
  if (!resolved && hasEvidence(state)) {
    menu.push({ text: '벽보 흔적을 들이민다', next: 'hb_res_evidence', effects: resolveWith('evidence') });
  }
  if (!resolved && f.s01_rel_B === 'warm' && anyFact(state)) {
    menu.push({ text: '조용히 그만두라고 타이른다', next: 'hb_res_persuaded', effects: resolveWith('persuaded') });
  }
  const failedAt = f.hb_bluff_failed_at;
  if (resolved) {
    // 해결 뒤에는 벽보 메뉴를 열지 않는다
  } else if (typeof failedAt === 'number' && tc(state) <= failedAt) {
    menu.push({ text: '"네가 벽보 붙이는 걸 봤다"고 떠본다', next: 'hb_bluff_wait' });
  } else if (anyFact(state)) {
    menu.push({ text: '"네가 벽보 붙이는 걸 봤다"고 떠본다', next: 'hb_res_bluff', effects: resolveWith('bluff') });
  } else {
    menu.push({ text: '"네가 벽보 붙이는 걸 봤다"고 떠본다', next: 'hb_bluff_fail', effects: [set('hb_bluff_failed_at', tc(state)), set('hb_heard_b', true)] });
  }

  if (!resolved) out.choices = [{ text: '벽보 이야기를 꺼낸다', next: 'hb_menu' }];
  out.nodes.push(
    { id: 'hb_menu', speaker: '되팔이 상인', text: '"벽보? 무슨 벽보?" 되팔이가 눈을 가늘게 뜬다.', choices: [...menu, { text: '그만둔다' }] },
    { id: 'hb_hands', speaker: '되팔이 상인', text: '되팔이가 급히 손을 앞치마에 문지른다. 손가락 마디에 마른 풀 자국이 하얗게 남아 있다.', choices: [{ text: '기억해 둔다' }] },
    {
      id: 'hb_pad',
      speaker: '되팔이 상인',
      text: '계산대 위에 갈색 영수증 묶음이 놓여 있다. 한쪽 끝에 절취선.\n\n"뭘 그렇게 봐? 벽보? 글 쓸 줄 아는 놈이면 누구나 붙이지."',
      choices: [{ text: '기억해 둔다' }],
    },
    {
      id: 'hb_res_evidence',
      speaker: '되팔이 상인',
      text: '"...풀 자국에 종이까지 봤다고?" 되팔이가 입술을 깨문다.\n\n"알았어, 안 붙여. 그 고블린 자리에만 손님이 몰리니까 그랬다고."',
      choices: [{ text: '고개를 끄덕인다' }],
    },
    {
      id: 'hb_res_persuaded',
      speaker: '되팔이 상인',
      text: '되팔이가 한숨을 쉰다. "당신한테까지 들켰으면 끝이지. 그만둘게."\n\n"...그리즐한테는 말하지 말아 줘. 그 정도는 봐줘."',
      choices: [{ text: '알겠다고 한다' }],
    },
    {
      id: 'hb_res_bluff',
      speaker: '되팔이 상인',
      text: '"보, 봤다고? 언제?" 되팔이의 눈이 흔들린다.\n\n"...젠장. 다신 안 붙여. 됐지?"',
      choices: [{ text: '고개를 끄덕인다' }],
    },
    {
      id: 'hb_bluff_fail',
      speaker: '되팔이 상인',
      text: '"그래? 언제, 어디서?" 되팔이가 팔짱을 낀다.\n\n"본 것도 없으면서 사람 잡지 마."',
      choices: [{ text: '물러난다' }],
    },
    {
      id: 'hb_bluff_wait',
      speaker: '되팔이 상인',
      text: '"또 그 소리야? 증거라도 들고 와."\n\n(다른 곳에 다녀온 뒤 다시 떠볼 수 있다.)',
      choices: [{ text: '물러난다' }],
    },
  );
  return out;
}

/** 되팔이가 벽보를 붙이러 자리를 비운 방문 — 빈 좌판만 조사할 수 있다 */
export function hbEmptyStall(state: GameState) {
  if (state.flags.hb_b_away !== true) return null;
  const choices: DialogueChoice[] =
    state.flags.hb_seen_absent === true ? [{ text: '확인했다' }] : [{ text: '기억해 둔다', effects: [set('hb_seen_absent', true)] }];
  return {
    entry: 'root',
    nodes: {
      root: { id: 'root', speaker: '되팔이 상인의 좌판', text: '좌판이 비어 있다. 계산대 위에 늘 있던 영수증 묶음도 보이지 않는다.', choices },
    },
  };
}

function onlookerAugment(state: GameState): Augment {
  const st = hbStage(state);
  const f = state.flags;
  const out: Augment = { choices: [], nodes: [] };
  if (st === null) return out;
  const menu: DialogueChoice[] = [];
  if (f.hb_seen_chalk !== true) {
    menu.push({ text: '손에 묻은 가루를 본다', next: 'hb_chalk', effects: [set('hb_seen_chalk', true)] });
  }
  if (f.hb_away_at === tc(state) && f.hb_seen_alibi !== true) {
    menu.push({ text: '지금 뭘 적고 있었는지 묻는다', next: 'hb_alibi', effects: [set('hb_seen_alibi', true), set('hb_heard_onlooker', true)] });
  }
  if (st !== 'resolved' && f.hb_accused_onlooker !== true) {
    menu.push({
      text: '"벽보 붙인 게 당신이지?"',
      next: 'hb_accused',
      effects: [set('hb_accused_onlooker', true), set('hb_onlooker_rel', 'cold'), set('hb_heard_onlooker', true)],
    });
  }
  if (menu.length > 0) out.choices = [{ text: '벽보 이야기를 꺼낸다', next: 'hb_menu', effects: [set('hb_heard_rumor', true)] }];
  out.nodes.push(
    { id: 'hb_menu', speaker: '구경꾼', text: '"벽보? 아, 그 그리즐 욕하는 거." 구경꾼이 꼬치를 씹는다. "그리즐 상자엔 보물이 없다더라 — 누가 그랬는지는 몰라도."', choices: [...menu, { text: '그만둔다' }] },
    { id: 'hb_chalk', speaker: '구경꾼', text: '구경꾼의 손가락이 흰 분필 가루로 뿌옇다.\n\n"이거? 판돈 적는 거야. 누가 누구한테 걸었는지."', choices: [{ text: '기억해 둔다' }] },
    {
      id: 'hb_alibi',
      speaker: '구경꾼',
      text: '구경꾼이 바닥을 가리킨다. 포석 위에 분필로 적은 판돈 표가 아직 새하얗다.\n\n"아까부터 여기서 이거 적고 있었지. 딴 데 갈 틈이 어딨어."',
      choices: [{ text: '기억해 둔다' }],
    },
    {
      id: 'hb_accused',
      speaker: '구경꾼',
      text: '"내가? 분필 좀 묻었다고?" 구경꾼이 꼬치를 내려놓는다.\n\n"손님, 남 탓부터 하는 버릇은 여기서 금방 소문나."',
      choices: [{ text: '물러난다' }],
    },
  );
  return out;
}

function grizzleAugment(state: GameState): Augment {
  const st = hbStage(state);
  const f = state.flags;
  const out: Augment = { choices: [], nodes: [] };
  if (st === null) return out;
  const pointsAtB = f.hb_seen_pad === true || f.hb_seen_absent === true || f.hb_seen_hands === true;
  const menu: DialogueChoice[] = [];
  if (st !== 'resolved' && pointsAtB) menu.push({ text: '되팔이 상인이 붙인 것 같다고 말한다', next: 'hb_g_tell', effects: resolveWith('grizzle') });
  if (st !== 'resolved') {
    out.choices.push({ text: '게시판 벽보 얘기를 꺼낸다', next: 'hb_g_claim', effects: [set('hb_grizzle_claim', true)] });
  } else if (f.hb_resolved !== 'grizzle' && f.hb_grizzle_told !== true) {
    out.choices.push({ text: '벽보는 이제 안 붙을 거라고 전한다', next: 'hb_g_thanks', effects: [set('hb_grizzle_told', true)] });
  }
  out.nodes.push(
    {
      id: 'hb_g_claim',
      speaker: '그리즐',
      text: '"봤어? 그 종잇조각." 그리즐이 이를 간다.\n\n"누가 내 장사에 침을 뱉고 있어. 붙이는 놈 얼굴만 보면..."',
      choices: [...menu, { text: '고개를 끄덕인다' }],
    },
    {
      id: 'hb_g_tell',
      speaker: '그리즐',
      text: '"그 되팔이 녀석이?!" 그리즐이 좌판을 박차고 일어선다.\n\n"...가서 따져야겠어. 알려 줘서 고맙다, 손님."',
      choices: [{ text: '물러난다' }],
    },
    {
      id: 'hb_g_thanks',
      speaker: '그리즐',
      text: '"누군진 안 물을게. 벽보만 안 붙으면 됐지."\n\n그리즐이 잠시 말을 고르더니 덧붙인다. "...고맙군."',
      choices: [{ text: '고개를 끄덕인다' }],
    },
  );
  return out;
}

/** 대화 트리에 사건 선택지를 끼워 넣는다 — 마지막(중립 종료) 선택지 앞에, 노드는 추가만 */
export function hbAugmentTree<T extends { entry: string; nodes: Record<string, DialogueNode> }>(entityId: string, state: GameState, tree: T): T {
  const aug = entityId === 's01_b' ? resellerAugment(state) : entityId === 's01_onlooker' ? onlookerAugment(state) : entityId === 'goblin' ? grizzleAugment(state) : null;
  if (!aug || (aug.choices.length === 0 && aug.nodes.length === 0)) return tree;
  const root = tree.nodes[tree.entry];
  const choices = [...root.choices];
  choices.splice(Math.max(0, choices.length - 1), 0, ...aug.choices);
  const nodes: Record<string, DialogueNode> = { ...tree.nodes, [tree.entry]: { ...root, choices } };
  for (const n of aug.nodes) if (!nodes[n.id]) nodes[n.id] = n;
  return { ...tree, nodes };
}

// ── 일지 ──

export function hbRecords(state: GameState): { kind: RecordKind; text: string }[] {
  const st = hbStage(state);
  if (st === null) return [];
  const f = state.flags;
  const out: { kind: RecordKind; text: string }[] = [{ kind: 'claim', text: `익명 벽보: ${SMEAR}` }];
  if (f.hb_grizzle_claim === true) out.push({ kind: 'claim', text: '그리즐: "누가 내 장사에 침을 뱉고 있어."' });
  if (f.hb_seen_paper === true) out.push({ kind: 'fact', text: PAPER_FACT });
  if (f.hb_seen_wet === true) out.push({ kind: 'fact', text: WET_FACT });
  if (f.hb_seen_absent === true) out.push({ kind: 'fact', text: '벽보가 다시 붙기 직전, 중앙 장터의 되팔이 상인 좌판이 비어 있었다. 영수증 묶음도 없었다.' });
  if (f.hb_seen_pad === true) out.push({ kind: 'fact', text: '되팔이 상인의 계산대에 갈색 영수증 묶음이 있다. 한쪽 끝에 절취선.' });
  if (f.hb_seen_hands === true) out.push({ kind: 'fact', text: '벽보가 다시 붙은 뒤, 되팔이 상인의 손가락에 마른 풀 자국이 있었다.' });
  if (f.hb_seen_chalk === true) out.push({ kind: 'fact', text: '구경꾼의 손가락이 흰 분필 가루로 뿌옇다.' });
  if (f.hb_seen_alibi === true) out.push({ kind: 'fact', text: '벽보가 붙던 무렵, 구경꾼은 중앙 장터 바닥에 분필로 판돈 표를 적고 있었다.' });
  if (f.hb_heard_b === true) out.push({ kind: 'claim', text: '되팔이 상인: "글 쓸 줄 아는 놈이면 누구나 붙이지."' });
  if (f.hb_heard_onlooker === true) out.push({ kind: 'claim', text: '구경꾼: "난 판돈 적는 중이었어."' });
  if (f.hb_heard_rumor === true) out.push({ kind: 'rumor', text: '구경꾼: "그리즐 상자엔 보물이 없다더라 — 누가 그랬는지는 몰라도."' });
  if (f.hb_accused_onlooker === true) {
    out.push({ kind: 'inference', text: '내 판단: 구경꾼을 의심해 따졌다.' });
    out.push({ kind: 'rumor', text: '구경꾼: "손님, 남 탓부터 하는 버릇은 여기서 금방 소문나."' });
  }
  const r = f.hb_resolved;
  if (r === 'evidence') out.push({ kind: 'inference', text: '내 판단: 벽보는 되팔이 상인이 붙였다. 흔적을 들이밀자 그만두겠다고 했다.' });
  if (r === 'persuaded') out.push({ kind: 'inference', text: '내 판단: 벽보는 되팔이 상인이 붙였다. 조용히 타일러 그만두게 했다.' });
  if (r === 'bluff') out.push({ kind: 'inference', text: '내 판단: 벽보는 되팔이 상인이 붙였다. 본 척 떠보자 넘어왔다.' });
  if (r === 'grizzle') out.push({ kind: 'inference', text: '내 판단: 벽보는 되팔이 상인이 붙였다. 그리즐에게 그렇게 말했다.' });
  return out;
}
