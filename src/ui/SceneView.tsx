import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { FlagValue, LocationDef, PlayerState } from '../game/types';
import type { Facing } from '../game/content/scenes';
import { PLAYER_SPRITES, SCENES, projectToScreen } from '../game/content/scenes';
import { getDevView, subscribeDevView } from '../game/devview';
import { setCameraInfo } from '../game/uidebug';
import { isDevMode } from '../App';
import { StubScene } from './StubScene';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * 가로 화면에서 세로 배경을 폭에 맞추면 월드가 화면 높이의 3배 이상으로 커져
 * 위쪽 NPC·진열대가 상단 HUD 뒤로 밀린다. 월드 높이를 화면 높이의 이 배수로 제한하고
 * 남는 좌우는 흐린 배경으로 채운다 (세로 화면은 이 분기에 들어오지 않음).
 */
const LANDSCAPE_MAX_WORLD_H = 2.0;

/**
 * 전체 화면 탐험 씬 렌더러 (Phase 4 카메라 시스템).
 *
 * - 씬 월드(배경 플레이트 + 스프라이트)를 뷰포트보다 크게 렌더링하고
 *   카메라가 플레이어를 따라가며 씬 경계에서 클램프된다.
 * - 게임 로직 좌표(그리드)와 충돌 판정은 그대로, 화면 표시만 담당한다.
 * - 깊이 정렬은 기존 Y-sort 유지.
 */
