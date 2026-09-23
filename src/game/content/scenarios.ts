import type { EncounterScenario } from '../types';

/**
 * 고블린 상자 대결 시나리오 풀.
 * - 고블린의 공개 주장은 항상 "왼쪽 상자에는 보물이 없어." (GDD 확정 대사)
 * - 주장이 참인 시나리오와 거짓인 시나리오가 모두 존재한다.
 * - 모든 단서는 내부 상태(보물 위치, 고블린의 지식·목적)와 논리적으로 일관된다.
 * - 다른 NPC 대결도 EncounterScenario 형식으로 추가하면 같은 엔진으로 동작한다.
 */
export const GOBLIN_SCENARIOS: EncounterScenario[] = [
  {
    id: 'greedy_liar',
    npcId: 'goblin',
    boxes: ['treasure', 'junk', 'empty'],
    npcKnowsLocation: true,
    npcBelievedIndex: 0,
    npcGoal: 'keep_treasure',
    goalDesc: '보물이 든 왼쪽 상자를 지키고 싶어서 거짓말을 한다.',
    statement: {
      text: '왼쪽 상자에는 보물이 없어.',
      isTrue: false,
      reason: '보물은 왼쪽에 있다. 그리즐은 보물을 넘기기 싫어 왼쪽에서 시선을 돌리려 한다.',
    },
    clues: {
      ask_boxes: {
        text: '"왼쪽? 왼쪽은 볼 것도 없다니까! 가운데가... 아니 오른쪽이 좀 무겁던데?" 그리즐이 유난히 왼쪽 얘기를 서둘러 끝내려 한다.',
        devNote: '왼쪽을 필사적으로 배제하려 함 → 왼쪽이 수상하다는 단서.',
      },
      ask_motive: {
        text: '"왜 이런 내기를 하냐고? 그냥... 심심해서지!" 그리즐의 손가락이 왼쪽 상자 자물쇠를 만지작거리다가 황급히 떨어진다.',
        devNote: '무의식적으로 왼쪽 상자를 보호하는 몸짓.',
      },
      observe: {
        text: '그리즐은 네가 가운데나 오른쪽 상자를 볼 때는 태연하지만, 왼쪽 상자 쪽으로 몸을 기울이자 눈썹이 씰룩인다.',
        devNote: '왼쪽에 반응 → 왼쪽에 뭔가 있다.',
      },
      inspect: {
        text: '바닥을 보니 왼쪽 상자 앞에만 끌린 자국이 선명하다. 최근에 누가 조심스럽게 옮겨 놓은 듯하다.',
        devNote: '왼쪽 상자만 최근에 다뤄짐 → 값진 것이 들었을 가능성.',
      },
    },
    reveal:
      '보물은 왼쪽 상자에 있었다. 그리즐은 위치를 정확히 알고 있었고, 보물을 넘기기 싫어 "왼쪽엔 없다"고 거짓말했다. 왼쪽에 대한 과잉 반응과 끌린 자국이 단서였다.',
  },
  {
    id: 'honest_hustler',
    npcId: 'goblin',
    boxes: ['empty', 'treasure', 'junk'],
    npcKnowsLocation: true,
    npcBelievedIndex: 1,
    npcGoal: 'win_wager',
    goalDesc: '플레이어가 자신을 의심해 틀리기를 바라며, 일부러 진실을 말한다(역심리).',
    statement: {
      text: '왼쪽 상자에는 보물이 없어.',
      isTrue: true,
      reason: '왼쪽은 실제로 비어 있다. 고블린은 "고블린은 거짓말쟁이"라는 편견을 역이용해 네가 왼쪽을 고르길 바란다.',
    },
    clues: {
      ask_boxes: {
        text: '"왼쪽은 정말 비었어. 믿거나 말거나." 그리즐의 목소리는 이상하리만큼 담담하고, 시선도 흔들리지 않는다.',
        devNote: '진실을 말할 때의 안정된 태도.',
      },
      ask_motive: {
        text: '"사람들은 고블린 말이라면 무조건 반대로 하지. 그게 내 밥줄이야." 그리즐이 이빨을 드러내며 웃는다.',
        devNote: '역심리 전략을 스스로 암시 — 주장이 진실일 가능성.',
      },
      observe: {
        text: '그리즐은 왼쪽 상자에는 눈길조차 주지 않는다. 대신 네 표정만 뚫어져라 살핀다.',
        devNote: '왼쪽에 무관심 = 정말 빈 상자. 플레이어의 불신을 기다림.',
      },
      inspect: {
        text: '왼쪽 상자 위에는 먼지가 뽀얗게 쌓여 있다. 반면 가운데 상자의 자물쇠에는 최근 기름칠한 흔적이 반질거린다.',
        devNote: '가운데 상자만 최근 관리됨 → 가운데에 보물.',
      },
    },
    reveal:
      '보물은 가운데 상자에 있었다. 그리즐의 주장은 진실이었다. 그는 "고블린은 거짓말한다"는 편견을 역이용하려 했다. 왼쪽의 먼지와 가운데 자물쇠의 기름칠이 단서였다.',
  },
  {
    id: 'clueless_bluffer',
    npcId: 'goblin',
    boxes: ['empty', 'junk', 'treasure'],
    npcKnowsLocation: false,
    npcBelievedIndex: 1,
    npcGoal: 'show_off',
    goalDesc: '사실 밀수업자에게 받은 상자라 내용물을 모른다. 아는 척해서 대단해 보이고 싶을 뿐이다.',
    statement: {
      text: '왼쪽 상자에는 보물이 없어.',
      isTrue: true,
      reason: '우연히 맞는 말이지만 근거 없는 추측이다. 그리즐 본인은 가운데에 보물이 있다고 잘못 믿고 있다.',
    },
    clues: {
      ask_boxes: {
        text: '"왼쪽엔 없고... 가운데가 제일 무거웠나? 아니 오른쪽이었나?" 그리즐의 설명이 물을 때마다 조금씩 달라진다.',
        devNote: '진술이 오락가락 → 사실은 모른다.',
      },
      ask_motive: {
        text: '"이 몸은 시장에서 제일 눈썰미 좋은 고블린이라고! ...아마도." 그리즐이 품속의 구겨진 쪽지를 슬쩍 훔쳐본다.',
        devNote: '남의 쪽지에 의존 → 스스로는 정보가 없음.',
      },
      observe: {
        text: '그리즐은 세 상자를 번갈아 보며 자기도 궁금하다는 표정을 짓는다. 특정 상자를 의식하는 기색이 없다.',
        devNote: '어느 상자에도 반응 없음 → 위치를 모름. 그의 말은 참고할 가치가 낮다.',
      },
      inspect: {
        text: '오른쪽 상자 옆면에 항구의 밀수 인장이 찍혀 있다. 시장 게시판의 도난 화물 공고에서 본 것과 같은 문양이다.',
        devNote: '물리 단서가 오른쪽을 가리킴 — 고블린의 말보다 환경 단서가 결정적.',
      },
    },
    reveal:
      '보물은 오른쪽 상자에 있었다. 그리즐은 사실 위치를 몰랐고, 아는 척했을 뿐이다. 그의 말은 우연히 맞았지만 근거가 없었다. 오락가락하는 진술과 오른쪽 상자의 밀수 인장이 진짜 단서였다.',
  },
  {
    id: 'wager_liar',
    npcId: 'goblin',
    boxes: ['treasure', 'empty', 'junk'],
    npcKnowsLocation: true,
    npcBelievedIndex: 0,
    npcGoal: 'win_wager',
    goalDesc: '틀린 선택을 유도해 내기에서 이기려고 정면으로 거짓말한다.',
    statement: {
      text: '왼쪽 상자에는 보물이 없어.',
      isTrue: false,
      reason: '보물은 왼쪽에 있다. 내기에서 이기려면 네가 왼쪽만 피하면 되기에, 가장 단순한 거짓말을 골랐다.',
    },
    clues: {
      ask_boxes: {
        text: '"왼쪽은 텅 비었대도! 대신 가운데를 잘 봐. 감이 오지 않아?" 그리즐이 지나치게 친절하게 가운데를 권한다.',
        devNote: '특정 상자(가운데)로 유도 → 유도 반대편이 수상.',
      },
      ask_motive: {
        text: '"네가 틀리면 구경꾼들이 웃겠지? 그림이 좋잖아." 그리즐이 내기 자체에 잔뜩 신이 나 있다.',
        devNote: '목적이 "네가 틀리는 것" → 주장을 뒤집어 들을 이유.',
      },
      observe: {
        text: '네 손이 왼쪽 상자 근처로 갈 때마다 그리즐의 말이 빨라지고 목소리가 한 옥타브 올라간다.',
        devNote: '왼쪽 접근에 초조 → 왼쪽이 정답.',
      },
      inspect: {
        text: '왼쪽 상자의 자물쇠만 이중으로 채워져 있다. 빈 상자에 자물쇠를 두 개나 채울 이유가 있을까?',
        devNote: '왼쪽만 과잉 보안 → 값진 내용물.',
      },
    },
    reveal:
      '보물은 왼쪽 상자에 있었다. 그리즐은 내기에서 이기려고 정면으로 거짓말했다. 왼쪽 접근에 대한 초조함과 이중 자물쇠가 단서였다.',
  },
];

export function getScenarioById(id: string): EncounterScenario | undefined {
  return GOBLIN_SCENARIOS.find((s) => s.id === id);
}
