import type { DialogueChoice, DialogueNode, ExitDef, GameState } from '../types';
import { exitDestinationLabel, getExit, getFutureWay, isExitOpen } from './navigation';
import { FAVOR_CART_ID, favorCartInteraction, favorGrizzleChoices, favorGrizzleNodes, favorStallInteraction } from './favor';
import { s01Interaction } from './s01';
import { hbAugmentTree, hbBoardAugment, hbEmptyStall } from './handbill';
import { fxAugmentFin } from './finExchange';

export interface DialogueTree {
  entry: string;
  nodes: Record<string, DialogueNode>;
}

/**
 * 대화 진행 중 표시할 노드를 결정한다.
 * 선택지의 효과가 분기 조건(플래그·만남 횟수)을 바꾸면 새로 계산한 트리에서
 * 다음 노드가 사라질 수 있으므로, 최신 트리에 없으면 직전까지 본 트리(snapshot)의 노드를 쓴다.
 * 최신 트리를 우선해 구매 후 메뉴처럼 상태가 반영되어야 하는 노드는 갱신된다.
 */
export function resolveDialogueNode(
  entityId: string,
  state: GameState,
  nodeId: string,
  snapshot: DialogueTree | null,
): DialogueNode {
  const fresh = getInteraction(entityId, state);
  return fresh.nodes[nodeId] ?? snapshot?.nodes[nodeId] ?? fresh.nodes[fresh.entry];
}

/**
 * NPC/조사 대상 상호작용 트리를 상태 기반으로 생성한다.
 * - 대사·분기는 콘텐츠 데이터, 상태 변경은 effects(GameAction)로만.
 * - NPC는 각자의 목적에 따라 정보를 공개하거나 숨긴다(스토리 바이블 원칙 A).
 * - 플레이어의 접근 방식(캐묻기/우회 조사)에 따라 공개 장면과 관계가 달라진다.
 */
export function getInteraction(entityId: string, state: GameState): DialogueTree {
  // 출입구: 이야기가 걸린 문은 전용 대화, 나머지는 공통 출입구 대화
  const exit = getExit(state.player.location, entityId);
  if (exit && !hasExitStoryHook(entityId, state)) return exitTree(state, exit);
  const way = getFutureWay(state.player.location, entityId);
  if (way) {
    // 막힌 길은 막힌 채로 둔다 — 그리즐의 부탁 중에는 수레 짐꾼과의 대화만 추가된다
    const fav = entityId === FAVOR_CART_ID ? favorCartInteraction(state, way.label, way.lockedHint) : null;
    return fav ?? tree(way.label, way.lockedHint, [{ text: '물러난다' }]);
  }
  if (entityId === 's01_b') {
    const empty = hbEmptyStall(state);
    if (empty) return empty;
  }
  const s01 = s01Interaction(entityId, state);
  if (s01) return hbAugmentTree(entityId, state, s01);
  switch (entityId) {
    case 'old_card':
      return oldCardInteraction(state);
    case 'gate_merchant':
      return gateMerchantDialogue(state);
    case 'market_gate':
      return marketGateInteraction(state);
    case 'goblin':
      return goblinDialogue(state);
    case 'mira':
      return miraDialogue(state);
    case 'board':
      return boardInteraction(state);
    case 'crates':
      return cratesInteraction(state);
    case 'warehouse_door':
      return warehouseDoorInteraction(state);
    case 'chest':
      return chestInteraction(state);
    case 'ledger_scrap':
      return ledgerInteraction(state);
    case 'fin':
      return fxAugmentFin(state, finDialogue(state));
    case 'pier_notice':
      return pierNoticeInteraction(state);
    case 'cargo':
      return cargoInteraction(state);
    case 'tavern_door':
      return tree(
        '선술집 문',
        '문틈으로 왁자지껄한 내기 소리와 잔 부딪히는 소리가 새어 나온다. 문지기가 팔짱을 낀다. "오늘은 단골만 받아. 낯선 얼굴은 다음에." (선술집 내부는 추후 개발)',
        [{ text: '물러선다' }],
      );
    default:
      return tree('', '특별한 것은 없다.', [{ text: '확인' }]);
  }
}

// ── 출입구 ─────────────────────────────────────────────────────

/**
 * 이야기가 걸린 출입구인지 — 이 경우 공통 이동 대신 전용 대화를 연다.
 * - 프롤로그 진행 중 시장 문: 시장 첫인상 연출·프롤로그 완료 처리
 * - 잠긴 창고 문: 열쇠를 쓰는 기존 사건
 */
export function hasExitStoryHook(entityId: string, state: GameState): boolean {
  if (entityId === 'market_gate') {
    const q = state.quests.q_prologue;
    return q !== undefined && q.stage !== 'done';
  }
  if (entityId === 'warehouse_door') return !state.unlocked.includes('warehouse');
  return false;
}

/** 출입구를 대화 없이 바로 지날 수 있는지 (열려 있고 이야기가 걸려 있지 않음) */
export function canPassExitDirectly(entityId: string, state: GameState): boolean {
  const exit = getExit(state.player.location, entityId);
  return exit !== undefined && isExitOpen(exit, state) && !hasExitStoryHook(entityId, state);
}

/** 공통 출입구 대화 — 목적지 확인 후 이동, 또는 잠긴 이유 안내 */
function exitTree(state: GameState, exit: ExitDef): DialogueTree {
  const dest = exitDestinationLabel(state.player.location, exit);
  if (!isExitOpen(exit, state)) {
    return tree(dest, exit.lockedHint ?? '지금은 지나갈 수 없다.', [{ text: '물러난다' }]);
  }
  return tree(dest, `${exit.direction}쪽 — ${dest}(으)로 이어진다.`, [
    { text: '이동한다', effects: [{ type: 'USE_EXIT', entityId: exit.entityId }] },
    { text: '머무른다' },
  ]);
}

// ── 프롤로그: 시장으로 가는 길 ───────────────────────────────────

/**
 * 프롤로그 퀘스트 단계 진행 효과 — 프롤로그를 진행 중인 새 모험에서만 적용한다.
 * 기존(프롤로그 도입 전) 세이브의 플레이어가 나중에 길을 되돌아와 카드를 발견해도
 * 이미 끝난 도입부 퀘스트가 새로 생겨나지 않도록 한다.
 */
