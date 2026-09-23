/** 개발자 툴용 인메모리 오류/이벤트 로그 (콘솔에도 동시 기록) */

export interface LogEntry {
  time: string;
  level: 'info' | 'error';
  message: string;
}

const entries: LogEntry[] = [];
const listeners = new Set<() => void>();

export function logEvent(level: 'info' | 'error', message: string): void {
  entries.push({ time: new Date().toLocaleTimeString(), level, message });
  if (entries.length > 200) entries.shift();
  if (level === 'error') console.error('[BluffQuest]', message);
  else console.log('[BluffQuest]', message);
  listeners.forEach((fn) => fn());
}

export function getLog(): readonly LogEntry[] {
  return entries;
}

export function subscribeLog(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
