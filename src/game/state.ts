import type { GameAction, GameState, NpcRuntime } from './types';
import { LOCATIONS } from './content/world';
import { LOCATION_REGION } from './content/regions';
import { applyInfoAction, chooseBox, getScenario, leaveEncounter, startEncounter } from './encounter';
import { logEvent } from './log';

/**
 * v1: 최초 프로토타입 (이모지 타일맵 그리드)
 * v2: 비주얼 씬 도입으로 지역 그리드 좌표계 변경 — 위치만 재배치하는 마이그레이션 제공
 * v3: 월드 프레임워크 — 방문 지역·발견 기록·포커 커리어 필드 추가
 * v4: 스토리 확장 — 단일 quest 필드를 다중 quests 맵으로 전환
 */
export const SAVE_VERSION = 4;

export function createInitialState(): GameState {
  const loc = LOCATIONS.market;
  return {
    version: SAVE_VERSION,
    player: { location: loc.id, x: loc.playerStart.x, y: loc.playerStart.y, gold: 10 },
    inventory: [],
    flags: {},
    npcs: {},
    quests: { q_invitation: { stage: 'start', completed: [] } },
    unlocked: [],
    activeEncounter: null,
    encounterSeed: (Date.now() % 100000) | 0,
    visitedRegions: ['goblin_market'],
    discovered: [],
    career: { duels: 0, wins: 0, losses: 0, walkaways: 0 },
  };
}

function getNpc(state: GameState, npcId: string): NpcRuntime {
  return state.npcs[npcId] ?? { meetCount: 0, fooledPlayer: false, caughtLying: false };
}

/** 퀘스트 단계 진행 — 진행 항목이 없으면 생성하고, 이전 단계를 완료 목록에 남긴다. */
export function setQuestStage(state: GameState, questId: string, stage: string): GameState {
  const cur = state.quests[questId];
  if (cur?.stage === stage) return state;
  logEvent('info', `퀘스트 [${questId}] 단계: ${cur?.stage ?? '(시작)'} → ${stage}`);
  const completed = cur
    ? cur.completed.includes(cur.stage)
      ? cur.completed
      : [...cur.completed, cur.stage]
    : [];
  return { ...state, quests: { ...state.quests, [questId]: { stage, completed } } };
}

/** 퀘스트 진행 조회 헬퍼 — 없으면 null(미시작) */
export function getQuest(state: GameState, questId: string) {
  return state.quests[questId] ?? null;
}

function isWalkable(state: GameState, x: number, y: number): boolean {
  const loc = LOCATIONS[state.player.location];
  if (!loc) return false;
  const row = loc.layout[y];
  if (!row || row[x] !== '.') return false;
  return !loc.entities.some((e) => e.x === x && e.y === y);
}

