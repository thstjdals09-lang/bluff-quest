import type { GameAction, GameState, NpcRuntime } from './types';
import { LOCATIONS } from './content/world';
import { applyInfoAction, chooseBox, getScenario, leaveEncounter, startEncounter } from './encounter';
import { logEvent } from './log';

/**
 * v1: 최초 프로토타입 (이모지 타일맵 그리드)
 * v2: 비주얼 씬 도입으로 지역 그리드 좌표계 변경 — 위치만 재배치하는 마이그레이션 제공
 */
export const SAVE_VERSION = 2;

export function createInitialState(): GameState {
  const loc = LOCATIONS.market;
  return {
    version: SAVE_VERSION,
    player: { location: loc.id, x: loc.playerStart.x, y: loc.playerStart.y, gold: 10 },
    inventory: [],
    flags: {},
    npcs: {},
    quest: { id: 'q_invitation', stage: 'start', completed: [] },
    unlocked: [],
    activeEncounter: null,
    encounterSeed: (Date.now() % 100000) | 0,
  };
}

function getNpc(state: GameState, npcId: string): NpcRuntime {
  return state.npcs[npcId] ?? { meetCount: 0, fooledPlayer: false, caughtLying: false };
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
      return { ...state, inventory: [...state.inventory, action.itemId] };
    case 'REMOVE_ITEM':
      return { ...state, inventory: state.inventory.filter((i) => i !== action.itemId) };
    case 'ADD_GOLD':
      return { ...state, player: { ...state.player, gold: Math.max(0, state.player.gold + action.amount) } };
    case 'SET_QUEST_STAGE':
      if (state.quest.stage === action.stage) return state;
      logEvent('info', `퀘스트 단계: ${state.quest.stage} → ${action.stage}`);
      return {
        ...state,
        quest: {
          ...state.quest,
          stage: action.stage,
          completed: state.quest.completed.includes(state.quest.stage)
            ? state.quest.completed
            : [...state.quest.completed, state.quest.stage],
        },
      };
    case 'COMPLETE_QUEST_STAGE':
      if (state.quest.completed.includes(action.stage)) return state;
      return { ...state, quest: { ...state.quest, completed: [...state.quest.completed, action.stage] } };
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
      return { ...state, player: { ...state.player, location: action.locationId, x: action.x, y: action.y } };
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
      return {
        ...state,
        activeEncounter: enc,
        encounterSeed: state.encounterSeed + 1,
        quest: state.quest.stage === 'start' ? { ...state.quest, stage: 'boxes', completed: [...state.quest.completed, 'start'] } : state.quest,
      };
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
      let next: GameState = { ...state, activeEncounter: enc };
      const npc = getNpc(next, scenario.npcId);
      if (enc.result === 'win') {
        // 보상: 낡은 열쇠 + (거짓말을 간파한 경우) 기념품 칩
        if (!next.inventory.includes('old_key') && !next.flags.warehouse_opened) {
          next = { ...next, inventory: [...next.inventory, 'old_key'] };
        }
        const caught = !scenario.statement.isTrue;
        if (caught && !next.inventory.includes('goblin_tooth_chip')) {
          next = { ...next, inventory: [...next.inventory, 'goblin_tooth_chip'] };
        }
        next = {
          ...next,
          player: { ...next.player, gold: next.player.gold + 5 },
          npcs: { ...next.npcs, [scenario.npcId]: { ...npc, caughtLying: npc.caughtLying || caught } },
        };
        if (next.quest.stage === 'boxes' || next.quest.stage === 'start') {
          next = {
            ...next,
            quest: { ...next.quest, stage: 'find_lock', completed: [...next.quest.completed, 'boxes'] },
          };
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
      return { ...state, activeEncounter: leaveEncounter(state.activeEncounter) };
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
