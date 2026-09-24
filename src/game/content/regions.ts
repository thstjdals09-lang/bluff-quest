import type { GameState } from '../types';
import { LOCATIONS } from './world';
import marketImage from '../../assets/market-bg.jpg';
import portImage from '../../assets/port-preview.jpg';
import ghostImage from '../../assets/ghost-casino-preview.jpg';
import goldenImage from '../../assets/golden-city-preview.jpg';

/**
 * 전체 월드 정의 — 데이터 기반. 새 지역은 여기에 항목을 추가하면
 * 월드맵·지역 상세·프로필·커리어 화면에 자동 반영된다.
 *
 * impl(구현 상태)과 unlock(해금 상태)은 별개다:
 * 해금됐어도 impl이 playable이 아니면 탐험에 진입할 수 없다.
 */

export type ContentStatus = 'playable' | 'preview' | 'locked' | 'coming_soon';

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  playable: '플레이 가능',
  preview: '미리보기',
  locked: '잠김',
  coming_soon: '개발 예정',
};

export interface ChampionDef {
  id: string;
  regionId: string;
  /** 임시 명칭 — 최종 이름·외형·대결 규칙 미확정 */
  tentativeName: string;
  theme: string;
  badgeName: string;
  status: ContentStatus;
}

export interface RegionContentDef {
  name: string;
  desc: string;
  status: ContentStatus;
}

export interface RegionDef {
  id: string;
  order: string;
  name: string;
  tagline: string;
  themes: string[];
  desc: string;
  /** 구현 상태: playable=탐험 가능, preview=정보·이미지 열람, unknown=미공개 실루엣 */
  impl: 'playable' | 'preview' | 'unknown';
  image: string | null;
  /** true면 해금 전에는 미리보기 이미지도 감춘다 (예: 초대장으로 열리는 항구) */
  previewRequiresUnlock?: boolean;
  /** 월드맵 이미지 위 마커 위치 (%) */
  marker: { x: number; y: number };
  champion: ChampionDef | null;
  contents: RegionContentDef[];
  questIds: string[];
  /** 탐험 진입 위치 (playable 지역만) */
  entry?: { locationId: string; x: number; y: number };
}

export const CHAMPIONS: Record<string, ChampionDef> = {
  champ_goblin: {
    id: 'champ_goblin',
    regionId: 'goblin_market',
    tentativeName: '왕고블린 (임시 명칭)',
    theme: '거짓과 진실이 뒤섞인 최후의 흥정',
    badgeName: '거래의 배지 (가칭)',
    status: 'coming_soon',
  },
  champ_port: {
    id: 'champ_port',
    regionId: 'trickster_port',
    tentativeName: '해적 선장 (임시 명칭)',
    theme: '전부를 걸거나, 전부를 잃거나 — 위험과 보상의 승부',
    badgeName: '풍랑의 배지 (가칭)',
    status: 'coming_soon',
  },
  champ_ghost: {
    id: 'champ_ghost',
    regionId: 'ghost_casino',
    tentativeName: '유령 딜러 (임시 명칭)',
    theme: '과거의 기록과 행동 패턴을 읽는 자만 살아남는 게임',
    badgeName: '망령의 배지 (가칭)',
    status: 'coming_soon',
  },
  champ_golden: {
    id: 'champ_golden',
    regionId: 'golden_city',
    tentativeName: '황금 가면의 수학자 (임시 명칭)',
    theme: '확률과 기댓값 — 감이 아닌 계산의 대결',
    badgeName: '황금의 배지 (가칭)',
    status: 'coming_soon',
  },
};

