/** 개발자 툴용 UI/카메라 런타임 정보 (세이브와 무관) */

export interface CameraInfo {
  zoom: number;
  worldW: number;
  worldH: number;
  tx: number;
  ty: number;
  frameW: number;
  frameH: number;
}

interface UiDebugState {
  mode: string;
  camera: CameraInfo | null;
}

const state: UiDebugState = { mode: 'explore', camera: null };
const listeners = new Set<() => void>();

export function setUiMode(mode: string): void {
  if (state.mode === mode) return;
  state.mode = mode;
  listeners.forEach((fn) => fn());
}

export function setCameraInfo(camera: CameraInfo): void {
  state.camera = camera;
  listeners.forEach((fn) => fn());
}

export function getUiDebug(): Readonly<UiDebugState> {
  return state;
}

export function subscribeUiDebug(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
