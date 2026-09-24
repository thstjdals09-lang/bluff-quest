/**
 * 이벤트 장면 정의 (MODE D) — 중요한 발견·사건을 별도 연출 화면으로 보여준다.
 * 지금은 텍스트·아이콘 기반이며, 이후 장면별 일러스트를 image 필드로 연결한다.
 */
export interface EventDef {
  id: string;
  icon: string;
  title: string;
  text: string;
  /** 향후 고퀄리티 일러스트 연결용 (현재 미사용 가능) */
  image?: string;
  footnote?: string;
  /** 플래그 조건부 본문 — 조건을 만족하는 첫 변형이 text를 대신한다 */
  variants?: { flag: string; text: string }[];
}

export const EVENTS: Record<string, EventDef> = {
  found_invitation: {
    id: 'found_invitation',
    icon: '✉️',
    title: '수상한 초대장',
    text: '"진짜 승부사만 오라.\n사기꾼들의 항구, 밤의 부두에서 — 비밀 경기가 열린다."\n\n먼지 쌓인 궤짝 속에서 밀랍 인장이 찍힌 초대장을 발견했다. 이 시장 너머, 더 큰 판이 기다리고 있다.\n\n누가 이걸 빈 창고에 둔 걸까.',
    footnote: '월드맵에서 사기꾼들의 항구가 해금되었다.',
  },
  warehouse_opened: {
    id: 'warehouse_opened',
    icon: '🗝️',
    title: '오래된 창고',
    text: '낡은 열쇠가 자물쇠에 꼭 맞아 들어갔다.\n삐걱— 몇 년 만에 창고 문이 열린다.\n\n먼지 냄새 사이로, 달빛이 바닥의 궤짝 하나를 비추고 있다.',
    footnote: '새로운 장소가 열렸다.',
  },
};

EVENTS.port_arrival = {
  id: 'port_arrival',
  icon: '⚓',
  title: '사기꾼들의 항구',
  text: '소금기 밴 바람, 삐걱대는 밧줄, 물 위에 흔들리는 등불.\n\n카드 문양 돛을 단 배들이 어둠 속에 정박해 있다. 여기서는 모든 거래에 이면이 있다고 했다.\n\n초대장이 가리킨 곳 — 밤의 부두다.',
  footnote: '새로운 지역에 도착했다. 메인 이야기가 이어진다.',
  variants: [
    {
      // 그리즐의 항구 경고를 실제로 들은 경우에만, 무주체 소문 대신 그 말을 떠올린다
      flag: 'heard_grizzle_port_warning',
      text: '소금기 밴 바람, 삐걱대는 밧줄, 물 위에 흔들리는 등불.\n\n카드 문양 돛을 단 배들이 어둠 속에 정박해 있다. 그리즐이 그랬지 — 항구 놈들 판은 시장이랑 격이 다르다고.\n\n초대장이 가리킨 곳 — 밤의 부두다.',
    },
  ],
};

EVENTS.invitation_back = {
  id: 'invitation_back',
  icon: '🂠',
  title: '초대장의 뒷면',
  text: '등불에 비추자, 초대장 뒷면에 감춰져 있던 문구가 천천히 떠오른다.\n\n"당신에게 아직 끝나지 않은 승부가 있습니다."\n\n받는 사람의 이름은 어디에도 없다.',
  footnote: '사실 확인: 초대장은 특정한 이름이 아니라 \'자리\'에 보내진 것이다.',
};

EVENTS.prologue_opening = {
  id: 'prologue_opening',
  icon: '🌙',
  title: '{name}',
  text: '달빛 아래 흙길. 가벼운 주머니와 낡은 가방 하나.\n\n길 끝, 붉은 등불이 걸린 문 너머에서\n호객 소리와 환호성이 바람에 실려 온다.\n\n고블린 시장 — 누구나 말과 패를 무기로 승부하는 곳.',
  footnote: '아직 아무도 모르는 이름이다.',
};

EVENTS.prologue_card = {
  id: 'prologue_card',
  icon: '🂡',
  title: '낡은 스페이드 카드',
  text: '풀숲 사이, 달빛에 무언가 반짝인다.\n\n낡은 스페이드 에이스 한 장. 흔한 카드다 — 뒤집기 전까지는.\n\n뒷면에, 긁어 쓴 듯한 글씨:\n"이 카드를 보여주는 사람을 믿지 마라."\n\n누가 흘렸을까. 누가 적었을까. 무엇을 경고하는 걸까.',
  footnote: '낡은 스페이드 카드를 가방에 넣었다.',
};

EVENTS.market_firstlook = {
  id: 'market_firstlook',
  icon: '🏮',
  title: '고블린 시장',
  text: '문을 지나자 소음이 쏟아진다.\n\n"골라 골라! 진짜 용의 비늘! 아마도!"\n"방금 네가 속인 거잖아!" "속은 쪽이 진 거지!"\n어디선가 환호성 — 누군가 크게 딴 모양이다.\n\n거짓말과 흥정과 웃음이 뒤섞인 밤 시장.\n여기서라면, 이름 없는 승부사도 이야기를 시작할 수 있을 것 같다.',
  footnote: '고블린 시장에 도착했다. 자유롭게 탐험해 보자.',
};

export function getEventById(id: string): EventDef | undefined {
  return EVENTS[id];
}

/** 이벤트 본문을 현재 플래그에 맞춰 고른다 (variants가 없으면 기본 text) */
export function resolveEventText(ev: EventDef, flags: Record<string, unknown>): string {
  const v = ev.variants?.find((x) => flags[x.flag] === true);
  return v ? v.text : ev.text;
}
