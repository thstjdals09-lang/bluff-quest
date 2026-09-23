import type { GameState } from '../types';
import goblinPortrait from '../../assets/goblin-stall.png';
import miraPortrait from '../../assets/mira-stall.png';
import goblinBust from '../../assets/grix-bust.png';
import miraBust from '../../assets/mira-bust.png';
import finPortrait from '../../assets/fin-stand.png';
import finBust from '../../assets/fin-bust.png';

/**
 * 주요 NPC 등록부 — 관계 화면과 향후 지역 간 재등장 시스템의 기반.
 * NPC의 런타임 상태(만남 횟수·관계 변화)는 GameState.npcs에 저장되고,
 * 여기는 불변의 정의 데이터만 둔다.
 */

export interface NpcDef {
  id: string;
  name: string;
  regionId: string;
  role: string;
  desc: string;
  portrait: string | null;
  /** 대화 장면(MODE B)용 클로즈업 일러스트 */
  bust?: string;
  /** 다른 지역에서 재등장할 수 있는 인물인가 */
  reappears: boolean;
  questIds: string[];
}

export const NPCS: NpcDef[] = [
  {
    id: 'goblin',
    name: '그리즐',
    regionId: 'goblin_market',
    role: '상자 게임의 고블린',
    desc: '자칭 "시장에서 제일 정직한 고블린". 진실과 거짓을 반반 섞어 쓰는 좌판의 주인.',
    portrait: goblinPortrait,
    bust: goblinBust,
    reappears: true,
    questIds: ['q_invitation', 'q_black_chip'],
  },
  {
    id: 'mira',
    name: '약초상 미라',
    regionId: 'goblin_market',
    role: '약초상 · 시장의 소식통',
    desc: '시장의 소문이 모두 거쳐 가는 약초 좌판의 주인. 패배한 도전자에게만 들려주는 조언이 있다.',
    portrait: miraPortrait,
    bust: miraBust,
    reappears: true,
    questIds: ['q_mira_past'],
  },
  {
    id: 'fin',
    name: '정보상 올드 핀',
    regionId: 'trickster_port',
    role: '부두의 정보상',
    desc: '밤의 부두에서 소문과 비밀을 파는 늙은 뱃사람. 손님을 떠보는 것이 직업병이다.',
    portrait: finPortrait,
    bust: finBust,
    reappears: true,
    questIds: ['q_night_pier'],
  },
];

export interface NpcRelationView {
  def: NpcDef;
  met: boolean;
  meetCount: number;
  /** 관계 상태 요약 (실제 런타임 상태에서 파생) */
  relation: string;
  /** 주요 상호작용 기록 */
  records: string[];
}

/** 실제 게임 상태에서 NPC 관계 뷰를 파생한다. */
export function getNpcRelation(def: NpcDef, state: GameState): NpcRelationView {
  const rt = state.npcs[def.id];
  const met = (rt?.meetCount ?? 0) > 0;
  const records: string[] = [];
  let relation = met ? '아는 사이' : '미발견';

  if (def.id === 'goblin' && rt) {
    if (rt.caughtLying) {
      relation = '경계 대상 — 그리즐이 당신의 눈썰미를 경계한다';
      records.push('그리즐의 거짓말을 간파하고 상자 대결에서 승리했다.');
    } else if (rt.fooledPlayer) {
      relation = '얕보임 — 그리즐이 당신을 "호구"라고 부른다';
    }
    if (rt.fooledPlayer) records.push('상자 대결에서 그리즐에게 속은 적이 있다.');
    if (state.career.wins > 0) records.push(`상자 대결 승리 ${state.career.wins}회.`);
    if (state.flags.chip_refused === true) records.push('검은 칩만은 어떤 값에도 팔지 않는 것을 목격했다.');
    if (state.flags.chip_pressed === true) records.push('칩에 대해 캐물었다가 그리즐의 미움을 샀다.');
    if (state.flags.chip_done === 'warm') {
      relation = '묘한 신뢰 — 그리즐이 약속 이야기를 들려줬다';
      records.push('그리즐이 사라진 친구와의 약속을 직접 이야기해 줬다.');
    } else if (state.flags.chip_done === 'cold') {
      relation = '서먹함 — 캐물었던 일을 그리즐이 기억한다';
      records.push('그리즐은 약속의 존재만 마지못해 인정했다.');
    }
  }
  if (def.id === 'mira' && rt) {
    if (state.flags.mira_hint === true) {
      relation = '조언자 — 미라의 비결을 들었다';
      records.push('"고블린의 말보다 몸을 보라"는 조언을 들었다.');
    }
    if (state.flags.mira_slip === true) records.push('미라가 승부판에서 쓰는 말을 무심코 흘리는 것을 들었다.');
    if (state.flags.mira_admitted === true) {
      relation = '비밀을 아는 사이 — 미라가 전직 딜러였음을 인정했다';
      records.push('미라는 한때 여러 지역의 승부를 진행하던 딜러였다.');
    }
    if (state.flags.chip_asked_mira === true) records.push('그리즐의 검은 칩에 대해 미라의 이야기를 들었다.');
  }
  if (def.id === 'fin' && rt) {
    if (state.flags.fin_bluff_called === true) {
      relation = '가늠하는 사이 — 핀의 떠보기를 맞받아쳤다';
      records.push('초대장을 아는 척 떠보던 수작을 간파했다. 핀이 한 수 접었다.');
    } else if (state.flags.invitation_confirmed_to_fin === true) {
      relation = '한 수 접힘 — 떠보기에 말려들었다';
      records.push('핀의 넘겨짚기에 초대장의 존재를 스스로 확인해 주고 말았다.');
    }
    if (state.flags.invitation_shown === true) records.push('초대장을 직접 보여줬다. 부두에 소문이 돌지도 모른다.');
    if (state.flags.night_pier_hint === true) records.push('밤의 부두 비밀 경기에 관한 이야기를 샀다.');
  }
  if (met && records.length === 0) records.push('대화를 나눴다.');

  return { def, met, meetCount: rt?.meetCount ?? 0, relation, records };
}
