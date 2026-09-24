import type { DialogueNode } from '../types';

/**
 * W0 셸 장소의 대상들 — 이야기와 무관한 생활감 한 줄만.
 * 스토리 사실·단서·기록·플래그를 만들지 않는다 (장소 방문과 사건 진행은 별개).
 * 각 장의 이야기가 구현되면 해당 대상의 대화가 이 한 줄을 대신한다.
 */
const LINES: Record<string, [string, string]> = {
  casino_sign: ['낡은 영업 안내판', '"영업 종료" 위에 누군가 "영업 중"이라고 덧써 놓았다. 그 위에 또 "종료".'],
  casino_porter: ['투덜대는 유령 짐꾼', '"짐 날라 줄까? 산 사람 짐은 무거워서 싫은데." 유령이 투덜대며 빈 수레를 민다.'],
  replay_table: ['빈 테이블', '빈 테이블 위로 칩이 저절로 미끄러진다. 누군가의 옛 판이 되풀이되는 모양이다.'],
  replay_ghost: ['옛 손님', '"손님이 늦었으니 패를 다시 섞을 필요도 없지." 옛 손님이 혼잣말을 하며 허공에 칩을 건다.'],
  sealed_drawers: ['봉인된 서랍장', '서랍마다 봉인 끈이 묶여 있다. 억지로 열 방법은 없어 보인다.'],
  archive_desk: ['빈 열람대', '열람대 위 촛불은 꺼져 있다. 펼쳐진 책은 없다.'],
  city_haggler_a: ['이름값 장수', '"이 모자, 이름값만 금화 셋이야!" "모자값은?" "그건 따로지!"'],
  city_haggler_b: ['물건값 장수', '"이름값이 물건값보다 비싼 도시라니까." 장수가 어깨를 으쓱한다.'],
  contract_window: ['열람 창구', '"열람은 접수번호가 있는 분만 됩니다." 창구가 탁 닫힌다.'],
  contract_clerk: ['창구 직원', '"오늘은 도장이 모자라서 서류가 밀렸어요." 직원이 한숨을 쉰다.'],
  tea_window_seat: ['창가 자리', '창가 자리. 식은 찻잔 하나가 남아 있다.'],
  tea_guest: ['찻집 손님', '"여기 차는 비싸. 대신 아무도 말을 안 걸지." 손님이 신문 너머로 너를 본다.'],
  tower_clerk: ['접수 담당', '"도전하러 왔나? 층마다 규칙을 정하는 중이라 오늘은 전부 잠겼어. 구경은 마음대로."'],
  testimony_chairs: ['둥글게 놓인 의자', '의자가 둥글게 놓여 있다. 아무도 앉아 있지 않다.'],
  barred_shelves: ['철창 서가', '철창 너머 서가. 자물쇠가 크고 단단하다.'],
  top_table: ['긴 탁자', '긴 탁자 하나와 마주 놓인 빈 의자 둘. 탁자 위엔 아무것도 없다.'],
  top_window: ['창', '창밖으로 황금 도시의 불빛이 보인다. 멀리 항구와 시장 쪽 하늘도.'],
};

export function shellInteraction(entityId: string): { entry: string; nodes: Record<string, DialogueNode> } | null {
  const line = LINES[entityId];
  if (!line) return null;
  return { entry: 'root', nodes: { root: { id: 'root', speaker: line[0], text: line[1], choices: [{ text: '물러난다' }] } } };
}

/** 테스트용: 셸 대상 목록 */
export const SHELL_ENTITY_IDS = Object.keys(LINES);
