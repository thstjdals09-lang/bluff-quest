import type { GameState } from './types';
import { SAVE_VERSION, createInitialState } from './state';
import { LOCATIONS } from './content/world';
import { logEvent } from './log';

const SAVE_KEY = 'bluff_quest_save';
const BACKUP_KEY = 'bluff_quest_save_corrupt_backup';
const META_KEY = 'bluff_quest_save_meta';

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
  const s = data as { version?: unknown; player?: { location?: unknown } };
  if (s.version === 1) {
    const locId = typeof s.player?.location === 'string' && LOCATIONS[s.player.location]
      ? s.player.location
      : 'market';
    const loc = LOCATIONS[locId];
    logEvent('info', '세이브 마이그레이션 v1 → v2: 새 맵 좌표계에 맞춰 플레이어 위치를 재배치했습니다.');
    return {
      ...(data as Record<string, unknown>),
      version: 2,
      player: {
        ...(s.player as Record<string, unknown>),
        location: loc.id,
        x: loc.playerStart.x,
        y: loc.playerStart.y,
      },
    };
  }
  return data;
}

/** 세이브 데이터 유효성 검사 — 깨진 데이터로 게임이 멈추지 않게 한다. */
export function validateSave(data: unknown): data is GameState {
  if (typeof data !== 'object' || data === null) return false;
  const s = data as Partial<GameState>;
  return (
    s.version === SAVE_VERSION &&
    typeof s.player === 'object' && s.player !== null &&
    typeof s.player.location === 'string' &&
    typeof s.player.x === 'number' &&
    typeof s.player.y === 'number' &&
    Array.isArray(s.inventory) &&
    typeof s.flags === 'object' && s.flags !== null &&
    typeof s.quest === 'object' && s.quest !== null &&
    Array.isArray(s.unlocked) &&
    typeof s.encounterSeed === 'number'
  );
}

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    const meta: SaveMeta = { savedAt: new Date().toISOString(), version: SAVE_VERSION };
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    return true;
  } catch (e) {
    logEvent('error', `저장 실패: ${String(e)}`);
    return false;
  }
}

/** 저장된 게임 로드. 손상 시 백업 후 새 게임 상태를 반환. */
export function loadGame(): { state: GameState; loadedFromSave: boolean } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
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
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) localStorage.setItem(BACKUP_KEY, raw);
    } catch { /* localStorage 접근 불가 환경 */ }
    return { state: createInitialState(), loadedFromSave: false };
  }
}

export function getSaveMeta(): SaveMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveMeta;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(META_KEY);
    logEvent('info', '세이브 데이터 삭제됨');
  } catch (e) {
    logEvent('error', `세이브 삭제 실패: ${String(e)}`);
  }
}

export function exportSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
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
