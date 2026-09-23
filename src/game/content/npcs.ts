import type { GameState } from '../types';
import goblinPortrait from '../../assets/goblin-stall.png';
import miraPortrait from '../../assets/mira-stall.png';
import goblinBust from '../../assets/grix-bust.png';
import miraBust from '../../assets/mira-bust.png';

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
    questIds: ['q_invitation'],
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
    questIds: [],
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
  }
  if (def.id === 'mira' && rt) {
    if (state.flags.mira_hint === true) {
      relation = '조언자 — 미라의 비결을 들었다';
      records.push('"고블린의 말보다 몸을 보라"는 조언을 들었다.');
    }
  }
  if (met && records.length === 0) records.push('시장에서 대화를 나눴다.');

  return { def, met, meetCount: rt?.meetCount ?? 0, relation, records };
}
