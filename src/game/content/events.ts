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
}

export const EVENTS: Record<string, EventDef> = {
  found_invitation: {
    id: 'found_invitation',
    icon: '✉️',
    title: '수상한 초대장',
    text: '"진짜 승부사만 오라.\n사기꾼들의 항구, 밤의 부두에서 — 비밀 경기가 열린다."\n\n먼지 쌓인 궤짝 속에서 밀랍 인장이 찍힌 초대장을 발견했다. 이 시장 너머, 더 큰 판이 기다리고 있다.',
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
};

EVENTS.invitation_back = {
  id: 'invitation_back',
  icon: '🂠',
  title: '초대장의 뒷면',
  text: '등불에 비추자, 초대장 뒷면에 감춰져 있던 문구가 천천히 떠오른다.\n\n"당신에게 아직 끝나지 않은 승부가 있습니다."\n\n받는 사람의 이름은 어디에도 없다.',
  footnote: '사실 확인: 초대장은 특정한 이름이 아니라 \'자리\'에 보내진 것이다.',
};

export function getEventById(id: string): EventDef | undefined {
  return EVENTS[id];
}
