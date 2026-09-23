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

export function getEventById(id: string): EventDef | undefined {
  return EVENTS[id];
}