/** 순수 리듀서: 모든 게임 상태 변경은 여기서만 일어난다. */
export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE': {
      const nx = state.player.x + action.dx;
      const ny = state.player.y + action.dy;
      if (!isWalkable(state, nx, ny)) return state;
      return { ...state, player: { ...state.player, x: nx, y: ny } };
    }
    case 'SET_FLAG':
      return { ...state, flags: { ...state.flags, [action.key]: action.value } };
    case 'ADD_ITEM':
      if (state.inventory.includes(action.itemId)) return state;
      logEvent('info', `아이템 획득: ${action.itemId}`);
      return {
        ...state,
        inventory: [...state.inventory, action.itemId],
        discovered: state.discovered.includes(action.itemId)
          ? state.discovered
          : [...state.discovered, action.itemId],
      };
    case 'REMOVE_ITEM':
      return { ...state, inventory: state.inventory.filter((i) => i !== action.itemId) };
    case 'ADD_GOLD':
      return { ...state, player: { ...state.player, gold: Math.max(0, state.player.gold + action.amount) } };
    case 'SET_QUEST_STAGE':
      return setQuestStage(state, action.questId, action.stage);
    case 'UNLOCK':
      if (state.unlocked.includes(action.id)) return state;
      logEvent('info', `해금: ${action.id}`);
      return { ...state, unlocked: [...state.unlocked, action.id] };
    case 'NPC_MET': {
      const npc = getNpc(state, action.npcId);
      return { ...state, npcs: { ...state.npcs, [action.npcId]: { ...npc, meetCount: npc.meetCount + 1 } } };
    }
    case 'NPC_SET': {
      const npc = getNpc(state, action.npcId);
      return { ...state, npcs: { ...state.npcs, [action.npcId]: { ...npc, ...action.patch } } };
    }
    case 'GOTO_LOCATION': {
      if (!LOCATIONS[action.locationId]) return state;
      const regionId = LOCATION_REGION[action.locationId];
      const firstVisit = regionId !== undefined && !state.visitedRegions.includes(regionId);
      let next: GameState = {
        ...state,
        visitedRegions: firstVisit ? [...state.visitedRegions, regionId] : state.visitedRegions,
        player: { ...state.player, location: action.locationId, x: action.x, y: action.y },
      };
      // 항구 첫 도착: 메인 스토리 다음 장 자동 시작 + 도착 연출 플래그
      if (regionId === 'trickster_port' && !next.quests.q_night_pier) {
        next = setQuestStage(next, 'q_night_pier', 'arrive');
        next = { ...next, flags: { ...next.flags, port_arrived: true } };
      }
      return next;
    }
    case 'ENCOUNTER_START': {
      if (state.activeEncounter && state.activeEncounter.phase !== 'left' && state.activeEncounter.phase !== 'resolved') {
        return state; // 이미 진행 중인 대결은 유지 (세이브 복원 시 내부 상태 보존)
      }
      const bonus = state.flags.mira_hint === true
        ? '미라의 조언: "고블린의 말보다 고블린이 어디를 쳐다보는지를 봐. 몸은 거짓말이 서툴거든."'
        : null;
      const enc = startEncounter(state.encounterSeed, bonus);
      logEvent('info', `대결 시작: 시나리오=${enc.scenarioId} (seed=${enc.seed})`);
      let started: GameState = {
        ...state,
        activeEncounter: enc,
        encounterSeed: state.encounterSeed + 1,
      };
      if (started.quests.q_invitation?.stage === 'start') {
        started = setQuestStage(started, 'q_invitation', 'boxes');
      }
      return started;
    }
    case 'ENCOUNTER_INTRO_DONE': {
      if (!state.activeEncounter || state.activeEncounter.phase !== 'intro') return state;
      return { ...state, activeEncounter: { ...state.activeEncounter, phase: 'info' } };
    }
    case 'ENCOUNTER_INFO': {
      if (!state.activeEncounter) return state;
      return { ...state, activeEncounter: applyInfoAction(state.activeEncounter, action.action) };
    }
    case 'ENCOUNTER_CHOOSE': {
      if (!state.activeEncounter) return state;
      const enc = chooseBox(state.activeEncounter, action.box);
      if (enc.phase !== 'resolved' || enc.result === null) return { ...state, activeEncounter: enc };
      const scenario = getScenario(enc);
      const grantItem = (s: GameState, itemId: string): GameState => ({
        ...s,
        inventory: s.inventory.includes(itemId) ? s.inventory : [...s.inventory, itemId],
        discovered: s.discovered.includes(itemId) ? s.discovered : [...s.discovered, itemId],
      });
      let next: GameState = {
        ...state,
        activeEncounter: enc,
        career: {
          ...state.career,
          duels: state.career.duels + 1,
          wins: state.career.wins + (enc.result === 'win' ? 1 : 0),
          losses: state.career.losses + (enc.result === 'lose' ? 1 : 0),
        },
      };
      const npc = getNpc(next, scenario.npcId);
      if (enc.result === 'win') {
        // 보상: 낡은 열쇠 + (거짓말을 간파한 경우) 기념품 칩
        if (!next.inventory.includes('old_key') && !next.flags.warehouse_opened) {
          next = grantItem(next, 'old_key');
        }
        const caught = !scenario.statement.isTrue;
        if (caught && !next.inventory.includes('goblin_tooth_chip')) {
          next = grantItem(next, 'goblin_tooth_chip');
        }
        next = {
          ...next,
          player: { ...next.player, gold: next.player.gold + 5 },
          npcs: { ...next.npcs, [scenario.npcId]: { ...npc, caughtLying: npc.caughtLying || caught } },
        };
        const invStage = next.quests.q_invitation?.stage;
        if (invStage === 'boxes' || invStage === 'start') {
          next = setQuestStage(next, 'q_invitation', 'find_lock');
        }
      } else {
        next = {
          ...next,
          npcs: { ...next.npcs, [scenario.npcId]: { ...npc, fooledPlayer: true } },
          flags: { ...next.flags, lost_to_goblin: true },
        };
      }
      logEvent('info', `대결 결과: ${enc.result} (상자=${action.box}, 시나리오=${enc.scenarioId})`);
      return next;
    }
    case 'ENCOUNTER_LEAVE': {
      if (!state.activeEncounter) return state;
      const left = leaveEncounter(state.activeEncounter);
      const counted = left.phase === 'left' && state.activeEncounter.phase !== 'left';
      return {
        ...state,
        activeEncounter: left,
        career: counted ? { ...state.career, walkaways: state.career.walkaways + 1 } : state.career,
      };
    }
    case 'ENCOUNTER_CLOSE': {
      if (!state.activeEncounter) return state;
      if (state.activeEncounter.phase !== 'resolved' && state.activeEncounter.phase !== 'left') return state;
      return { ...state, activeEncounter: null };
    }
    case 'RESET_GAME':
      logEvent('info', '게임 초기화');
      return createInitialState();
    case 'LOAD_STATE':
      return action.state;
    default:
      return state;
  }
}
