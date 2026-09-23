import type { DialogueNode, GameState } from '../types';

export interface DialogueTree {
  entry: string;
  nodes: Record<string, DialogueNode>;
}

/**
 * NPC/조사 대상 상호작용 트리를 상태 기반으로 생성한다.
 * 대사와 분기는 콘텐츠 데이터로 관리하고, 상태 변경은 effects(GameAction)로만 일으킨다.
 */
export function getInteraction(entityId: string, state: GameState): DialogueTree {
  switch (entityId) {
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
    case 'exit_door':
      return {
        entry: 'root',
        nodes: {
          root: {
            id: 'root',
            speaker: '',
            text: '시장으로 돌아간다.',
            choices: [
              { text: '나가기', effects: [{ type: 'GOTO_LOCATION', locationId: 'market', x: 3, y: 1 }] },
              { text: '더 둘러본다' },
            ],
          },
        },
      };
    default:
      return {
        entry: 'root',
        nodes: { root: { id: 'root', speaker: '', text: '특별한 것은 없다.', choices: [{ text: '확인' }] } },
      };
  }
}

function goblinDialogue(state: GameState): DialogueTree {
  const npc = state.npcs.goblin;
  const won = state.quest.completed.includes('boxes') || state.quest.stage === 'find_lock';

  if (state.flags.found_invitation) {
    return tree('그리즐', '"창고까지 털어갔다고?! ...뭐, 초대장이라. 항구 놈들 판은 여기랑 격이 달라. 몸조심하라고, 애송이."', [
      { text: '씩 웃어 보인다' },
    ]);
  }
  if (won && state.inventory.includes('old_key') && !state.flags.warehouse_opened) {
    return tree('그리즐', '"그 낡은 열쇠? 난 모르는 물건이야. ...굳이 말하자면, 이 시장에서 자물쇠 달린 문은 하나뿐이지." 그리즐이 동쪽 창고 쪽으로 턱짓한다.', [
      { text: '고맙다고 한다' },
      { text: '다시 대결을 청한다', startEncounter: true },
    ]);
  }
  if (npc?.caughtLying) {
    return tree('그리즐', '"...넌 눈빛이 마음에 안 들어. 고블린 속을 들여다보는 인간이라니." 그리즐이 경계하며 상자 뒤로 반쯤 숨는다. "한 판 더 하겠다면 말리진 않겠어. 이번엔 어림없을걸."', [
      { text: '다시 대결한다', startEncounter: true },
      { text: '나중에 다시 온다' },
    ]);
  }
  if (npc?.fooledPlayer) {
    return tree('그리즐', '"어이, 호구 왔네! 크크큭. 아직도 상자가 궁금해? 재도전은 언제든 환영이야. 네 금화는 언제나 환영이니까!"', [
      { text: '다시 대결한다', startEncounter: true },
      { text: '이를 갈며 물러난다' },
    ]);
  }
  if ((npc?.meetCount ?? 0) === 0) {
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
  }
  return tree('그리즐', '"또 왔네. 상자는 언제나 준비돼 있어. 도전할 배짱이 생겼나?"', [
    { text: '대결한다', startEncounter: true },
    { text: '아직이다' },
  ]);
}

function miraDialogue(state: GameState): DialogueTree {
  if (state.flags.found_invitation) {
    return tree('약초상 미라', '"그 초대장... 사기꾼들의 항구 인장이네. 거긴 여기 고블린들이 순진해 보일 정도로 험한 곳이야. 가려거든 단단히 준비하렴." (다음 지역은 추후 개발 예정)', [
      { text: '고맙다고 한다' },
    ]);
  }
  if (state.flags.lost_to_goblin && state.flags.mira_hint !== true) {
    return {
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
  }
  if ((state.npcs.mira?.meetCount ?? 0) === 0) {
    return tree('약초상 미라', '"어서 와. 못 보던 얼굴이네." 약초 냄새가 은은하게 퍼진다. "그리즐의 상자 게임에는 함부로 덤비지 마. 걔 말은 참일 때도, 거짓일 때도 있거든. 그리고... 저 동쪽 창고 말이야, 몇 년째 잠겨 있는데 열쇠를 본 사람이 없어."', [
      { text: '조언 고맙다', effects: [{ type: 'NPC_MET', npcId: 'mira' }] },
    ]);
  }
  return tree('약초상 미라', '"필요한 게 있으면 언제든 들르렴. 시장 소문은 대부분 내 귀를 거쳐 가니까."', [
    { text: '인사하고 물러난다' },
  ]);
}

function boardInteraction(state: GameState): DialogueTree {
  const extra = state.flags.read_manifest
    ? ''
    : ' 문양의 생김새를 기억해 두었다.';
  return tree(
    '시장 게시판',
    `공고문이 붙어 있다. "도난 화물 주의 — 항구에서 밀수 인장(⚓ 문양)이 찍힌 상자들이 사라짐. 발견 시 신고 바람."${extra}`,
    [{ text: '확인했다', effects: [{ type: 'SET_FLAG', key: 'read_manifest', value: true }] }],
  );
}

function cratesInteraction(state: GameState): DialogueTree {
  if (state.flags.lost_to_goblin) {
    return tree('부서진 상자 더미', '부서진 상자 틈에 낙서가 있다. "그리즐은 손님이 오기 전에 꼭 상자를 다시 옮긴다. 바닥 자국을 봐라. — 어느 패배자"', [
      { text: '유용한 정보다' },
    ]);
  }
  return tree('부서진 상자 더미', '그리즐의 게임에서 나온 빈 상자들이 쌓여 있다. 꽤 많은 사람이 도전했다 빈손으로 돌아간 모양이다.', [
    { text: '확인했다' },
  ]);
}

function warehouseDoorInteraction(state: GameState): DialogueTree {
  if (state.unlocked.includes('warehouse')) {
    return tree('오래된 창고', '창고 문이 열려 있다.', [
      { text: '들어간다', effects: [{ type: 'GOTO_LOCATION', locationId: 'warehouse', x: 2, y: 4 }] },
      { text: '돌아선다' },
    ]);
  }
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
              text: '문을 연다',
              next: 'opened',
              effects: [
                { type: 'UNLOCK', id: 'warehouse' },
                { type: 'SET_FLAG', key: 'warehouse_opened', value: true },
                { type: 'SET_QUEST_STAGE', stage: 'open_warehouse' },
              ],
            },
            { text: '아직 열지 않는다' },
          ],
        },
        opened: {
          id: 'opened',
          speaker: '오래된 창고',
          text: '삐걱— 문이 열렸다. 먼지 냄새와 함께 어둑한 실내가 드러난다.',
          choices: [
            { text: '들어간다', effects: [{ type: 'GOTO_LOCATION', locationId: 'warehouse', x: 2, y: 4 }] },
            { text: '나중에 들어간다' },
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
            effects: [
              { type: 'ADD_ITEM', itemId: 'invitation' },
              { type: 'SET_FLAG', key: 'found_invitation', value: true },
              { type: 'SET_QUEST_STAGE', stage: 'done' },
            ],
          },
        ],
      },
    },
  };
}

function tree(speaker: string, text: string, choices: DialogueNode['choices']): DialogueTree {
  return { entry: 'root', nodes: { root: { id: 'root', speaker, text, choices } } };
}
