// ── 공용 타입 정의 ──────────────────────────────────────────────

export type BoxIndex = 0 | 1 | 2;
export type BoxContent = 'treasure' | 'empty' | 'junk';

/** NPC가 대결에서 추구하는 목적 */
export type NpcGoal = 'keep_treasure' | 'win_wager' | 'show_off';

/** 정보 수집 행동 종류 (대결 공통 인터페이스) */
export type InfoActionId = 'ask_boxes' | 'ask_motive' | 'observe' | 'inspect';

export interface ClueDef {
  /** 플레이어에게 보여줄 단서 텍스트 (내부 상태와 논리적으로 일관) */
  text: string;
  /** 개발자 툴 전용: 이 단서가 내부적으로 무엇을 가리키는지 */
  devNote: string;
}

/**
 * 대결 시나리오 정의 (콘텐츠 데이터).
 * 시나리오는 플레이어의 선택 이전에 모두 결정되며, 선택 후 변경되지 않는다.
 */
export interface EncounterScenario {
  id: string;
  npcId: string;
  /** 각 상자의 실제 내용 — 시작 시점에 확정 */
  boxes: [BoxContent, BoxContent, BoxContent];
  /** NPC가 보물 위치를 실제로 아는가 */
  npcKnowsLocation: boolean;
  /** NPC가 보물이 있다고 믿는 위치 (모르는 경우 잘못된 믿음일 수 있음) */
  npcBelievedIndex: BoxIndex;
  npcGoal: NpcGoal;
  goalDesc: string;
  /** NPC의 공개 주장 */
  statement: { text: string; isTrue: boolean; reason: string };
  /** 정보 수집 행동별 단서 */
  clues: Record<InfoActionId, ClueDef>;
  /** 결과 화면에서 보여줄 해설 */
  reveal: string;
}

export type EncounterPhase = 'intro' | 'info' | 'resolved' | 'left';

/** 진행 중인 대결의 런타임 상태 (세이브에 포함) */
export interface EncounterState {
  encounterId: string;
  scenarioId: string;
  seed: number;
  phase: EncounterPhase;
  usedActions: InfoActionId[];
  /** 미라의 조언 등으로 시작 시 공개된 무료 단서 */
  bonusClue: string | null;
  chosenBox: BoxIndex | null;
  result: 'win' | 'lose' | null;
}

export interface NpcRuntime {
  meetCount: number;
  /** 고블린에게 속은 적 있음 */
  fooledPlayer: boolean;
  /** 고블린의 거짓말을 간파한 적 있음 */
  caughtLying: boolean;
}

export type FlagValue = boolean | number | string;

export interface PlayerState {
  /** v5: 승부사 이름 (새 모험 시작 시 설정) */
  name: string;
  location: string;
  x: number;
  y: number;
  gold: number;
}

/** 개별 퀘스트의 진행 상태 (v4: 다중 퀘스트) */
export interface QuestProgress {
  stage: string;
  completed: string[];
}

/** 포커 커리어 집계 (실제 대결 결과에서만 누적) */
export interface CareerStats {
  duels: number;
  wins: number;
  losses: number;
  walkaways: number;
}

export interface GameState {
  version: number;
  player: PlayerState;
  inventory: string[];
  flags: Record<string, FlagValue>;
  npcs: Record<string, NpcRuntime>;
  /** v4: 진행을 시작한 퀘스트만 담긴다. 없는 id는 '미시작'. */
  quests: Record<string, QuestProgress>;
  unlocked: string[];
  activeEncounter: EncounterState | null;
  /** 다음 대결 시나리오 결정에 쓰는 시드 (대결마다 증가) */
  encounterSeed: number;
  /** v3: 방문한 지역 ID 기록 */
  visitedRegions: string[];
  /** v3: 발견(획득 이력) 기록 — 아이템을 사용해도 컬렉션 기록은 남는다 */
  discovered: string[];
  /** v3: 포커 커리어 집계 */
  career: CareerStats;
  /** v6: 방문한 장소(Location) ID 기록 — 지역 방문(visitedRegions)과 별개 */
  visitedLocations: string[];
}

// ── 위치/맵 ────────────────────────────────────────────────────

export interface MapEntity {
  id: string;
  /** exit: 다른 장소로 이어지는 출입구 (LocationDef.exits에 목적지 정의) */
  kind: 'npc' | 'poi' | 'exit';
  x: number;
  y: number;
  icon: string;
  name: string;
}

/**
 * 장소 출입구 정의. 출입구 엔티티에 인접하면 목적지가 표시되고,
 * 상호작용 버튼으로 이동한다. 잠겨 있으면 잠긴 이유를 보여준다.
 */
