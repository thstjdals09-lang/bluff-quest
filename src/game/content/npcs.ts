import type { GameState } from '../types';
import goblinPortrait from '../../assets/goblin-stall.png';
import miraPortrait from '../../assets/mira-stall.png';
import goblinBust from '../../assets/grix-bust.png';
import miraBust from '../../assets/mira-bust.png';
import finPortrait from '../../assets/fin-stand.png';
import finBust from '../../assets/fin-bust.png';
import gateMerchantPortrait from '../../assets/gate-merchant-cart.png';
import gateMerchantBust from '../../assets/gate-merchant-bust.png';
import s01aStand from '../../assets/s01-a-stand.png';
import s01aBust from '../../assets/s01-a-bust.png';
import s01bStand from '../../assets/s01-b-stand.png';
import s01bBust from '../../assets/s01-b-bust.png';

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
    id: 'gate_merchant',
    name: '입구의 상인',
    regionId: 'goblin_market',
    role: '시장 입구의 수레 상인',
    desc: '시장 문 앞에서 냄비와 잡동사니를 파는 고블린. 시장 안보다 싸다는 게 자랑이다.',
    portrait: gateMerchantPortrait,
    bust: gateMerchantBust,
    reappears: true,
    questIds: ['q_prologue'],
  },
  {
    id: 's01_a',
    name: '공방 상인',
    regionId: 'goblin_market',
    role: '중앙 장터 · 카드 가드 공방 (임시 표시명)',
    desc: '자기 공방 인장에 자부심이 큰 늙은 장인. 공방 물건의 흉내가 돌아다니는 걸 참지 못한다.',
    portrait: s01aStand,
    bust: s01aBust,
    reappears: true,
    questIds: ['q_s01'],
  },
  {
    id: 's01_b',
    name: '되팔이 상인',
    regionId: 'goblin_market',
    role: '중앙 장터 · 되팔이 (임시 표시명)',
    desc: '어디서든 물건을 떼어다 파는 젊은 상인. 오늘 안에 가드를 원본 값에 팔고 싶어 한다.',
    portrait: s01bStand,
    bust: s01bBust,
    reappears: true,
    questIds: ['q_s01'],
  },
  {
    id: 'goblin',
    name: '그리즐',
    regionId: 'goblin_market',
    role: '상자 게임의 고블린',
    desc: '자칭 "시장에서 제일 정직한 고블린". 진실과 거짓을 반반 섞어 쓰는 좌판의 주인.',
    portrait: goblinPortrait,
    bust: goblinBust,
    reappears: true,
    questIds: ['q_invitation', 'q_black_chip', 'q_grizzle_favor'],
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

  if (def.id === 'gate_merchant' && rt) {
    if (state.flags.gate_merchant_met === true) {
      relation = '어색함 — 카드 이야기 이후 눈을 피한다';
      records.push('낡은 스페이드 카드를 보자 "어디서 났어?"라고 묻더니, 곧 "잘못 봤다"며 말을 바꿨다.');
      if (state.flags.gate_merchant_answer === 'told') records.push('길에서 주웠다고 사실대로 말해 줬다.');
      if (state.flags.gate_merchant_answer === 'asked') records.push('카드에 대해 되물었지만 대답을 듣지 못했다.');
      if (state.flags.gate_merchant_answer === 'hid') records.push('대답하지 않고 카드를 숨겼다.');
    } else {
      relation = '호객하는 상인';
    }
  }
  if ((def.id === 's01_a' || def.id === 's01_b') && rt) {
    const who = def.id === 's01_a' ? 'A' : 'B';
    const rel = state.flags[`s01_rel_${who}`];
    const v = state.flags.s01_verdict;
    if (v !== undefined) {
      relation = rel === 'warm' ? '호감 — 소동에서 편을 들어 줬다' : rel === 'cold' ? '냉담 — 소동의 판단에 불만이 있다' : '보통 — 소동은 일단락됐다';
      records.push(
        v === 'mediated'
          ? '진품 소동에서 누구 편도 들지 않고 둘을 떼어 놓았다.'
          : `진품 소동에서 ${v === who ? '이 상인의 가드가 원본이라고' : v === 'neither' ? '두 가드 모두 원본이 아니라고' : '상대 상인의 가드가 원본이라고'} 판단했다.`,
      );
    } else {
      relation = '진품 소동 중 — 자기 가드가 원본이라고 주장한다';
    }
    if (who === 'B') {
      const r = state.flags.hb_resolved;
      if (r === 'evidence') records.push('벽보 흔적을 들이밀자 다시는 안 붙이겠다고 했다.');
      if (r === 'persuaded') records.push('벽보 일을 조용히 타일렀다. 그리즐에게는 말하지 않기로 했다.');
      if (r === 'bluff') records.push('본 척 떠보자 벽보 일을 털어놓았다.');
      if (r === 'grizzle') records.push('벽보 일을 그리즐에게 알렸다. 되팔이는 그 사실을 알고 있을 것이다.');
    }
  }
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
    if (state.flags.hb_resolved === 'grizzle') records.push('벽보를 붙인 게 되팔이 상인 같다고 알려 줬다. 그리즐이 따지러 갔다.');
    if (state.flags.hb_grizzle_told === true) records.push('벽보가 더는 안 붙을 거라고 전했다. 그리즐이 누군지는 묻지 않았다.');
    if (state.flags.gf_stage === 'returned') {
      records.push(
        state.flags.gf_key_given === true
          ? '사라진 경품 상자를 되찾아 주고, 대결 없이 낡은 열쇠를 받았다.'
          : '사라진 경품 상자를 되찾아 줬다. 열쇠는 이미 가진 뒤였다.',
      );
      if (!rt.caughtLying && !rt.fooledPlayer) relation = '거래 상대 — 부탁을 들어준 손님으로 기억한다';
    } else if (state.flags.gf_stage === 'offered' || state.flags.gf_stage === 'found') {
      records.push('사라진 예비 경품 상자를 찾아 달라는 부탁을 받았다.');
    }
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
    if (state.flags.fin_trade_rep === 'reliable') records.push('시장 소식을 정확하게 전해 핀의 신용을 얻었다.');
    if (state.flags.fin_trade_rep === 'loose') records.push('확인되지 않는 이야기를 팔아 핀의 눈 밖에 났다.');
  }
  if (met && records.length === 0) records.push('대화를 나눴다.');

  return { def, met, meetCount: rt?.meetCount ?? 0, relation, records };
}
