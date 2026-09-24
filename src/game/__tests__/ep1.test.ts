import { describe, expect, it } from 'vitest';
import type { DialogueNode, GameState } from '../types';
import { createInitialState, reducer } from '../state';
import { getInteraction, resolveDialogueNode } from '../content/dialogues';
import type { DialogueTree } from '../content/dialogues';
import { getExit, isExitOpen, validateLocationGraph } from '../content/navigation';
import { LOCATIONS, getTrackedQuest } from '../content/world';
import { getScopedRecords } from '../content/records';
import { judgeTable } from '../content/moonless';
import { getNotebook } from '../content/incidents';
import { importSave } from '../save';
import moonlessSrc from '../content/moonless.ts?raw';

/** App과 같은 방식으로 대화를 진행한다 (효과 적용 → 최신 트리, 없으면 스냅샷) */
function talk(s: GameState, id: string, picks: string[]): { s: GameState; node: DialogueNode | null } {
  const t = getInteraction(id, s);
  let nodeId = t.entry;
  let snap: DialogueTree = t;
  for (const p of picks) {
    const node = resolveDialogueNode(id, s, nodeId, snap);
    const c = node.choices.find((x) => x.text.includes(p));
    if (!c) throw new Error(`[${id}/${node.id}] 선택지 없음: ${p} — 있는 것: ${node.choices.map((x) => x.text).join(' | ')}`);
    const before = getInteraction(id, s);
    snap = { entry: before.entry, nodes: { ...snap.nodes, ...before.nodes } };
    for (const e of c.effects ?? []) s = reducer(s, e);
    if (!c.next) return { s, node: null };
    nodeId = c.next;
  }
  return { s, node: resolveDialogueNode(id, s, nodeId, snap) };
}
const choicesOf = (s: GameState, id: string, picks: string[] = []) => talk(s, id, picks).node!.choices.map((c) => c.text);

function doneSave(extra: Partial<GameState['flags']> = {}): GameState {
  const b = createInitialState();
  return {
    ...b,
    player: { ...b.player, location: 'port_docks', x: 6, y: 5 },
    inventory: ['old_spade_card', 'invitation'],
    flags: { prologue_card: true, found_invitation: true, pier_rumor: true, night_pier_hint: true, invitation_meaning_known: 'claim', port_arrived: true, port_arrival_seen: true, ...extra },
    npcs: { fin: { meetCount: 1, fooledPlayer: false, caughtLying: false } },
    quests: { q_invitation: { stage: 'done', completed: [] }, q_night_pier: { stage: 'done', completed: [] } },
    visitedRegions: ['goblin_market', 'trickster_port'],
  };
}
function depart(s: GameState): GameState {
  return talk(s, 'fin', ['밤의 부두 얘기를', '준비됐어', '부두 끝으로 걷는다']).s;
}
const inHall = (s: GameState) => ({ ...s, player: { ...s.player, location: 'night_pier_hall', x: 3, y: 2 } });