function prologueStep(state: GameState, stage: string): NonNullable<DialogueChoice['effects']> {
  const q = state.quests.q_prologue;
  if (!q || q.stage === 'done') return [];
  return [{ type: 'SET_QUEST_STAGE', questId: 'q_prologue', stage }];
}

function oldCardInteraction(state: GameState): DialogueTree {
  if (state.flags.prologue_card === true) {
    return tree('', '카드를 주웠던 자리다. 풀숲 너머로 시장의 불빛만 흔들린다.', [{ text: '확인했다' }]);
  }
  return tree('', '길가 풀숲 사이에서 무언가 달빛을 받아 반짝인다. 카드 한 장이 흙에 반쯤 묻혀 있다.', [
    {
      text: '주워서 살펴본다',
      event: 'prologue_card',
      effects: [
        { type: 'ADD_ITEM', itemId: 'old_spade_card' },
        { type: 'SET_FLAG', key: 'prologue_card', value: true },
        ...prologueStep(state, 'card'),
      ],
    },
    { text: '그냥 지나간다' },
  ]);
}

function gateMerchantDialogue(state: GameState): DialogueTree {
  const f = state.flags;
  const hasCard = state.inventory.includes('old_spade_card');

  if (f.gate_merchant_met === true) {
    return tree('입구의 상인', '"물건 안 살 거면 비켜, 비켜. 난 지금 바빠." 상인은 눈을 맞추지 않은 채 수레의 냄비만 쓸데없이 다시 정리한다.', [
      { text: '물러선다' },
    ]);
  }

  if (!hasCard) {
    // 카드를 줍지 않고 온 경우 — 평범한 호객만 한다 (반응 사건은 발생하지 않음)
    return tree('입구의 상인', '"어이, 여행자! 시장 들어가기 전에 냄비 하나 어때? 안에서 사면 두 배야. 고블린들이 괜히 고블린이겠어?" 상인이 수레를 탕탕 두드린다.', [
      { text: '괜찮다며 지나간다', effects: [{ type: 'NPC_MET', npcId: 'gate_merchant' }] },
    ]);
  }

  return {
    entry: 'root',
    nodes: {
      root: {
        id: 'root',
        speaker: '입구의 상인',
        text: '"어이, 여행자! 시장 들어가기 전에 냄비 하나—" 상인의 말이 뚝 끊긴다. 시선이 네 손, 아니 네가 쥔 카드에 꽂혀 있다.\n\n"...그 카드. 어디서 났어?"',
        choices: [
          {
            text: '"길에서 주웠다."',
            next: 'backpedal',
            effects: [
              { type: 'NPC_MET', npcId: 'gate_merchant' },
              { type: 'SET_FLAG', key: 'gate_merchant_met', value: true },
              { type: 'SET_FLAG', key: 'gate_merchant_answer', value: 'told' },
              ...prologueStep(state, 'merchant'),
            ],
          },
          {
            text: '"이게 뭔지 아는가?" — 되묻는다',
            next: 'backpedal',
            effects: [
              { type: 'NPC_MET', npcId: 'gate_merchant' },
              { type: 'SET_FLAG', key: 'gate_merchant_met', value: true },
              { type: 'SET_FLAG', key: 'gate_merchant_answer', value: 'asked' },
              ...prologueStep(state, 'merchant'),
            ],
          },
          {
            text: '대답하지 않고 카드를 품에 넣는다',
            next: 'backpedal',
            effects: [
              { type: 'NPC_MET', npcId: 'gate_merchant' },
              { type: 'SET_FLAG', key: 'gate_merchant_met', value: true },
              { type: 'SET_FLAG', key: 'gate_merchant_answer', value: 'hid' },
              ...prologueStep(state, 'merchant'),
            ],
          },
        ],
      },
      backpedal: {
        id: 'backpedal',
        speaker: '입구의 상인',
        text: '상인이 헛기침을 한다. 안경을 고쳐 쓰는 손이 조금 떨린다.\n\n"...아니야. 내가 잘못 봤네. 그런 건 처음 봐."\n\n그러고는 묻지도 않은 냄비 가격을 중얼거리며, 수레를 돌려 등을 보인다. 대화는 거기서 끝이다.',
        choices: [{ text: '...시장으로 들어가자' }],
      },
    },
  };
}

/** 프롤로그 진행 중에만 쓰이는 시장 문 대화 (이후에는 공통 출입구로 처리) */
function marketGateInteraction(state: GameState): DialogueTree {
  const effects: NonNullable<DialogueChoice['effects']> = [
    { type: 'USE_EXIT', entityId: 'market_gate' },
    ...prologueStep(state, 'done'),
    { type: 'SET_FLAG', key: 'prologue_done', value: true },
  ];
  const text = state.flags.prologue_card !== true
    ? '붉은 등불이 걸린 시장 문. 문틈으로 호객 소리와 환호성이 새어 나온다. ...그런데 방금 지나온 길가에서 뭔가 반짝이지 않았나?'
    : '붉은 등불이 걸린 시장 문. 문틈으로 호객 소리와 환호성, 누군가 흥정에 이겼다고 소리치는 목소리가 새어 나온다.';
  return tree('고블린 시장 입구', text, [
    { text: '시장으로 들어간다', event: 'market_firstlook', effects },
    { text: '조금 더 둘러본다' },
  ]);
}

// ── 그리즐 ─────────────────────────────────────────────────────