export const REGIONS: RegionDef[] = [
  {
    id: 'goblin_market',
    order: 'REGION 01',
    name: '고블린 시장',
    tagline: '거짓말쟁이들의 밤 시장',
    themes: ['거짓말', '블러핑', '거래', '정보 추론'],
    desc: '고블린 상인들이 진실과 거짓을 반반씩 섞어 파는 밤 시장. 말보다 몸이 먼저 속내를 드러내는 곳이다. 상자 안에 무엇이 들었는지는, 고블린의 눈을 읽는 자만이 안다.',
    impl: 'playable',
    image: marketImage,
    marker: { x: 25, y: 67 },
    champion: CHAMPIONS.champ_goblin,
    contents: [
      { name: '시장 탐험', desc: '골목을 걸으며 NPC·장소와 상호작용한다.', status: 'playable' },
      { name: '그리즐의 상자 대결', desc: '고블린의 주장을 읽어내는 심리전.', status: 'playable' },
      { name: '오래된 창고', desc: '낡은 열쇠로 열리는 잠긴 장소.', status: 'playable' },
      { name: '시장 챔피언전', desc: '왕고블린과의 최후의 흥정.', status: 'coming_soon' },
      { name: '고블린 포커 클럽', desc: '시장 뒷골목의 소규모 클럽.', status: 'coming_soon' },
    ],
    questIds: ['q_invitation', 'q_s01', 'q_black_chip', 'q_mira_past'],
    // 지역 연결도: 월드맵·항구에서의 여행은 GM-01 진입로로 도착한다
    entry: { locationId: 'market_road', x: 2, y: 2 },
  },
  {
    id: 'trickster_port',
    order: 'REGION 02',
    name: '사기꾼들의 항구',
    tagline: '위험을 사고 보상을 파는 곳',
    themes: ['위험과 보상', '해적', '보물', '협상'],
    desc: '카드 문양 돛을 단 해적선들이 드나드는 무법의 항구. 모든 거래에는 이면이 있고, 모든 보물 지도에는 함정이 있다. 밤의 부두에서는 비밀 경기가 열린다고 한다.',
    impl: 'playable',
    image: portImage,
    previewRequiresUnlock: true,
    marker: { x: 76, y: 71 },
    champion: CHAMPIONS.champ_port,
    contents: [
      { name: '밤의 부두 탐험', desc: '보드워크를 걸으며 항구의 인물·장소와 상호작용한다.', status: 'playable' },
      { name: '정보상 올드 핀', desc: '값을 부르는 자 — 무엇을 걸고 무엇을 숨길지 판단하는 거래.', status: 'playable' },
      { name: '밤의 부두 — 비밀 경기', desc: '초대장을 든 사람들이 자리를 두고 따지는 판.', status: 'playable' },
      { name: '선술집', desc: '해적들의 소란스러운 승부가 벌어지는 곳.', status: 'coming_soon' },
      { name: '챔피언전', desc: '해적 선장과의 승부.', status: 'coming_soon' },
    ],
    questIds: ['q_night_pier', 'q_moonless'],
    entry: { locationId: 'port_docks', x: 3, y: 6 },
  },
  {
    id: 'ghost_casino',
    order: 'REGION 03',
    name: '유령 카지노',
    tagline: '기록은 사라지지 않는다',
    themes: ['행동 패턴', '상대 읽기', '숨겨진 기록'],
    desc: '안개 속에 잠긴 폐업한 카지노. 죽어서도 테이블을 떠나지 못한 유령들이 옛 습관 그대로 게임을 한다. 상대의 과거를 읽는 자에게만 승산이 있는 곳.',
    impl: 'preview',
    image: ghostImage,
    marker: { x: 27, y: 35 },
    champion: CHAMPIONS.champ_ghost,
    contents: [
      { name: '카지노 로비', desc: '유령 딜러들이 기다리는 홀.', status: 'coming_soon' },
      { name: '패턴 관찰 대결', desc: '반복되는 습관에서 답을 찾는 심리전.', status: 'coming_soon' },
      { name: '챔피언전', desc: '유령 딜러와의 게임.', status: 'coming_soon' },
    ],
    questIds: [],
  },
  {
    id: 'golden_city',
    order: 'REGION 04',
    name: '황금 도시',
    tagline: '모든 것에는 값이 있다',
    themes: ['확률', '기댓값', '자원 관리', '귀족의 승부'],
    desc: '금박 지붕 아래 귀족들이 조건과 확률을 흥정하는 도시. 이곳의 승부는 화려하지만 차갑다. 감정이 아니라 숫자가 이기는 곳이다.',
    impl: 'preview',
    image: goldenImage,
    marker: { x: 76, y: 38 },
    champion: CHAMPIONS.champ_golden,
    contents: [
      { name: '귀족 지구', desc: '고급 포커 클럽이 늘어선 거리.', status: 'coming_soon' },
      { name: '기댓값의 승부', desc: '조건이 붙은 특별한 대결.', status: 'coming_soon' },
      { name: '황금 경기장 챔피언전', desc: '황금 가면의 수학자와의 대결.', status: 'coming_soon' },
    ],
    questIds: [],
  },
  {
    id: 'unknown_region',
    order: 'REGION 05',
    name: '???',
    tagline: '아직 알려지지 않은 땅',
    themes: [],
    desc: '지도의 이 부분은 구름에 가려져 있다. 어떤 승부사도 이곳을 다녀와서 이야기한 적이 없다.',
    impl: 'unknown',
    image: null,
    marker: { x: 50, y: 10 },
    champion: null,
    contents: [],
    questIds: [],
  },
];

