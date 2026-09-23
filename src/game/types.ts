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
  location: string;
  x: number;
  y: number;
  gold: number;
}

export interface QuestState {
  id: string;
  stage: string;
  completed: string[];
}

export interface GameState {
  version: number;
  player: PlayerState;
  inventory: string[];
  flags: Record<string, FlagValue>;
  npcs: Record<string, NpcRuntime>;
  quest: QuestState;
  unlocked: string[];
  activeEncounter: EncounterState | null;
  /** 다음 대결 시나리오 결정에 쓰는 시드 (대결마다 증가) */
  encounterSeed: number;
}

// ── 위치/맵 ────────────────────────────────────────────────────

export interface MapEntity {
  id: string;
  kind: 'npc' | 'poi';
  x: number;
  y: number;
  icon: string;
  name: string;
}

export interface LocationDef {
  id: string;
  name: string;
  /** '#'=벽, '.'=바닥 문자열 행 */
  layout: string[];
  entities: MapEntity[];
  playerStart: { x: number; y: number };
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

export interface QuestDef {
  id: string;
  name: string;
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
  | { type: 'SET_QUEST_STAGE'; stage: string }
  | { type: 'COMPLETE_QUEST_STAGE'; stage: string }
  | { type: 'UNLOCK'; id: string }
  | { type: 'NPC_MET'; npcId: string }
  | { type: 'NPC_SET'; npcId: string; patch: Partial<NpcRuntime> }
  | { type: 'GOTO_LOCATION'; locationId: string; x: number; y: number }
  | { type: 'ENCOUNTER_START'; npcId: string }
  | { type: 'ENCOUNTER_INTRO_DONE' }
  | { type: 'ENCOUNTER_INFO'; action: InfoActionId }
  | { type: 'ENCOUNTER_CHOOSE'; box: BoxIndex }
  | { type: 'ENCOUNTER_LEAVE' }
  | { type: 'ENCOUNTER_CLOSE' }
  | { type: 'RESET_GAME' }
  | { type: 'LOAD_STATE'; state: GameState };