function goblinDialogue(state: GameState): DialogueTree {
  const npc = state.npcs.goblin;
  const won = (state.quests.q_invitation?.completed ?? []).includes('boxes');
  const f = state.flags;

  let base: DialogueTree;

  if (f.found_invitation) {
    base = tree('그리즐', '"창고까지 털어갔다고?! ...뭐, 초대장이라. 항구 놈들 판은 여기랑 격이 달라. 몸조심하라고, 애송이."', [
      { text: '다시 대결을 청한다', startEncounter: true, effects: [{ type: 'SET_FLAG', key: 'heard_grizzle_port_warning', value: true }] },
      { text: '씩 웃어 보인다', effects: [{ type: 'SET_FLAG', key: 'heard_grizzle_port_warning', value: true }] },
    ]);
  } else if (won && state.inventory.includes('old_key') && !f.warehouse_opened) {
    base = tree('그리즐', '"그 낡은 열쇠? 난 모르는 물건이야. ...굳이 말하자면, 이 시장에서 자물쇠 달린 문은 하나뿐이지." 그리즐이 동쪽 창고 쪽으로 턱짓한다.', [
      { text: '다시 대결을 청한다', startEncounter: true },
      { text: '고맙다고 한다' },
    ]);
  } else if (npc?.caughtLying) {
    base = tree('그리즐', '"...넌 눈빛이 마음에 안 들어. 고블린 속을 들여다보는 인간이라니." 그리즐이 경계하며 상자 뒤로 반쯤 숨는다. "한 판 더 하겠다면 말리진 않겠어. 이번엔 어림없을걸."', [
      { text: '다시 대결한다', startEncounter: true },
      { text: '나중에 다시 온다' },
    ]);
  } else if (npc?.fooledPlayer) {
    base = tree('그리즐', '"어이, 호구 왔네! 크크큭. 아직도 상자가 궁금해? 재도전은 언제든 환영이야. 네 금화는 언제나 환영이니까!"', [
      { text: '다시 대결한다', startEncounter: true },
      { text: '이를 갈며 물러난다' },
    ]);
  } else if ((npc?.meetCount ?? 0) === 0) {
    return {
      entry: 'root',
      nodes: {
        root: {
          id: 'root',
          speaker: '그리즐',
          text: '"어서 와, 낯선 얼굴! 나는 그리즐. 이 시장에서 제일 정직한 고블린이지." 좌판 위에 세 개의 상자가 놓여 있다. "심심하던 참인데... 게임 하나 어때? 상자 하나를 골라 봐. 맞히면 안의 물건은 네 거야."',
          choices: [
            { text: '상자 게임을 해 본다', startEncounter: true, effects: [{ type: 'NPC_MET', npcId: 'goblin' }] },
            { text: '무슨 속셈인지 묻는다', next: 'motive', effects: [{ type: 'NPC_MET', npcId: 'goblin' }] },
            { text: '자리를 뜬다', effects: [{ type: 'NPC_MET', npcId: 'goblin' }] },
          ],
        },
        motive: {
          id: 'motive',
          speaker: '그리즐',
          text: '"속셈? 크크. 시장 바닥에서 공짜로 뭘 기대하는 것부터가 순진한 거야. ...그래도 이 게임은 진짜야. 상자 안 물건도, 내 말도. 뭐, 내 말을 어디까지 믿을지는 네 몫이지만."',
          choices: [
            { text: '좋다, 해 보자', startEncounter: true },
            { text: '생각해 보겠다' },
          ],
        },
      },
    };
  } else if (f.gf_stage === 'returned') {
    // 부탁 경로를 거친 손님: 대결 승자와는 다른 사회적 반응 (마지못한 신뢰)
    base = tree('그리즐', '"오, 상자 찾아 준 손님이군." 그리즐이 상자를 탁탁 두드린다. "경품은 줄 만큼 줬어. 더 가져가고 싶으면 이번엔 승부로 가져가 보든가."', [
      { text: '대결한다', startEncounter: true },
      { text: '아직이다' },
    ]);
  } else {
    base = tree('그리즐', '"또 왔네. 상자는 언제나 준비돼 있어. 도전할 배짱이 생겼나?"', [
      { text: '대결한다', startEncounter: true },
      { text: '아직이다' },
    ]);
  }

  // ── 검은 칩 이야기: 대결을 한 번이라도 치른 뒤에만 열린다 ──
  const knownEnough = f.chip_asked_mira === true || f.ledger_clue === true;

  if (state.career.duels >= 1 && f.chip_seen !== true) {
    base.nodes.root.choices.splice(base.nodes.root.choices.length - 1, 0, {
      text: '좌판 구석의 검은 칩을 살펴본다',
      next: 'chip_look',
      effects: [
        { type: 'SET_FLAG', key: 'chip_seen', value: true },
        { type: 'SET_QUEST_STAGE', questId: 'q_black_chip', stage: 'noticed' },
      ],
    });
  }
  if (f.chip_done === undefined && knownEnough && f.chip_seen === true) {
    base.nodes.root.choices.splice(base.nodes.root.choices.length - 1, 0, {
      text: '친구와의 약속에 대해 조심스럽게 이야기를 꺼낸다',
      next: f.chip_pressed === true ? 'chip_resolve_cold' : 'chip_resolve_warm',
    });
  } else if (f.chip_refused === true && f.chip_pressed !== true && !knownEnough && f.chip_done === undefined) {
    base.nodes.root.choices.splice(base.nodes.root.choices.length - 1, 0, {
      text: '검은 칩을 왜 안 파는지 캐묻는다',
      next: 'chip_press',
      effects: [{ type: 'SET_FLAG', key: 'chip_pressed', value: true }],
    });
  }

  // ── 그리즐의 부탁 (창고 열쇠의 대결 외 경로) ──
  for (const c of favorGrizzleChoices(state)) {
    base.nodes.root.choices.splice(base.nodes.root.choices.length - 1, 0, c);
  }
  for (const n of favorGrizzleNodes(state)) base.nodes[n.id] = n;

  if (f.asked_grizzle_king !== true) {
    base.nodes.root.choices.splice(base.nodes.root.choices.length - 1, 0, {
      text: '왕고블린에 대해 묻는다',
      next: 'king',
      effects: [
        { type: 'SET_FLAG', key: 'asked_grizzle_king', value: true },
        { type: 'SET_FLAG', key: 'heard_goblin_king', value: true },
      ],
    });
  }
  base = hbAugmentTree('goblin', state, base);
  base.nodes.king = {
    id: 'king',
    speaker: '그리즐',
    text: '"왕고블린 님?! 시장의 전설이지! 무패! 무적! 흥정 한 번에 성 하나를 샀다는 분이라고!" 그리즐이 가슴을 편다. 그러다 목소리를 낮춘다. "...근데 그 양반 앞에서 내 이름은 꺼내지 마. 지난번 판에서 내 좌판 절반을 걸었거든. 크흠."',
    choices: [{ text: '웃음을 참는다' }],
  };

  base.nodes.chip_look = {
    id: 'chip_look',
    speaker: '',
    text: '금화 더미 옆, 벨벳 천 위에 칩 하나가 따로 놓여 있다. 장식도 문양도 없는 새까만 칩. 시선을 알아챈 그리즐의 손이 슬쩍 칩 앞을 가린다.',
    choices: [
      {
        text: '"저 검은 칩, 얼마면 팔 건가?"',
        next: 'chip_refuse',
        effects: [
          { type: 'SET_FLAG', key: 'chip_refused', value: true },
          { type: 'SET_QUEST_STAGE', questId: 'q_black_chip', stage: 'refused' },
        ],
      },
      { text: '못 본 척 넘어간다' },
    ],
  };
  base.nodes.chip_refuse = {
    id: 'chip_refuse',
    speaker: '그리즐',
    text: '"......" 방금까지 금화 소리만 나면 눈을 반짝이던 그리즐의 얼굴이 굳는다. "이건 비매품이야. 뭘 줘도 안 팔아. 백 닢을 쌓아도, 천 닢을 쌓아도." ...돈이라면 사족을 못 쓰는 고블린이, 값도 듣지 않고 거절했다.',
    choices: [
      {
        text: '"돈을 마다하다니, 너답지 않은데?" — 캐묻는다',
        next: 'chip_press',
        effects: [{ type: 'SET_FLAG', key: 'chip_pressed', value: true }],
      },
      { text: '"알겠어." — 물러선다 (다른 데서 알아보자)' },
    ],
  };
  base.nodes.chip_press = {
    id: 'chip_press',
    speaker: '그리즐',
    text: '"나답지 않다고? 네가 나에 대해 뭘 알아!" 그리즐이 칩을 낚아채 품에 넣는다. "남의 사정에 코 박지 마. 오늘 장사는 여기까지야." ...건드리면 안 되는 무언가를 건드린 모양이다.',
    choices: [{ text: '물러선다' }],
  };
  base.nodes.chip_resolve_warm = {
    id: 'chip_resolve_warm',
    speaker: '그리즐',
    text: '그리즐이 한참 말이 없다가, 칩을 꺼내 벨벳 천 위에 올린다. "...옛날에 같이 장사하던 녀석이 있었어. 어느 날 이걸 맡기면서 그러더군. \'누가 찾아와도 모른다고 해.\' 그리고 사라졌지." 그리즐이 너를 빤히 본다. "약속은 약속이야. 근데 너는... 왜 그 사람을 찾으려는 거야?"',
    choices: [
      {
        text: '"사라진 사람의 행방이 궁금하다."',
        effects: [
          { type: 'SET_FLAG', key: 'chip_done', value: 'warm' },
          { type: 'SET_FLAG', key: 'chip_motive', value: 'search' },
          { type: 'SET_QUEST_STAGE', questId: 'q_black_chip', stage: 'done' },
        ],
      },
      {
        text: '"약속이라면, 나도 모른 걸로 하지."',
        effects: [
          { type: 'SET_FLAG', key: 'chip_done', value: 'warm' },
          { type: 'SET_FLAG', key: 'chip_motive', value: 'keep' },
          { type: 'SET_QUEST_STAGE', questId: 'q_black_chip', stage: 'done' },
        ],
      },
    ],
  };
  base.nodes.chip_resolve_cold = {
    id: 'chip_resolve_cold',
    speaker: '그리즐',
    text: '"...어디서 주워들었는지 모르겠지만." 그리즐이 낮게 으르렁댄다. "그래, 약속이야. 사라진 친구가 맡긴 거고, 난 지킬 거야. 그 이상은 못 들려줘 — 다짜고짜 캐묻던 놈한테는 더더욱." 그리즐은 다시 손님을 부르기 시작했지만, 목소리에 가시가 남아 있다.',
    choices: [
      {
        text: '알겠다며 물러선다',
        effects: [
          { type: 'SET_FLAG', key: 'chip_done', value: 'cold' },
          { type: 'SET_QUEST_STAGE', questId: 'q_black_chip', stage: 'done' },
        ],
      },
    ],
  };

  return base;
}