export function getRegionById(id: string): RegionDef | undefined {
  return REGIONS.find((r) => r.id === id);
}

/** 장소(locationId) → 소속 지역(regionId). 장소 정의(world.ts)에서 파생한다. */
export const LOCATION_REGION: Record<string, string> = Object.fromEntries(
  Object.values(LOCATIONS).map((l) => [l.id, l.regionId]),
);

export interface RegionAccess {
  unlocked: boolean;
  /** 잠겨 있을 때 플레이어에게 보여줄 힌트 */
  hint: string;
}

/** 지역 해금 상태 — 실제 게임 상태에서만 파생 (구현 상태 impl과 별개) */
export function getRegionAccess(regionId: string, state: GameState): RegionAccess {
  switch (regionId) {
    case 'goblin_market':
      return { unlocked: true, hint: '' };
    case 'trickster_port':
      return state.flags.found_invitation === true
        ? { unlocked: true, hint: '' }
        : { unlocked: false, hint: '고블린 시장 어딘가에 항구로 이어지는 단서가 잠들어 있다.' };
    case 'ghost_casino':
      return { unlocked: false, hint: '이후의 이야기에서 공개된다.' };
    case 'golden_city':
      return { unlocked: false, hint: '이후의 이야기에서 공개된다.' };
    default:
      return { unlocked: false, hint: '아직 알려지지 않은 지역이다.' };
  }
}

/** 특별 콘텐츠(지역에 속하지 않는 반복·도전 콘텐츠) — 전부 제안 단계 */
export interface SpecialContentDef {
  id: string;
  name: string;
  desc: string;
  status: ContentStatus;
  note: string;
}

export const SPECIAL_CONTENTS: SpecialContentDef[] = [
  {
    id: 'gamblers_tower',
    name: '승부사의 탑',
    desc: '규칙이 매번 달라지는 대결이 층마다 기다리는 도전 시설. 서사를 끝낸 뒤에도 오를 이유가 있는 곳.',
    status: 'coming_soon',
    note: '제안 단계 — 대결 규칙·보상 미확정',
  },
  {
    id: 'poker_clubs',
    name: '지역 포커 클럽',
    desc: '각 지역의 승부사들이 모이는 클럽. 커리어와 명성이 쌓이는 곳.',
    status: 'coming_soon',
    note: '지역별 클럽 규칙 미확정',
  },
  {
    id: 'secret_arena',
    name: '비밀 경기장',
    desc: '초대장을 받은 자만 들어갈 수 있다는 소문의 경기장. 실종된 승부사들과 관련이 있다고 한다.',
    status: 'coming_soon',
    note: '메인 스토리와 연결 예정',
  },
  {
    id: 'hidden_places',
    name: '숨겨진 장소',
    desc: '단서를 모아야만 드러나는 세계 곳곳의 비밀 장소들.',
    status: 'coming_soon',
    note: '지역별로 추가 예정',
  },
];
