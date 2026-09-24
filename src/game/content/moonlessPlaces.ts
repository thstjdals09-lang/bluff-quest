import type { LocationDef } from '../types';

/**
 * STORY-S2 EP1 '달 없는 밤' — 새 장소 (STORY_STUB: 그림 없는 임시 장면).
 * 단색 배경·이름표·조사 지점·출구만으로 그려진다(ui/StubScene). 게임 로직은 다른 장소와 같다.
 */
export const MOONLESS_LOCATIONS: Record<string, LocationDef> = {
  night_pier_end: {
    id: 'night_pier_end',
    name: '부두 끝',
    regionId: 'trickster_port',
    arrivalNote: '널판 부두의 끝. 창고 문, 벽보가 겹겹이 붙은 기록 게시대, 화롯불이 새는 선원 대기실.',
    stub: { tone: '#0d1a24' },
    layout: [
      '#######', // 0: 창고 벽 (문)
      '.......', // 1: 게시대·레오
      '.......', // 2
      '.......', // 3: 대기실 문(동)
      '.......', // 4
      '.......', // 5: 부두로 돌아가는 길
    ],
    entities: [
      { id: 'hall_door', kind: 'exit', x: 3, y: 0, icon: '🚪', name: '불 켜진 창고 문' },
      { id: 'notice_stand', kind: 'poi', x: 0, y: 1, icon: '📜', name: '기록 게시대' },
      { id: 'leo', kind: 'npc', x: 2, y: 1, icon: '🧑', name: '벽보 붙이는 사람' },
      { id: 'shelter_door', kind: 'exit', x: 6, y: 3, icon: '🔥', name: '선원 대기실' },
      { id: 'pier_back', kind: 'exit', x: 3, y: 5, icon: '⚓', name: '부두로 돌아가는 길' },
    ],
    exits: [
      { entityId: 'hall_door', to: 'night_pier_hall', arrive: { x: 3, y: 4 }, direction: '북' },
      { entityId: 'shelter_door', to: 'sailor_shelter', arrive: { x: 3, y: 3 }, direction: '동' },
      { entityId: 'pier_back', to: 'port_docks', arrive: { x: 3, y: 8 }, direction: '남' },
    ],
    playerStart: { x: 3, y: 4 },
  },
  night_pier_hall: {
    id: 'night_pier_hall',
    name: '초대장 홀',
    regionId: 'trickster_port',
    arrivalNote: '접수대의 문지기와 두꺼운 장부. 긴 의자에 사람들이 서로 눈을 피한 채 앉아 있다.',
    stub: { tone: '#1f1710' },
    layout: [
      '#######', // 0: 안쪽 벽 (좌석방 문)
      '.......', // 1: 문지기·접수대 장부
      '.......', // 2: 바늘(서)
      '.......', // 3: 갈매기(동)
      '.......', // 4: 물결(서)
      '.......', // 5: 나가는 문
    ],
    entities: [
      { id: 'usher', kind: 'npc', x: 3, y: 1, icon: '🕯️', name: '문지기' },
      { id: 'hall_ledger', kind: 'poi', x: 4, y: 1, icon: '📖', name: '장부' },
      { id: 'seat_a', kind: 'npc', x: 0, y: 2, icon: '✂️', name: '바늘' },
      { id: 'seat_c', kind: 'npc', x: 6, y: 3, icon: '🕊️', name: '갈매기' },
      { id: 'seat_b', kind: 'npc', x: 0, y: 4, icon: '🌊', name: '물결' },
      { id: 'seats_door', kind: 'poi', x: 6, y: 0, icon: '💺', name: '좌석방 문' },
      { id: 'hall_exit', kind: 'exit', x: 3, y: 5, icon: '🚪', name: '부두 끝으로' },
    ],
    exits: [{ entityId: 'hall_exit', to: 'night_pier_end', arrive: { x: 3, y: 1 }, direction: '남' }],
    playerStart: { x: 3, y: 4 },
  },
  sailor_shelter: {
    id: 'sailor_shelter',
    name: '선원 대기실',
    regionId: 'trickster_port',
    arrivalNote: '배가 안 나가는 날. 화로 곁에서 주사위 소리, 구석에서 그물 깁는 소리.',
    stub: { tone: '#241510' },
    layout: [
      '#######', // 0
      '.......', // 1: 하멜(동)
      '.......', // 2: 선원(서) · 벤치의 항해 일지
      '.......', // 3
      '#######', // 4: 벽 (서쪽 문)
    ],
    entities: [
      { id: 'hamel', kind: 'npc', x: 5, y: 1, icon: '🎣', name: '그물 깁는 선원' },
      { id: 'dice_sailor', kind: 'npc', x: 1, y: 2, icon: '🎲', name: '주사위 굴리는 선원' },
      { id: 'sailor_log', kind: 'poi', x: 6, y: 2, icon: '📓', name: '벤치의 항해 일지' },
      { id: 'shelter_exit', kind: 'exit', x: 0, y: 3, icon: '🚪', name: '부두 끝으로' },
    ],
    exits: [{ entityId: 'shelter_exit', to: 'night_pier_end', arrive: { x: 5, y: 3 }, direction: '서' }],
    playerStart: { x: 3, y: 3 },
  },
};