// ── 미라 ───────────────────────────────────────────────────────

function miraDialogue(state: GameState): DialogueTree {
  const f = state.flags;
  const met = (state.npcs.mira?.meetCount ?? 0) > 0;

  let base: DialogueTree;

  if (f.lost_to_goblin === true && f.mira_hint !== true) {
    base = {
      entry: 'root',
      nodes: {
        root: {
          id: 'root',
          speaker: '약초상 미라',
          text: '"그리즐한테 당했구나? 표정에 다 쓰여 있어." 미라가 약초를 빻으며 웃는다. "비결 하나 알려줄까?"',
          choices: [
            { text: '알려 달라', next: 'hint', effects: [{ type: 'NPC_MET', npcId: 'mira' }] },
            { text: '괜찮다', effects: [{ type: 'NPC_MET', npcId: 'mira' }] },
          ],
        },
        hint: {
          id: 'hint',
          speaker: '약초상 미라',
          text: '"고블린의 \'말\'을 믿을지 말지를 고민하지 말고, 고블린의 \'몸\'을 봐. 말은 꾸며도 몸은 거짓말이 서툴거든. 다음 대결에서는 내 조언을 기억해." (다음 대결 시작 시 무료 단서가 제공됩니다)',
          choices: [{ text: '기억해 두겠다', effects: [{ type: 'SET_FLAG', key: 'mira_hint', value: true }] }],
        },
      },
    };
  } else if (!met) {
    base = tree('약초상 미라', '"어서 와. 못 보던 얼굴이네." 약초 냄새가 은은하게 퍼진다. "그리즐의 상자 게임에는 함부로 덤비지 마. 걔 말은 참일 때도, 거짓일 때도 있거든. 그리고... 저 동쪽 창고 말이야, 몇 년째 잠겨 있는데 열쇠를 본 사람이 없어."', [
      { text: '조언 고맙다', effects: [{ type: 'NPC_MET', npcId: 'mira' }] },
    ]);
  } else if (state.career.duels >= 2 && f.mira_slip !== true) {
    // 딜러 시절의 말버릇이 무심코 새어 나온다
    base = {
      entry: 'root',
      nodes: {
        root: {
          id: 'root',
          speaker: '약초상 미라',
          text: '"그리즐이랑 벌써 몇 판째야? 저쪽이 레이즈하는 척할 땐 콜보다 폴드가... " 미라가 말을 뚝 멈춘다. "...아니, 약초 얘기였어. 말린 콜, 폴드 잎."',
          choices: [
            {
              text: '"방금 그 말투, 약초상 것이 아닌데."',
              next: 'slip',
              effects: [
                { type: 'SET_FLAG', key: 'mira_slip', value: true },
                { type: 'SET_QUEST_STAGE', questId: 'q_mira_past', stage: 'slip' },
              ],
            },
            { text: '못 들은 척한다' },
          ],
        },
        slip: {
          id: 'slip',
          speaker: '약초상 미라',
          text: '미라가 잠깐 손을 멈췄다가, 다시 약초를 빻는다. "...옛날에 판 구경을 좀 했어. 그게 다야." 시선은 절구에 두고 있지만, 손놀림이 아까보다 빠르다.',
          choices: [{ text: '더 묻지 않는다' }],
        },
      },
    };
  } else if (f.found_invitation === true && f.mira_admitted !== true) {
    base = tree('약초상 미라', '"그 초대장... 사기꾼들의 항구 인장이네. 거긴 여기 고블린들이 순진해 보일 정도로 험한 곳이야. 가려거든 단단히 준비하렴."', [
      { text: '고맙다고 한다' },
    ]);
  } else {
    base = tree('약초상 미라', '"필요한 게 있으면 언제든 들르렴. 시장 소문은 대부분 내 귀를 거쳐 가니까."', [
      { text: '인사하고 물러난다' },
    ]);
  }

  // ── 왕고블린에 대한 다른 시각 ──
  if (met && f.asked_mira_king !== true) {
    base.nodes.root.choices.splice(base.nodes.root.choices.length - 1, 0, {
      text: '왕고블린에 대해 묻는다',
      next: 'king',
      effects: [
        { type: 'SET_FLAG', key: 'asked_mira_king', value: true },
        { type: 'SET_FLAG', key: 'heard_goblin_king', value: true },
      ],
    });
    base.nodes.king = {
      id: 'king',
      speaker: '약초상 미라',
      text: '"무패? 흠." 미라가 코웃음을 친다. "지는 판엔 안 앉는 것도 실력이라면 실력이지. 그 양반한테 망신당한 도전자가 한둘이 아니야. 다들 말로 먼저 지고 들어가거든." 그녀가 약초를 한 줌 집어 든다. "언젠가 붙어 보고 싶으면, 시장에서 이름부터 알려. 그 양반은 이름 없는 상대랑은 안 놀아."',
      choices: [{ text: '기억해 두겠다' }],
    };
  }

  // ── 과거 캐묻기: 말버릇을 들킨 뒤에만 ──
  if (f.mira_slip === true && f.mira_admitted !== true) {
    base.nodes.root.choices.splice(base.nodes.root.choices.length - 1, 0, {
      text: '"판 구경이 아니라... 딜러였던 거지?"',
      next: 'admit',
    });
    base.nodes.admit = {
      id: 'admit',
      speaker: '약초상 미라',
      text: '긴 침묵. 미라가 절굿공이를 내려놓는다. "...맞아. 한때는 판을 진행하는 쪽이었어. 여러 지역을 돌면서." 그녀가 처음으로 승부사의 눈으로 너를 본다. "왜 그만뒀는지는 묻지 마. 그건... 아직 나도 정리가 안 됐으니까. 약초나 사, 손님."',
      choices: [
        {
          text: '고개를 끄덕인다',
          effects: [
            { type: 'SET_FLAG', key: 'mira_admitted', value: true },
            { type: 'SET_QUEST_STAGE', questId: 'q_mira_past', stage: 'done' },
          ],
        },
      ],
    };
  }

  // ── 검은 칩 묻기: 칩을 본 뒤에만 ──
  if (f.chip_seen === true && f.chip_asked_mira !== true) {
    base.nodes.root.choices.splice(base.nodes.root.choices.length - 1, 0, {
      text: '그리즐의 검은 칩에 대해 묻는다',
      next: 'chip',
    });
    base.nodes.chip = {
      id: 'chip',
      speaker: '약초상 미라',
      text: '"...그 칩을 봤구나." 미라의 손이 멈춘다. 잠깐이지만, 분명히. "저건 좌판에 둘 물건이 아니야. 그리즐은 안 파는 게 아니라 못 파는 거야. 사라진 친구가 맡긴 거니까." 그녀가 목소리를 낮춘다. "...내가 말했다고는 하지 마. 그리고 그 애한테 다짜고짜 캐물을 생각도 말고. 그리즐은 약속을 지키는 중이니까."',
      choices: [
        {
          text: '"왜 칩을 보고 그런 표정을 하지?"',
          next: 'chip_flinch',
          effects: [
            { type: 'SET_FLAG', key: 'chip_asked_mira', value: true },
            { type: 'SET_FLAG', key: 'mira_chip_flinch', value: true },
            { type: 'SET_QUEST_STAGE', questId: 'q_black_chip', stage: 'inquiry' },
          ],
        },
        {
          text: '조언대로 조심스럽게 접근하겠다',
          effects: [
            { type: 'SET_FLAG', key: 'chip_asked_mira', value: true },
            { type: 'SET_QUEST_STAGE', questId: 'q_black_chip', stage: 'inquiry' },
          ],
        },
      ],
    };
    base.nodes.chip_flinch = {
      id: 'chip_flinch',
      speaker: '약초상 미라',
      text: '"......아무것도 아니야." 미라는 다시 약초를 빻기 시작한다. 하지만 방금 그 표정은, 처음 보는 물건을 본 사람의 것이 아니었다.',
      choices: [{ text: '기억해 둔다' }],
    };
  }

  return base;
}