describe('STORY-S2 EP1 달 없는 밤', () => {
  it('장소 그래프 정상, 부두 끝 출구는 출발 전 잠김', () => {
    expect(validateLocationGraph()).toEqual([]);
    const exit = getExit('port_docks', 'pier_end')!;
    expect(isExitOpen(exit, doneSave())).toBe(false);
    expect(isExitOpen(exit, doneSave({ ep1_departed: true }))).toBe(true);
    for (const id of ['night_pier_end', 'night_pier_hall', 'sailor_shelter']) expect(LOCATIONS[id].stub).toBeTruthy();
  });

  it('H2: 완료 세이브는 핀에게서 바로 출발/보류, 미완료 세이브는 보이지 않음', () => {
    expect(choicesOf(doneSave(), 'fin')).toContain('밤의 부두 얘기를 꺼낸다');
    const early = { ...doneSave(), quests: { q_night_pier: { stage: 'wager', completed: [] } } };
    expect(choicesOf(early, 'fin')).not.toContain('밤의 부두 얘기를 꺼낸다');
    // 보류 → 다시 보인다
    const later = talk(doneSave(), 'fin', ['밤의 부두 얘기를', '아직 확인할 일이']).s;
    expect(later.flags.ep1_departed).toBeUndefined();
    expect(choicesOf(later, 'fin')).toContain('밤의 부두 얘기를 꺼낸다');
    // 출발 → 부두 끝, 퀘스트 hall, 다시는 '부두 끝으로 간다'
    const s = depart(doneSave());
    expect(s.player.location).toBe('night_pier_end');
    expect(s.flags.ep1_departed).toBe(true);
    expect(s.quests.q_moonless.stage).toBe('hall');
    expect(s.quests.q_night_pier.stage).toBe('done');
    expect(choicesOf({ ...s, player: { ...s.player, location: 'port_docks' } }, 'fin')).toContain('부두 끝으로 간다');
    expect(s.player.gold).toBe(doneSave().player.gold); // 비용 없음
  });

  it('기존 완료 세이브: 불러오기로는 퀘스트가 생기지 않고, 장소 전환에서 ready가 된다', () => {
    const d = doneSave();
    const loaded = importSave(JSON.stringify({ ...d, player: { ...d.player, x: 3, y: 1 } }))!;
    expect(loaded.quests.q_moonless).toBeUndefined();
    const moved = reducer(loaded, { type: 'USE_EXIT', entityId: 'harbor_gate' });
    expect(moved.quests.q_moonless.stage).toBe('ready');
    expect(getTrackedQuest(moved)?.quest.id).toBe('q_moonless');
  });

  it('판정표: 결정론, 근거 있는 질문 없이는 통과 없음', () => {
    expect(judgeTable('ledger', '', 'fact', 'edge')).toBe('evidence');
    expect(judgeTable('edge', 'own', 'unsure', 'ledger')).toBe('evidence');
    expect(judgeTable('own', '', 'fact', 'edge')).toBe('fail_nofact');
    expect(judgeTable('fin', '', 'fact', 'ledger')).toBe('fail_nofact');
    expect(judgeTable('ledger', 'edge', 'fact', 'fin')).toBe('fail_weak');
    expect(judgeTable('ledger', '', 'fact', 'accuse')).toBe('fail_weak');
    expect(judgeTable('', '', 'bluff', 'edge')).toBe('bluff');
    expect(judgeTable('own', '', 'bluff', 'accuse')).toBe('fail_bluff');
    expect(moonlessSrc).not.toMatch(/Math\.random|rng\(|seed/);
  });

  it('증거 입장: 잠정 조사 입장, 17번 연결은 장부+내 종이를 댔을 때만, 이력부 → 카지노 참조 → done', () => {
    let s = inHall(depart(doneSave()));
    s = talk(s, 'usher', ['초대장을 내민다', '규칙이 뭐지']).s;
    s = talk(s, 'hall_ledger', ['내 종이가 17번']).s;
    s = talk(s, 'seat_a', ['그 종이, 좀 볼 수']).s;
    const r = talk(s, 'usher', ['판을 청하겠다', '장부 17번', '내 초대장', '계속한다', '본 것만 말할게', '날짜부터 맞춰 보자']);
    s = r.s;
    expect(r.node!.text).toContain('잠정 조사 입장');
    expect(r.node!.text).toContain('17번 접수 건은 잠정 확인 중');
    expect(r.node!.text).not.toMatch(/네 자리|주인은 너/);
    expect(s.flags.h3_outcome).toBe('evidence');
    expect(s.flags.h3_link).toBe(true);
    expect(s.quests.q_moonless.stage).toBe('admitted');
    const seats = talk(s, 'seats_door', ['좌석 이력부를 본다']);
    expect(seats.node!.text).toContain('유령 카지노 서고');
    s = seats.s;
    expect(s.flags.ep1_casino_ref).toBe(true);
    expect(s.quests.q_moonless.stage).toBe('done');
  });

  it('증거는 있어도 17번 연결 표시는 조건부 (장부 없이 날짜만)', () => {
    let s = inHall(depart(doneSave()));
    s = talk(s, 'usher', ['초대장을 내민다']).s;
    s = talk(s, 'seat_a', ['그 종이, 좀 볼 수']).s;
    const r = talk(s, 'usher', ['판을 청하겠다', '바늘의 종이', '이걸로 충분하다', '본 것만 말할게', '날짜부터 맞춰 보자']);
    expect(r.s.flags.h3_outcome).toBe('evidence');
    expect(r.s.flags.h3_link).toBeUndefined();
    expect(r.node!.text).not.toContain('17번 접수');
  });

  it('허세: 구체 모순을 짚어야만 잠정 입장, 이력부는 막히고 게시대로 done', () => {
    let s = inHall(depart(doneSave()));
    // 근거 없는 허세 → 실패, 재도전 가능
    let r = talk(s, 'usher', ['초대장을 내민다', '규칙이 뭐지', '알겠다', '판을 청하겠다', '내 초대장', '이걸로 충분하다', '기다리고 있어', '거짓말을 하고']);
    s = r.s;
    expect(r.node!.text).toContain('모순이군');
    expect(s.flags.h3_outcome).toBeUndefined();
    expect(s.flags.h3_fails).toBe(1);
    s = talk(s, 'hall_ledger', ['장부를 덮는다']).s;
    r = talk(s, 'usher', ['판을 청하겠다', '아무것도 보여 주지', '기다리고 있어', '어디서 받았지']);
    s = r.s;
    expect(s.flags.h3_outcome).toBe('bluff');
    expect(r.node!.text).toContain('들은 걸로 치지 않겠어');
    expect(talk(s, 'seats_door', ['좌석 이력부를 청한다']).node!.text).toContain('제대로 적힌 사람만');
    expect(s.flags.ep1_casino_ref).toBeUndefined();
    s = { ...s, player: { ...s.player, location: 'night_pier_end' } };
    s = talk(s, 'notice_stand', ['명부 사본을 옮겨 적는다']).s;
    expect(s.flags.ep1_casino_ref).toBe(true);
    expect(s.quests.q_moonless.stage).toBe('done');
  });

  it('물결: 허락을 받으면 인수증을 공개해도 증인이 될 수 있고, 허락 없이 까면 증인 불가', () => {
    let s = inHall(depart(doneSave()));
    s = talk(s, 'usher', ['초대장을 내민다', '규칙이 뭐지', '알겠다', '공동 증언은']).s;
    s = talk(s, 'seat_b', ['인수증을 보여 줄 수']).s;
    // 허락 없이 공개 → 판은 접고 증인 요청 → 거절
    let x = talk(s, 'usher', ['판을 청하겠다', '물결의 인수증', '이걸로 충분하다', '지금은 말하지 않는다']).s;
    expect(x.flags.b_exposed).toBe(true);
    const no = talk(x, 'usher', ['물결에게 증인을']);
    expect(no.node!.text).toContain('인수증을 까 놓고');
    expect(no.s.flags.h3_outcome).toBeUndefined();
    // 허락 → 공개해도 노출 아님 → 증인 입장
    x = talk(s, 'seat_b', ['판에서 인수증 얘기를']).s;
    x = talk(x, 'usher', ['판을 청하겠다', '물결의 인수증', '이걸로 충분하다', '지금은 말하지 않는다']).s;
    expect(x.flags.b_exposed).toBeUndefined();
    x = talk(x, 'usher', ['물결에게 증인을']).s;
    expect(x.flags.h3_outcome).toBe('witness');
    expect(talk(x, 'seats_door', []).node!.text).toContain('증인');
  });

  it('철수: outside 단계, 판은 다시 청할 수 있고, 레오는 "들어가지 않았어?"', () => {
    let s = inHall(depart(doneSave()));
    s = talk(s, 'usher', ['초대장을 내민다', '규칙이 뭐지', '알겠다', '판을 청하겠다', '아무것도 보여 주지', '판을 접는다']).s;
    expect(s.flags.h3_outcome).toBe('withdrew');
    expect(s.quests.q_moonless.stage).toBe('outside');
    expect(choicesOf(s, 'usher')).toContain('"판을 청하겠다."');
    expect(talk(s, 'leo', []).node!.text).toContain('안에 안 들어갔어?');
    // 실패만 한 경우는 '쫓겨났어?'
    let t = inHall(depart(doneSave()));
    t = talk(t, 'usher', ['초대장을 내민다', '규칙이 뭐지', '알겠다', '판을 청하겠다', '아무것도 보여 주지', '본 것만', '거짓말을 하고']).s;
    expect(talk(t, 'leo', []).node!.text).toContain('쫓겨났어?');
  });

  it('H4 레오: 명부 FACT, 동일 인물은 고를 때만 INFERENCE, 떠보기는 신뢰 하락 + 버릇 CLAIM', () => {
    let s = inHall(depart(doneSave()));
    s = talk(s, 'usher', ['초대장을 내민다']).s;
    s = talk(s, 'leo', ['공고 원문을 같이 본다', '고개를 끄덕인다']).s;
    expect(s.flags.ep1_casino_ref).toBe(true);
    let recs = getScopedRecords(s).filter((r) => r.scope === 'moonless');
    expect(recs.some((r) => r.kind === 'fact' && r.text.includes('참조 3-나-12'))).toBe(true);
    expect(recs.some((r) => r.kind === 'inference')).toBe(false);
    s = talk(s, 'leo', ['나도 알 것 같은데', '칩을 손가락']).s;
    expect(s.flags.leo_trust).toBe('low');
    recs = getScopedRecords(s).filter((r) => r.scope === 'moonless');
    expect(recs.find((r) => r.text.includes('카드 모서리'))!.kind).toBe('claim');
    expect(recs.find((r) => r.text.includes('자기가 붙였다'))!.kind).toBe('claim');
  });

  it('H5 하멜: 그리즐 얘기 전에는 C1이 없다, 칩 사건 상태별 대사, 선택 기록', () => {
    const base = { ...depart(doneSave({ chip_done: 'warm' })), player: { ...doneSave().player, location: 'sailor_shelter', x: 4, y: 1 } };
    const first = choicesOf(base, 'hamel');
    expect(first.join('|')).not.toMatch(/말하겠다|말하지 않을게|전할까/);
    const g = talk(base, 'hamel', ['고블린 시장에서 왔어']);
    expect(g.node!.choices.map((c) => c.text)).toContain('"그리즐이 친구와의 약속을 지키고 있더라."');
    let s = talk(base, 'hamel', ['고블린 시장에서 왔어', '약속을 지키고 있더라', '기다린다', '말만 전할까', '…']).s;
    expect(s.flags.sailor_choice).toBe('message');
    expect(s.flags.h5_advice).toBe(true);
    expect(s.flags.h5_i_friend).toBeUndefined(); // 추정은 고를 때만
    // 칩 사건을 모르는 세이브에는 추정 선택지도 없다
    const noChip = { ...base, flags: { ...base.flags, chip_done: undefined as never } };
    expect(talk(noChip, 'hamel', ['고블린 시장에서 왔어', '잘 지내']).node!.choices.map((c) => c.text).join('|')).not.toContain('(속으로)');
    // 항해 일지만으로도 카지노 참조
    s = talk(base, 'sailor_log', ['기억해 둔다']).s;
    expect(s.flags.ep1_casino_ref).toBe(true);
  });

  it('비밀 누출 없음: 기록·목표문·대사에 정본 비밀의 이름이 없다', () => {
    const forbidden = /도란|이렌|17번의 (원래 )?주인은|원 소유주|이름이 없는 자리의 주인은/;
    expect(moonlessSrc).not.toMatch(/도란|이렌/);
    let s = inHall(depart(doneSave({ chip_done: 'warm' })));
    s = talk(s, 'usher', ['초대장을 내민다', '규칙이 뭐지']).s;
    s = talk(s, 'hall_ledger', ['내 종이가 17번']).s;
    s = talk(s, 'seat_c', ['낡은 스페이드 카드']).s;
    const nb = getNotebook(s).incidents.find((i) => i.id === 'moonless')!;
    expect(nb).toBeTruthy();
    for (const r of nb.records) expect(r.text).not.toMatch(forbidden);
    // 갈매기의 반응 = 관찰 FACT(이유 미상) + 발언 CLAIM
    expect(nb.records.find((r) => r.text.includes('오래 보았다'))!.kind).toBe('fact');
    expect(nb.records.find((r) => r.text.startsWith('갈매기: "여기 사람들'))!.kind).toBe('claim');
  });

  it('세이브 스키마 불변 (v6) + 새로고침 후에도 결과·기록 유지', () => {
    let s = inHall(depart(doneSave()));
    s = talk(s, 'usher', ['초대장을 내민다', '규칙이 뭐지', '알겠다', '판을 청하겠다', '아무것도 보여 주지', '판을 접는다']).s;
    const re = importSave(JSON.stringify(s))!;
    expect(re.version).toBe(6);
    expect(re.player.location).toBe('night_pier_hall');
    expect(re.flags.h3_outcome).toBe('withdrew');
    expect(getScopedRecords(re)).toEqual(getScopedRecords(s));
  });
});
