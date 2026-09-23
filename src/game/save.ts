import type { GameState } from './types';
import { SAVE_VERSION, createInitialState } from './state';
import { LOCATIONS } from './content/world';
import { logEvent } from './log';

import { LEGACY_SAVE_KEY, accountMetaKey, accountSaveKey, getCurrentAccountId } from './accounts';

/** 현재 계정의 세이브 키 (계정 미선택 시 레거시 키 — 정상 흐름에서는 발생하지 않음) */
function saveKey(): string {
  const id = getCurrentAccountId();
  return id ? accountSaveKey(id) : LEGACY_SAVE_KEY;
}
function metaKey(): string {
  const id = getCurrentAccountId();
  return id ? accountMetaKey(id) : 'bluff_quest_save_meta';
}
const BACKUP_KEY = 'bluff_quest_save_corrupt_backup';

export interface SaveMeta {
  savedAt: string;
  version: number;
}

/**
 * 구버전 세이브 마이그레이션.
 * v1 → v2: 지역 그리드 좌표계가 바뀌었으므로 플레이어 위치만 해당 지역의
 * 시작 지점으로 재배치한다. 인벤토리·퀘스트·플래그·대결 상태는 그대로 보존한다.
 */
export function migrateSave(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;
  let cur = data as Record<string, unknown>;

  // v1 → v2: 지역 그리드 좌표계 변경 — 위치만 시작 지점으로 재배치
  if (cur.version === 1) {
    const player = (cur.player ?? {}) as Record<string, unknown>;
    const locId =
      typeof player.location === 'string' && LOCATIONS[player.location] ? player.location : 'market';
    const loc = LOCATIONS[locId];
    logEvent('info', '세이브 마이그레이션 v1 → v2: 새 맵 좌표계에 맞춰 플레이어 위치를 재배치했습니다.');
    cur = {
      ...cur,
      version: 2,
      player: {
        ...player,
        location: loc.id,
        x: loc.playerStart.x,
        y: loc.playerStart.y,
      },
    };
  }

  // v2 → v3: 월드 프레임워크 필드 추가 (기존 진행은 그대로 보존)
  if (cur.version === 2) {
    const inventory = Array.isArray(cur.inventory) ? (cur.inventory as string[]) : [];
    logEvent('info', '세이브 마이그레이션 v2 → v3: 방문 지역·발견 기록·커리어 필드를 추가했습니다.');
    cur = {
      ...cur,
      version: 3,
      visitedRegions: ['goblin_market'],
      discovered: [...inventory],
      career: { duels: 0, wins: 0, losses: 0, walkaways: 0 },
    };
  }

  // v3 → v4: 단일 quest 필드를 다중 quests 맵으로 전환 (진행 그대로 이전)
  if (cur.version === 3) {
    const oldQuest = cur.quest as { id?: unknown; stage?: unknown; completed?: unknown } | undefined;
    const questId = typeof oldQuest?.id === 'string' ? oldQuest.id : 'q_invitation';
    const stage = typeof oldQuest?.stage === 'string' ? oldQuest.stage : 'start';
    const completed = Array.isArray(oldQuest?.completed) ? (oldQuest!.completed as string[]) : [];
    logEvent('info', '세이브 마이그레이션 v3 → v4: 퀘스트 진행을 다중 퀘스트 구조로 이전했습니다.');
    const { quest: _removed, ...rest } = cur;
    cur = {
      ...rest,
      version: 4,
      quests: { [questId]: { stage, completed } },
    };
  }

  // v4 → v5: 플레이어 이름 필드 추가 (기존 플레이어는 기본 명칭)
  if (cur.version === 4) {
    const player = (cur.player ?? {}) as Record<string, unknown>;
    logEvent('info', '세이브 마이그레이션 v4 → v5: 승부사 이름 필드를 추가했습니다.');
    cur = {
      ...cur,
      version: 5,
      player: { ...player, name: typeof player.name === 'string' ? player.name : '이름 없는 승부사' },
    };
  }

  return cur;
}

/** 세이브 데이터 유효성 검사 — 깨진 데이터로 게임이 멈추지 않게 한다. */
export function validateSave(data: unknown): data is GameState {
  if (typeof data !== 'object' || data === null) return false;
  const s = data as Partial<GameState>;
  return (
    s.version === SAVE_VERSION &&
    typeof s.player === 'object' && s.player !== null &&
    typeof s.player.name === 'string' &&
    typeof s.player.location === 'string' &&
    typeof s.player.x === 'number' &&
    typeof s.player.y === 'number' &&
    Array.isArray(s.inventory) &&
    typeof s.flags === 'object' && s.flags !== null &&
    typeof s.quests === 'object' && s.quests !== null &&
    Array.isArray(s.unlocked) &&
    typeof s.encounterSeed === 'number' &&
    Array.isArray(s.visitedRegions) &&
    Array.isArray(s.discovered) &&
    typeof s.career === 'object' && s.career !== null &&
    typeof s.career.duels === 'number'
  );
}

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(saveKey(), JSON.stringify(state));
    const meta: SaveMeta = { savedAt: new Date().toISOString(), version: SAVE_VERSION };
    localStorage.setItem(metaKey(), JSON.stringify(meta));
    return true;
  } catch (e) {
    logEvent('error', `저장 실패: ${String(e)}`);
    return false;
  }
}

/** 저장된 게임 로드. 손상 시 백업 후 새 게임 상태를 반환. */
export function loadGame(): { state: GameState; loadedFromSave: boolean } {
  try {
    const raw = localStorage.getItem(saveKey());
    if (!raw) return { state: createInitialState(), loadedFromSave: false };
    const parsed: unknown = migrateSave(JSON.parse(raw));
    if (!validateSave(parsed)) {
      localStorage.setItem(BACKUP_KEY, raw);
      logEvent('error', '세이브 데이터가 손상되어 백업 후 새 게임을 시작합니다.');
      return { state: createInitialState(), loadedFromSave: false };
    }
    return { state: parsed, loadedFromSave: true };
  } catch (e) {
    logEvent('error', `세이브 로드 실패: ${String(e)} — 새 게임을 시작합니다.`);
    try {
      const raw = localStorage.getItem(saveKey());
      if (raw) localStorage.setItem(BACKUP_KEY, raw);
    } catch { /* localStorage 접근 불가 환경 */ }
    return { state: createInitialState(), loadedFromSave: false };
  }
}

export function getSaveMeta(): SaveMeta | null {
  try {
    const raw = localStorage.getItem(metaKey());
    if (!raw) return null;
    return JSON.parse(raw) as SaveMeta;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(saveKey());
    localStorage.removeItem(metaKey());
    logEvent('info', '세이브 데이터 삭제됨');
  } catch (e) {
    logEvent('error', `세이브 삭제 실패: ${String(e)}`);
  }
}

export function exportSave(): string | null {
  try {
    return localStorage.getItem(saveKey());
  } catch {
    return null;
  }
}

export function importSave(json: string): GameState | null {
  try {
    const parsed: unknown = migrateSave(JSON.parse(json));
    if (!validateSave(parsed)) {
      logEvent('error', '가져온 세이브 데이터가 유효하지 않습니다.');
      return null;
    }
    return parsed;
  } catch (e) {
    logEvent('error', `세이브 가져오기 실패: ${String(e)}`);
    return null;
  }
}