// ── 시장 조사 대상 ─────────────────────────────────────────────

function boardInteraction(state: GameState): DialogueTree {
  const base = boardBase(state);
  const hb = hbBoardAugment(state);
  if (!hb) return base;
  // 벽보 사건 중에는 루트를 짧게: 기존 공고문(⚓·포스터)은 한 단계 안쪽 'notice' 노드로 그대로 옮긴다
  // (모바일에서 긴 본문 + 선택지 넷이 화면 밖으로 밀리지 않게)
  const arm = (c: DialogueChoice): DialogueChoice => (hb.armEffects.length ? { ...c, effects: [...(c.effects ?? []), ...hb.armEffects] } : c);
  const notice: DialogueNode = { ...base.nodes.root, id: 'notice', choices: base.nodes.root.choices.map(arm) };
  const root: DialogueNode = {
    id: 'root',
    speaker: '시장 게시판',
    text: `공고문과 포스터가 겹겹이 붙어 있다.\n${hb.text}`,
    choices: [arm({ text: '공고문을 읽는다', next: 'notice' }), ...hb.choices, arm({ text: '물러난다' })],
  };
  const nodes: Record<string, DialogueNode> = { ...base.nodes, root, notice };
  for (const n of hb.nodes) nodes[n.id] = n;
  return { entry: 'root', nodes };
}