export interface ExitDef {
  /** 이 출입구에 해당하는 MapEntity id */
  entityId: string;
  /** 목적지 장소 id */
  to: string;
  /** 목적지 도착 좌표 (도착 장소에서 이동 가능한 빈 칸이어야 한다) */
  arrive: { x: number; y: number };
  /** 방향 안내용 (도착 배너·지역 지도) */
  direction: '북' | '남' | '동' | '서';
  /** 이 출입구가 열리는 조건 — 없으면 항상 열림 */
  requires?: { unlocked?: string; flag?: string };
  /** 잠겨 있을 때 짧은 안내 */
  lockedHint?: string;
}

/**
 * 아직 구현되지 않은 곳으로 이어지는 길 — 배경에 보이지만 장애물로 막혀 있다.
 * 이동 트리거가 없고 목적지 id도 없다. 상호작용하면 막힌 이유만 보여준다.
 */
export interface FutureWayDef {
  /** 막힌 길 앞 장애물 엔티티 id (kind: 'poi') */
  entityId: string;
  /** 기획서 장소 코드 (예: GM-07) — 개발 추적용 */
  code: string;
  /** 플레이어에게 보이는 방향 이름 (목적지 이름 대신 길 모습으로) */
  label: string;
  direction: '북' | '남' | '동' | '서';
  /** 막혀 있는 이유 (세계 안의 사정) */
  lockedHint: string;
}

export interface LocationDef {
  id: string;
  name: string;
  /** 소속 지역 (월드맵 지역 id) */
  regionId: string;
  /** 지역 기획서상의 장소 코드 (예: GM-02) — 기획 추적용, 게임 UI에는 개발 모드에서만 표시 */
  code?: string;
  /** 첫 방문 안내 한 줄 (눈에 띄는 대상) */
  arrivalNote: string;
  /** '#'=벽, '.'=바닥 문자열 행 */
  layout: string[];
  entities: MapEntity[];
  exits: ExitDef[];
  /** 막힌 미래 길 (선택) */
  futureWays?: FutureWayDef[];
  playerStart: { x: number; y: number };
  /** STORY_STUB — 배경 그림 없이 단색·이름표로 그리는 임시 장면 (ui/StubScene) */
  stub?: { tone: string };
}

// ── 아이템/퀘스트 콘텐츠 ────────────────────────────────────────

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export interface QuestStageDef {
  id: string;
  title: string;
  objective: string;
}

/** 퀘스트 유형 — 일지에서 구분 표시 */
export type QuestType =
  | 'main' // 세계 전체에 걸친 주요 스토리
  | 'regional' // 특정 지역의 고유한 사건
  | 'character' // 주요 NPC의 개인적인 이야기
  | 'discovery' // 탐험·정보 수집으로 발견하는 사건
  | 'challenge' // 특별한 규칙·조건의 대결
  | 'cross_region'; // 여러 지역을 잇는 사건

export interface QuestDef {
  id: string;
  name: string;
  type: QuestType;
  regionId: string;
  stages: QuestStageDef[];
}

// ── 대화 ───────────────────────────────────────────────────────

export interface DialogueChoice {
  text: string;
  /** 선택 시 실행할 게임 액션들 */
  effects?: GameAction[];
  /** 다음 노드 id (없으면 대화 종료) */
  next?: string;
  /** 대결 시작 트리거 */
  startEncounter?: boolean;
  /** 선택 후 표시할 이벤트 장면 id (content/events.ts) */
  event?: string;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices: DialogueChoice[];
}

// ── 상태 변경 액션 ─────────────────────────────────────────────

export type GameAction =
  | { type: 'MOVE'; dx: number; dy: number }
  | { type: 'SET_FLAG'; key: string; value: FlagValue }
  | { type: 'ADD_ITEM'; itemId: string }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'ADD_GOLD'; amount: number }
  | { type: 'SET_QUEST_STAGE'; questId: string; stage: string }
  | { type: 'UNLOCK'; id: string }
  | { type: 'NPC_MET'; npcId: string }
  | { type: 'NPC_SET'; npcId: string; patch: Partial<NpcRuntime> }
  | { type: 'GOTO_LOCATION'; locationId: string; x: number; y: number }
  | { type: 'USE_EXIT'; entityId: string }
  | { type: 'ENCOUNTER_START'; npcId: string }
  | { type: 'ENCOUNTER_INTRO_DONE' }
  | { type: 'ENCOUNTER_INFO'; action: InfoActionId }
  | { type: 'ENCOUNTER_CHOOSE'; box: BoxIndex }
  | { type: 'ENCOUNTER_LEAVE' }
  | { type: 'ENCOUNTER_CLOSE' }
  | { type: 'RESET_GAME' }
  | { type: 'LOAD_STATE'; state: GameState };
