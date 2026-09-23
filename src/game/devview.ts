/** 개발자 툴용 공간 디버그 오버레이 플래그 (세이브와 무관한 개발 전용 상태) */

export interface DevViewFlags {
  /** 그리드 셀·이동 가능 여부 표시 */
  grid: boolean;
  /** 엔티티 앵커·z-index 표시 */
  anchors: boolean;
  /** 플레이어 상호작용 범위 표시 */
  range: boolean;
}

const flags: DevViewFlags = { grid: false, anchors: false, range: false };
const listeners = new Set<() => void>();

export function getDevView(): Readonly<DevViewFlags> {
  return flags;
}

export function setDevView(patch: Partial<DevViewFlags>): void {
  Object.assign(flags, patch);
  listeners.forEach((fn) => fn());
}

export function subscribeDevView(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