function boardBase(state: GameState): DialogueTree {
  const extra = state.flags.read_manifest ? '' : ' 문양의 생김새를 기억해 두었다.';
  return {
    entry: 'root',
    nodes: {
      root: {
        id: 'root',
        speaker: '시장 게시판',
        text: `공고문과 포스터가 겹겹이 붙어 있다.\n\n"도난 화물 주의 — 항구에서 밀수 인장(⚓ 문양)이 찍힌 상자들이 사라짐. 발견 시 신고 바람."${extra}\n\n그 위를 반쯤 덮은, 빛바랜 금박 포스터 한 장.`,
        choices: [
          {
            text: '금박 포스터를 읽는다',
            next: 'poster',
            effects: [{ type: 'SET_FLAG', key: 'read_manifest', value: true }],
          },
          { text: '확인했다', effects: [{ type: 'SET_FLAG', key: 'read_manifest', value: true }] },
        ],
      },
      poster: {
        id: 'poster',
        speaker: '빛바랜 포스터',
        text: '"시장의 절대 군주! 무패의 흥정왕! 왕고블린에게 도전할 자 — 없음!"\n\n포스터 아래, 서로 다른 필체의 낙서들:\n"진짜 무패임. 우리 삼촌도 털림."\n"도전하러 갔다가 신발까지 잃고 옴 — 어느 인간"\n"왕고블린님 만세 (이거 왕고블린이 직접 씀)"',
        choices: [
          { text: '...언젠가 만나 보고 싶다', effects: [{ type: 'SET_FLAG', key: 'heard_goblin_king', value: true }] },
        ],
      },
    },
  };
}

function cratesInteraction(state: GameState): DialogueTree {
  const fav = favorStallInteraction(state);
  if (fav) return fav;
  if (state.flags.lost_to_goblin === true) {
    return tree('부서진 상자 더미', '부서진 상자 틈에 낙서가 있다. "그리즐은 손님이 오기 전에 꼭 상자를 다시 옮긴다. 바닥 자국을 봐라. — 어느 패배자"', [
      { text: '유용한 정보다' },
    ]);
  }
  return tree('부서진 상자 더미', '그리즐의 게임에서 나온 빈 상자들이 쌓여 있다. 꽤 많은 사람이 도전했다 빈손으로 돌아간 모양이다.', [
    { text: '확인했다' },
  ]);
}

function warehouseDoorInteraction(state: GameState): DialogueTree {
  if (state.inventory.includes('old_key')) {
    return {
      entry: 'root',
      nodes: {
        root: {
          id: 'root',
          speaker: '오래된 창고',
          text: '녹슨 자물쇠가 걸려 있다. ...낡은 열쇠를 꽂아 보니 돌아간다!',
          choices: [
            {
              text: '문을 열고 들어간다',
              event: 'warehouse_opened',
              effects: [
                { type: 'UNLOCK', id: 'warehouse' },
                { type: 'SET_FLAG', key: 'warehouse_opened', value: true },
                { type: 'SET_QUEST_STAGE', questId: 'q_invitation', stage: 'open_warehouse' },
                // 문이 열리면 한 번 더 말을 걸 필요 없이 기존 출입구 전환으로 바로 들어간다
                { type: 'USE_EXIT', entityId: 'warehouse_door' },
              ],
            },
            { text: '아직 열지 않는다' },
          ],
        },
      },
    };
  }
  return tree('오래된 창고', '단단한 자물쇠가 걸려 있다. 이 자물쇠에 맞는 열쇠가 어딘가에 있을 것이다.', [
    { text: '물러난다' },
  ]);
}

function chestInteraction(state: GameState): DialogueTree {
  if (state.flags.found_invitation) {
    return tree('먼지 쌓인 궤짝', '이미 비어 있는 궤짝이다. 초대장은 이미 손에 넣었다.', [{ text: '확인했다' }]);
  }
  return {
    entry: 'root',
    nodes: {
      root: {
        id: 'root',
        speaker: '먼지 쌓인 궤짝',
        text: '오래된 궤짝이다. 뚜껑을 열자 밀랍 인장이 찍힌 봉투가 나온다.',
        choices: [{ text: '봉투를 집는다', next: 'letter' }],
      },
      letter: {
        id: 'letter',
        speaker: '수상한 초대장',
        text: '"진짜 승부사만 오라. 사기꾼들의 항구, 밤의 부두에서 — 비밀 경기가 열린다." ...이 시장 너머에 더 큰 판이 기다리고 있다.',
        choices: [
          {
            text: '초대장을 챙긴다',
            event: 'found_invitation',
            effects: [
              { type: 'ADD_ITEM', itemId: 'invitation' },
              { type: 'SET_FLAG', key: 'found_invitation', value: true },
              { type: 'SET_QUEST_STAGE', questId: 'q_invitation', stage: 'done' },
            ],
          },
        ],
      },
    },
  };
}

