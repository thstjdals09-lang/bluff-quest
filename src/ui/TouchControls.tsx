import { useCallback, useEffect, useRef } from 'react';

/**
 * MODE A 전용 터치 조작 — 씬 위에 겹쳐지는 원형 방향 패드(좌하단)와
 * 상호작용 버튼(우하단). 누르고 있으면 연속 이동한다.
 */
export function TouchControls(props: {
  onMove: (dx: number, dy: number) => void;
  onInteract: () => void;
  interactLabel: string | null;
  /** 버튼 아이콘 — 출입구면 🚪 */
  interactIcon?: string;
}) {
  const repeatRef = useRef<number | undefined>(undefined);
  const { onMove } = props;

  const stop = useCallback(() => {
    window.clearInterval(repeatRef.current);
    repeatRef.current = undefined;
  }, []);

  const start = useCallback(
    (dx: number, dy: number) => {
      stop();
      onMove(dx, dy);
      repeatRef.current = window.setInterval(() => onMove(dx, dy), 230);
    },
    [onMove, stop],
  );

  useEffect(() => stop, [stop]);

  const dir = (dx: number, dy: number, cls: string, glyph: string) => (
    <button
      className={`dpad-btn ${cls}`}
      onPointerDown={(e) => {
        e.preventDefault();
        start(dx, dy);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {glyph}
    </button>
  );

  return (
    <>
      <div className="joystick">
        <div className="joystick-base" />
        {dir(0, -1, 'up', '▲')}
        {dir(-1, 0, 'left', '◀')}
        {dir(1, 0, 'right', '▶')}
        {dir(0, 1, 'down', '▼')}
      </div>
      <button
        className={`interact-fab ${props.interactLabel ? 'active' : ''}`}
        disabled={!props.interactLabel}
        onClick={props.onInteract}
      >
        <span className="interact-fab-icon">{props.interactIcon ?? '💬'}</span>
        <span className="interact-fab-label">{props.interactLabel ?? '가까이 가면\n상호작용'}</span>
      </button>
    </>
  );
}
