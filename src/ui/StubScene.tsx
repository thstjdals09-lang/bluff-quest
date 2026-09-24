import { useLayoutEffect, useRef, useState } from 'react';
import type { LocationDef, PlayerState } from '../game/types';
import type { Facing } from '../game/content/scenes';
import { PLAYER_SPRITES } from '../game/content/scenes';

/**
 * STORY_STUB 렌더러 — 배경 그림이 없는 임시 장면.
 * 단색 바닥 격자, 이름표 달린 대상(원: 인물·조사 지점 / 문: 출구), 플레이어 스프라이트만 그린다.
 * 조작·상호작용·저장은 다른 장소와 똑같다. 새 그림 에셋을 쓰지 않는다.
 */
export function StubScene(props: {
  location: LocationDef;
  player: PlayerState;
  facing: Facing;
  moving: boolean;
  highlightId: string | null;
  exitLabel?: string | null;
  locationTitle?: string;
}) {
  const { location, player } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setFrame({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = location.layout[0].length;
  const rows = location.layout.length;
  const landscape = frame.w > frame.h;
  // 세로: 위 HUD·아래 조작부 / 가로: 좌우 조작부·아래 내비를 피한다
  const reserve = landscape ? { top: 64, bottom: 82, side: 150 } : { top: 150, bottom: 250, side: 16 };
  const availW = Math.max(0, frame.w - reserve.side * 2);
  const availH = Math.max(0, frame.h - reserve.top - reserve.bottom);
  const cell = Math.max(28, Math.min(88, Math.floor(Math.min(availW / cols, availH / rows))));
  const gridW = cell * cols;
  const gridH = cell * rows;
  const left = (frame.w - gridW) / 2;
  const top = reserve.top + Math.max(0, (availH - gridH) / 2);

  return (
    <div ref={ref} className="scene-frame stub-frame" style={{ background: location.stub?.tone }} data-stub={location.id}>
      {frame.w > 0 && (
        <div className="stub-grid" style={{ left, top, width: gridW, height: gridH, ['--cell' as string]: `${cell}px` }}>
          {location.layout.map((row, y) =>
            row.split('').map((ch, x) =>
              ch === '#' ? <div key={`w${x}-${y}`} className="stub-wall" style={{ left: x * cell, top: y * cell, width: cell, height: cell }} /> : null,
            ),
          )}
          {location.entities.map((e) => {
            const lit = props.highlightId === e.id;
            return (
              <div
                key={e.id}
                className={`stub-ent ${e.kind} ${lit ? 'lit' : ''}`}
                data-entity={e.id}
                style={{ left: e.x * cell, top: e.y * cell, width: cell, height: cell }}
              >
                <span className="stub-token">{e.icon}</span>
                <span className="stub-name">{e.name}</span>
                {lit && <span className="stub-marker">{props.exitLabel ? <span className="exit-tag">{props.exitLabel}</span> : '❗'}</span>}
              </div>
            );
          })}
          <img
            className={`stub-player ${props.moving ? 'moving' : ''}`}
            src={PLAYER_SPRITES[props.facing]}
            alt="플레이어"
            draggable={false}
            style={{ left: player.x * cell + cell / 2, top: (player.y + 1) * cell, height: cell * 1.55 }}
          />
        </div>
      )}
      <div className="scene-title">📍 {props.locationTitle ?? location.name}</div>
      <div className="stub-badge">임시 장면</div>
    </div>
  );
}