function ledgerInteraction(state: GameState): DialogueTree {
  if (state.flags.ledger_clue === true) {
    return tree('선반의 낡은 장부', '물에 불어 붙어버린 장부 조각이다. 이미 읽을 수 있는 부분은 다 읽었다.', [
      { text: '확인했다' },
    ]);
  }
  const effects: DialogueChoice['effects'] = [{ type: 'SET_FLAG', key: 'ledger_clue', value: true }];
  // 검은 칩 조사가 시작된 경우에만 퀘스트 단계로 연결 (그 전엔 앞선 복선으로만 남는다)
  if (state.quests.q_black_chip && state.quests.q_black_chip.stage !== 'done') {
    effects.push({ type: 'SET_QUEST_STAGE', questId: 'q_black_chip', stage: 'inquiry' });
  }
  return tree(
    '선반의 낡은 장부',
    '선반 밑에서 물에 불은 장부 조각을 발견했다. 번진 잉크 사이로 몇 글자가 읽힌다.\n\n"…그리즐, 상자 셋 값 지불 완료. 서명: ▓▓▓▓…"\n\n서명 자리는 잉크가 번진 게 아니라, 일부러 문지른 것처럼 지워져 있다. 여백에 작은 스페이드 무늬 낙서.',
    [{ text: '기억해 둔다', effects }],
  );
}

// ── 항구: 부두 ─────────────────────────────────────────────────

function pierNoticeInteraction(state: GameState): DialogueTree {
  if (state.flags.pier_rumor === true) {
    return tree('부두 게시판', '찾는 사람 벽보들. "\'금손\' 다로 — 석 달째 소식 없음." 그 아래 누군가 낙서를 갈겨 놓았다: "달 없는 밤, 부두 끝." ...낙서는 볼 때마다 조금씩 늘어나 있다.', [
      { text: '확인했다' },
    ]);
  }
  return tree(
    '부두 게시판',
    '소금기에 절은 벽보들이 겹겹이 붙어 있다.\n\n"찾는 사람 — \'금손\' 다로. 석 달째 소식 없음. 선원 일동."\n"찾는 사람 — 이름 모름. 검은 돛 배에서 내린 뒤 행방불명."\n\n...이름난 승부사들이 소식을 끊었다는 벽보가 유독 많다. 맨 아래 작은 낙서: "요즘 부두에서 초대장 얘기 꺼내는 놈들은 죄다 낚시꾼이다."',
    [{ text: '기억해 둔다', effects: [{ type: 'SET_FLAG', key: 'pier_rumor', value: true }] }],
  );
}

function cargoInteraction(state: GameState): DialogueTree {
  const seenManifest = state.flags.read_manifest === true;
  return tree(
    '하역된 밀수 화물',
    seenManifest
      ? '방수포 아래 상자마다 닻(⚓) 인장이 찍혀 있다. ...고블린 시장 게시판의 도난 화물 공고에서 본 바로 그 문양이다. 시장의 도난 화물이 이 부두를 거쳐 가는 모양이다.'
      : '방수포 아래로 상자들이 쌓여 있다. 상자마다 닻(⚓) 모양 인장. 어디선가 본 것 같기도 한데... 기억나지 않는다.',
    [
      {
        text: seenManifest ? '연결 고리를 기억해 둔다' : '확인했다',
        effects: [{ type: 'SET_FLAG', key: 'cargo_checked', value: seenManifest ? 'linked' : 'seen' }],
      },
    ],
  );
}

// ── 항구: 정보상 올드 핀 ────────────────────────────────────────

