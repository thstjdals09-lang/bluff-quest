import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { LocationDef, PlayerState } from '../game/types';
import type { Facing } from '../game/content/scenes';
import { PLAYER_SPRITES, SCENES, projectToScreen } from '../game/content/scenes';
import { getDevView, subscribeDevView } from '../game/devview';
import { isDevMode } from '../App';

/**
 * 배경 플레이트 + 원근 투영 + Y-sort 스프라이트 씬 렌더러.
 * 게임 로직 좌표(그리드)는 그대로 두고, 화면 표시만 이 컴포넌트가 담당한다.
 */
export function SceneView(props: {
  location: LocationDef;
  player: PlayerState;
  facing: Facing;
  moving: boolean;
  highlightId: string | null;
}) {
  const { location, player } = props;
  const scene = SCENES[location.id];
  const [, forceDev] = useState(0);
  useEffect(() => subscribeDevView(() => forceDev((n) => n + 1)), []);

  if (!scene) return null;

  const cols = location.layout[0].length;
  const rows = location.layout.length;
  const proj = scene.projection;
  const project = (gx: number, gy: number) => projectToScreen(proj, cols, rows, gx, gy);

  const p = project(player.x, player.y);
  const dev = getDevView();
  const devEnabled = isDevMode();

  return (
    <div className="scene" style={{ aspectRatio: scene.aspect }}>
      <img className="scene-bg" src={scene.bg} alt="" draggable={false} />
      {scene.tint && <div className="scene-tint" style={{ background: scene.tint }} />}

      {/* 오브젝트 스프라이트 (Y-sort) */}
      {scene.objects.map((obj) => {
        const entity = location.entities.find((e) => e.id === obj.entityId);
        if (!entity) return null;
        const pt = project(entity.x, entity.y);
        const x = pt.x + (obj.offsetX ?? 0);
        const y = pt.y + (obj.offsetY ?? 0);
        const h = obj.height * pt.scale;
        const highlighted = props.highlightId === entity.id;
        return (
          <div key={obj.entityId}>
            <img
              className={`scene-obj ${highlighted ? 'lit' : ''}`}
              src={obj.sprite}
              alt={entity.name}
              draggable={false}
              style={{ left: `${x}%`, top: `${y}%`, height: `${h}%`, zIndex: pt.z }}
            />
            {obj.nameplate && (
              <div className="nameplate" style={{ left: `${x}%`, top: `${y - h - 1}%`, zIndex: pt.z }}>
                {entity.name}
              </div>
            )}
            {highlighted && (
              <div className="interact-marker" style={{ left: `${x}%`, top: `${y - h - (obj.nameplate ? 4.5 : 1)}%`, zIndex: pt.z + 1 }}>
                ❗
              </div>
            )}
          </div>
        );
      })}

      {/* 배경에 그려진 상호작용 지점(스프라이트 없는 엔티티)의 마커 */}
      {location.entities
        .filter((e) => !scene.objects.some((o) => o.entityId === e.id))
        .map((e) => {
          const pt = project(e.x, e.y);
          return props.highlightId === e.id ? (
            <div key={e.id} className="interact-marker" style={{ left: `${pt.x}%`, top: `${pt.y - 6}%`, zIndex: pt.z + 1 }}>
              ❗
            </div>
          ) : null;
        })}

      {/* 플레이어 */}
      <img
        className={`scene-player ${props.moving ? 'moving' : ''}`}
        src={PLAYER_SPRITES[props.facing]}
        alt="플레이어"
        draggable={false}
        style={{
          left: `${p.x}%`,
          top: `${p.y}%`,
          height: `${scene.playerHeight * p.scale}%`,
          zIndex: p.z,
        }}
      />

      {/* 개발 모드 공간 디버그 오버레이 */}
      {devEnabled && (dev.grid || dev.anchors || dev.range) && (
        <DevOverlay location={location} player={player} project={project} flags={dev} />
      )}

      <div className="scene-title">📍 {location.name}</div>
    </div>
  );
}

function DevOverlay(props: {
  location: LocationDef;
  player: PlayerState;
  project: (x: number, y: number) => { x: number; y: number; scale: number; z: number };
  flags: { grid: boolean; anchors: boolean; range: boolean };
}) {
  const { location, player, project, flags } = props;
  const cells: ReactElement[] = [];
  location.layout.forEach((row, gy) => {
    row.split('').forEach((cell, gx) => {
      const pt = project(gx, gy);
      const entity = location.entities.find((e) => e.x === gx && e.y === gy);
      const walkable = cell === '.' && !entity;
      const inRange = Math.abs(gx - player.x) + Math.abs(gy - player.y) === 1;
      if (flags.grid || (flags.range && inRange)) {
        cells.push(
          <div
            key={`c-${gx}-${gy}`}
            className={`dev-cell ${walkable ? 'walkable' : 'blocked'} ${flags.range && inRange ? 'in-range' : ''}`}
            style={{
              left: `${pt.x}%`,
              top: `${pt.y}%`,
              width: `${5 * pt.scale}%`,
              height: `${3 * pt.scale}%`,
            }}
          >
            {flags.anchors ? `${gx},${gy}` : ''}
          </div>,
        );
      }
    });
  });
  return (
    <div className="dev-overlay">
      {cells}
      {flags.anchors &&
        location.entities.map((e) => {
          const pt = project(e.x, e.y);
          return (
            <div key={e.id} className="dev-anchor" style={{ left: `${pt.x}%`, top: `${pt.y}%` }}>
              ⌖ {e.id} z{pt.z}
            </div>
          );
        })}
      {flags.anchors && (
        <div className="dev-anchor player" style={{ left: `${project(player.x, player.y).x}%`, top: `${project(player.x, player.y).y}%` }}>
          ⌖ player z{project(player.x, player.y).z}
        </div>
      )}
    </div>
  );
}