export function SceneView(props: {
  location: LocationDef;
  player: PlayerState;
  facing: Facing;
  moving: boolean;
  highlightId: string | null;
  /** 인접한 대상이 출입구일 때의 목적지 표시 (예: "→ 오래된 창고") */
  exitLabel?: string | null;
  /** 상단 장소 표시 (지역 · 장소) */
  locationTitle?: string;
  flags: Record<string, FlagValue>;
  /** 엔티티별 호객·혼잣말 말풍선 (없으면 표시 안 함) */
  barks?: Record<string, string>;
}) {
  const { location, player } = props;
  const scene = SCENES[location.id];
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [, forceDev] = useState(0);
  useEffect(() => subscribeDevView(() => forceDev((n) => n + 1)), []);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrame({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = location.layout[0].length;
  const rows = location.layout.length;
  const proj = scene?.projection;
  const project = (gx: number, gy: number) => projectToScreen(proj!, cols, rows, gx, gy);

  // ── 카메라 계산 ──
  let worldW = 0;
  let worldH = 0;
  let tx = 0;
  let ty = 0;
  let p = { x: 50, y: 50, scale: 1, z: 100 };
  if (scene && frame.w > 0 && frame.h > 0) {
    worldH = frame.h * scene.cameraZoom;
    worldW = worldH * scene.bgAspect;
    if (worldW < frame.w) {
      worldW = frame.w;
      worldH = worldW / scene.bgAspect;
      if (worldH > frame.h * LANDSCAPE_MAX_WORLD_H) {
        worldH = frame.h * LANDSCAPE_MAX_WORLD_H;
        worldW = worldH * scene.bgAspect;
      }
    }
    p = project(player.x, player.y);
    const px = (p.x / 100) * worldW;
    // 카메라는 캐릭터 몸통 중심을 따라간다 (발 위치보다 약간 위)
    const py = (p.y / 100) * worldH - (scene.playerHeight * p.scale * worldH) / 100 / 2;
    tx = worldW < frame.w ? (frame.w - worldW) / 2 : clamp(frame.w / 2 - px, frame.w - worldW, 0);
    ty = clamp(frame.h * 0.55 - py, frame.h - worldH, 0);
  }

  useEffect(() => {
    if (frame.w > 0 && scene) {
      setCameraInfo({ zoom: scene.cameraZoom, worldW, worldH, tx, ty, frameW: frame.w, frameH: frame.h });
    }
    // eslint 없음 — 의도적으로 매 렌더 갱신
  });

  if (!scene) {
    // 그림이 없는 임시 장면(STORY_STUB)
    return location.stub ? (
      <StubScene
        location={location}
        player={player}
        facing={props.facing}
        moving={props.moving}
        highlightId={props.highlightId}
        exitLabel={props.exitLabel}
        locationTitle={props.locationTitle}
      />
    ) : null;
  }
  // 상호작용 대상 마커는 대상 앞에 선 플레이어 스프라이트에 가려지지 않도록 항상 플레이어보다 위에 그린다
  const markerZ = (z: number) => Math.max(z, p.z) + 2;
  const dev = getDevView();
  const devEnabled = isDevMode();

  return (
    <div ref={frameRef} className="scene-frame">
      {worldW > 0 && worldW < frame.w && <img className="scene-backdrop" src={scene.bg} alt="" draggable={false} />}
      <div
        className="scene-world"
        style={{
          width: worldW || '100%',
          height: worldH || '100%',
          transform: `translate3d(${tx}px, ${ty}px, 0)`,
        }}
      >
        <img className="scene-bg" src={scene.bg} alt="" draggable={false} />
        {scene.tint && <div className="scene-tint" style={{ background: scene.tint }} />}

        {/* 오브젝트 스프라이트 (Y-sort) */}
        {scene.objects.map((obj) => {
          const entity = location.entities.find((e) => e.id === obj.entityId);
          if (!entity) return null;
          if (obj.hideWhenFlag && props.flags[obj.hideWhenFlag] === true) return null;
          const pt = project(entity.x, entity.y);
          const x = pt.x + (obj.offsetX ?? 0);
          const y = pt.y + (obj.offsetY ?? 0);
          const h = obj.height * pt.scale;
          const highlighted = props.highlightId === entity.id;
          const bark = props.barks?.[entity.id];
          return (
            <div key={obj.entityId}>
              {obj.glow ? (
                <div
                  className="scene-glow"
                  style={{ left: `${x}%`, top: `${y}%`, width: `${h * 1.6}%`, zIndex: pt.z }}
                />
              ) : (
                <img
                  className={`scene-obj ${highlighted ? 'lit' : ''}`}
                  src={obj.sprite}
                  alt={entity.name}
                  draggable={false}
                  style={{ left: `${x}%`, top: `${y}%`, height: `${h}%`, zIndex: pt.z }}
                />
              )}
              {obj.nameplate && (
                <div className="nameplate" style={{ left: `${x}%`, top: `${y - h - 0.5}%`, zIndex: pt.z }}>
                  {entity.name}
                </div>
              )}
              {bark && !highlighted && worldW > 0 && (
                <div
                  className="scene-bark"
                  style={{
                    // 말풍선은 화면(카메라) 안쪽에 보이도록 가로 위치를 보정한다
                    left: `${((clamp((x / 100) * worldW + tx, 96, frame.w - 156) - tx) / worldW) * 100}%`,
                    // 말풍선 아래 끝이 상단 HUD(약 150px)보다 아래, 하단 내비(약 80px)보다 위에 오도록
                    top: `${((clamp(((y - h - 3) / 100) * worldH + ty, 150, Math.max(150, frame.h - 80)) - ty) / worldH) * 100}%`,
                    zIndex: pt.z + 2,
                  }}
                >
                  {bark}
                </div>
              )}
              {highlighted && (
                <div
                  className="interact-marker"
                  style={{ left: `${x}%`, top: `${y - h - (obj.nameplate ? 3.5 : 0.5)}%`, zIndex: markerZ(pt.z) }}
                >
                  {props.exitLabel ? <span className="exit-tag">{props.exitLabel}</span> : '❗'}
                  {!props.exitLabel && !obj.nameplate && pt.z < p.z && <span className="marker-name">{entity.name}</span>}
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
              <div key={e.id} className="interact-marker" style={{ left: `${pt.x}%`, top: `${pt.y - 5}%`, zIndex: markerZ(pt.z) }}>
                {props.exitLabel ? <span className="exit-tag">{props.exitLabel}</span> : '❗'}
                {!props.exitLabel && pt.z < p.z && <span className="marker-name">{e.name}</span>}
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
      </div>
      <div className="scene-title">📍 {props.locationTitle ?? location.name}</div>
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
        <div
          className="dev-anchor player"
          style={{ left: `${project(player.x, player.y).x}%`, top: `${project(player.x, player.y).y}%` }}
        >
          ⌖ player z{project(player.x, player.y).z}
        </div>
      )}
    </div>
  );
}