function finDialogue(state: GameState): DialogueTree {
  const f = state.flags;
  const met = (state.npcs.fin?.meetCount ?? 0) > 0;
  const nodes: Record<string, DialogueNode> = {};
  let entry: string;

  if (!met) {
    entry = 'first';
    nodes.first = {
      id: 'first',
      speaker: '정보상 올드 핀',
      text: '두루마리와 봉인된 편지가 널린 좌대 뒤에서, 늙은 뱃사람이 너를 천천히 훑어본다. 금니가 반짝인다.\n\n"처음 보는 얼굴이 밤의 부두엔 웬일로? 흐음... 그 주머니에서 스페이드 냄새가 나는데. 초대장... 이지?"',
      choices: [
        ...(f.pier_rumor === true
          ? [
              {
                text: '"게시판 소문 보고 아무나 떠보는 거잖아. 낚시꾼."',
                next: 'called',
                effects: [
                  { type: 'NPC_MET', npcId: 'fin' },
                  { type: 'SET_FLAG', key: 'fin_bluff_called', value: true },
                  { type: 'SET_QUEST_STAGE', questId: 'q_night_pier', stage: 'informant' },
                ],
              } satisfies DialogueChoice,
            ]
          : []),
        {
          text: '"...어떻게 알았지?"',
          next: 'fell',
          effects: [
            { type: 'NPC_MET', npcId: 'fin' },
            { type: 'SET_FLAG', key: 'invitation_confirmed_to_fin', value: true },
            { type: 'SET_QUEST_STAGE', questId: 'q_night_pier', stage: 'informant' },
          ],
        },
        {
          text: '"무슨 소린지 모르겠는데."',
          next: 'deny',
          effects: [
            { type: 'NPC_MET', npcId: 'fin' },
            { type: 'SET_QUEST_STAGE', questId: 'q_night_pier', stage: 'informant' },
          ],
        },
      ],
    };
    nodes.called = {
      id: 'called',
      speaker: '정보상 올드 핀',
      text: '"...하!" 핀이 무릎을 친다. "눈썰미 좋군. 그래, 반은 낚시였다. 부두에서 공짜로 주어지는 건 미끼뿐이거든." 그가 좌대 위로 몸을 숙인다. "마음에 들었어, 애송이. 간파의 값은 쳐 주지. 골라 봐."',
      choices: [{ text: '거래를 들어본다', next: 'menu' }],
    };
    nodes.fell = {
      id: 'fell',
      speaker: '정보상 올드 핀',
      text: '"어떻게 알았냐고?" 핀이 씩 웃는다. "몰랐지. 방금 네 얼굴이 대답해 주기 전까지는." ...넘겨짚기에 제대로 걸려들었다. "뭐, 기죽지 마. 부두에 처음 온 놈들은 다 한 번씩 걸리니까. 자, 장사 얘기나 할까."',
      choices: [{ text: '거래를 들어본다', next: 'menu' }],
    };
    nodes.deny = {
      id: 'deny',
      speaker: '정보상 올드 핀',
      text: '"그럼 말고." 핀이 어깨를 으쓱한다. 눈은 여전히 네 주머니 근처를 맴돈다. "손님은 손님이니까. 부두 소문부터 비싼 얘기까지, 값만 치르면 다 있어."',
      choices: [{ text: '거래를 들어본다', next: 'menu' }],
    };
  } else {
    entry = 'menu_root';
    let greet: string;
    if (state.quests.q_night_pier?.stage === 'done') {
      greet = f.invitation_shown === true
        ? '"어이, \'자리\'의 주인 나리." 핀이 금니를 드러낸다. "네 초대장 얘기, 벌써 값이 좀 나가더군. 부두에 비밀은 없다니까." ...보여준 대가는 소문이 되어 돌고 있다. "다음 판 소식이 들리면 알려주지." (비밀 경기는 추후 개발)'
        : '"어이, 또 왔군." 핀이 고개를 까딱인다. "밤의 부두 판 소식이 들리면 제일 먼저 알려주지. 값은 그때 정하고." (비밀 경기는 추후 개발)';
    } else {
      greet = '"또 왔군, 애송이. 뭘 사러 왔나 — 소문? 비밀? 아니면 용기?"';
    }
    nodes.menu_root = {
      id: 'menu_root',
      speaker: '정보상 올드 핀',
      text: greet,
      choices: [{ text: '거래를 들어본다', next: 'menu' }, { text: '지나간다' }],
    };
  }

  // ── 거래 메뉴 ──
  const menuChoices: DialogueChoice[] = [];
  menuChoices.push({ text: '공짜 소문을 듣는다', next: 'info_free' });
  if (f.night_pier_hint !== true) {
    if (f.fin_bluff_called === true) {
      menuChoices.push({
        text: '간파의 값 — 밤의 부두 이야기를 청한다 (무료)',
        next: 'info_deep',
        effects: deepInfoEffects(state),
      });
    } else if (state.player.gold >= 5) {
      menuChoices.push({
        text: '금화 5닢 — 밤의 부두 이야기를 산다',
        next: 'info_deep',
        effects: [{ type: 'ADD_GOLD', amount: -5 }, ...deepInfoEffects(state)],
      });
    }
  }
  if (state.inventory.includes('invitation') && f.invitation_shown !== true) {
    menuChoices.push({
      text: '초대장을 직접 보여준다 (위험: 소문이 돌 수 있다)',
      event: 'invitation_back',
      effects: [
        { type: 'SET_FLAG', key: 'invitation_shown', value: true },
        { type: 'SET_FLAG', key: 'invitation_meaning_known', value: 'fact' },
        { type: 'SET_QUEST_STAGE', questId: 'q_night_pier', stage: 'done' },
      ],
    });
  }
  menuChoices.push({ text: '오늘은 여기까지' });

  nodes.menu = {
    id: 'menu',
    speaker: '정보상 올드 핀',
    text: '"규칙은 하나야. 정보에는 값이 있다." 핀이 손가락으로 좌대를 두드린다. "금화로 내든, 배짱으로 내든, 네 패를 까서 내든 — 뭘 내놓을지는 네가 정해."',
    choices: menuChoices,
  };
  nodes.info_free = {
    id: 'info_free',
    speaker: '정보상 올드 핀',
    text: '"공짜 소문이라... 좋지." 핀이 목을 가다듬는다. "선술집 문지기 녀석, 주사위 내기 3연패라 심기가 사나워. 오늘은 낯선 얼굴 안 받을 거다. 그리고 뱃사람들 사이에 도는 얘기 — 요즘 이름난 승부사들이 하나둘 소식을 끊는대. 배를 탄 것도 아닌데 말이야." 그가 씩 웃는다. "여기까지는 공짜."',
    choices: [
      { text: '다른 것도 듣는다', next: 'menu' },
      { text: '충분하다', effects: [{ type: 'SET_QUEST_STAGE', questId: 'q_night_pier', stage: 'wager' }] },
    ],
  };
  nodes.info_deep = {
    id: 'info_deep',
    speaker: '정보상 올드 핀',
    text: '핀이 주위를 살피고는 목소리를 낮춘다.\n\n"달 없는 밤, 부두 끝 창고 너머에서 판이 열려. 자리는 초대장 수만큼만. 근데 제일 웃긴 게 뭔 줄 알아? 그 초대장엔 이름이 없다는 거야. 종이를 쥔 놈이 곧 그 \'자리\'라는 거지. 원래 누구 자리였는지는... 아무도 안 물어. 그게 부두의 예의거든."\n\n...초대장에 이름이 없다는 것. 어디까지가 사실인지는 아직 핀의 말일 뿐이다.',
    choices: [{ text: '값어치 있는 이야기다', next: 'menu' }],
  };

  return { entry, nodes };
}

function deepInfoEffects(state: GameState): NonNullable<DialogueChoice['effects']> {
  const effects: NonNullable<DialogueChoice['effects']> = [
    { type: 'SET_FLAG', key: 'night_pier_hint', value: true },
  ];
  if (state.flags.invitation_meaning_known === undefined) {
    effects.push({ type: 'SET_FLAG', key: 'invitation_meaning_known', value: 'claim' });
  }
  effects.push({ type: 'SET_QUEST_STAGE', questId: 'q_night_pier', stage: 'done' });
  return effects;
}

function tree(speaker: string, text: string, choices: DialogueNode['choices']): DialogueTree {
  return { entry: 'root', nodes: { root: { id: 'root', speaker, text, choices } } };
}
