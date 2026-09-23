import { useState } from 'react';
import type { Dispatch } from 'react';
import type { GameAction, GameState } from '../../game/types';
import {
  CONTENT_STATUS_LABELS,
  LOCATION_REGION,
  REGIONS,
  getRegionAccess,
  getRegionById,
} from '../../game/content/regions';
import { QUESTS } from '../../game/content/world';
import worldmapImage from '../../assets/worldmap.jpg';

/** 전체 월드맵 + 지역 상세. 지역 데이터는 regions.ts에서만 온다. */
export function WorldMapScreen(props: {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  onExplore: () => void;
}) {
  const { state } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? getRegionById(selectedId) : undefined;

  return (
    <div className="screen">
      <h2 className="screen-title">🗺️ 월드맵</h2>
      <p className="screen-sub">지역을 선택하면 상세 정보를 볼 수 있다.</p>
      <div className="worldmap">
        <img src={worldmapImage} alt="세계 지도" draggable={false} />
        {REGIONS.map((r) => {
          const access = getRegionAccess(r.id, state);
          const current = LOCATION_REGION[state.player.location] === r.id;
          return (
            <button
              key={r.id}
              className={`map-marker ${r.impl} ${access.unlocked ? 'unlocked' : 'locked'}`}
              style={{ left: `${r.marker.x}%`, top: `${r.marker.y}%` }}
              onClick={() => setSelectedId(r.id)}
            >
              <span className="marker-pin">
                {r.impl === 'unknown' ? '❓' : access.unlocked ? (current ? '📍' : '🔓') : '🔒'}
              </span>
              <span className="marker-name">{r.name}</span>
            </button>
          );
        })}
      </div>
      <div className="region-list">
        {REGIONS.map((r) => {
          const access = getRegionAccess(r.id, state);
          return (
            <button key={r.id} className="region-row" onClick={() => setSelectedId(r.id)}>
              <span className="dim">{r.order}</span>
              <b>{r.name}</b>
              <span className={`chip ${r.impl === 'playable' && access.unlocked ? 'ok' : ''}`}>
                {r.impl === 'unknown'
                  ? '미발견'
                  : !access.unlocked
                    ? '잠김'
                    : r.impl === 'playable'
                      ? '플레이 가능'
                      : '미리보기'}
              </span>
            </button>
          );
        })}
      </div>
      {selected && (
        <RegionDetail
          state={state}
          regionId={selected.id}
          onClose={() => setSelectedId(null)}
          onEnter={() => {
            const region = getRegionById(selected.id);
            if (region?.entry) {
              props.dispatch({
                type: 'GOTO_LOCATION',
                locationId: region.entry.locationId,
                x: region.entry.x,
                y: region.entry.y,
              });
              props.onExplore();
            }
          }}
        />
      )}
    </div>
  );
}

function RegionDetail(props: {
  state: GameState;
  regionId: string;
  onClose: () => void;
  onEnter: () => void;
}) {
  const region = getRegionById(props.regionId);
  if (!region) return null;
  const access = getRegionAccess(region.id, props.state);
  const showImage =
    region.image !== null && (!region.previewRequiresUnlock || access.unlocked);
  const canEnter = region.impl === 'playable' && access.unlocked && region.entry !== undefined;

  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="dim">{region.order}</div>
            <h3>
              {region.name} <span className="dim">— {region.tagline}</span>
            </h3>
          </div>
          <button onClick={props.onClose}>✕</button>
        </div>

        {region.impl === 'unknown' ? (
          <div className="region-image unknown-region">
            <span>❓</span>
            <p className="dim">아직 알려지지 않은 지역</p>
          </div>
        ) : showImage ? (
          <img className="region-image" src={region.image ?? undefined} alt={region.name} />
        ) : (
          <div className="region-image locked-region">
            <span>🔒</span>
            <p className="dim">{access.hint}</p>
          </div>
        )}

        {region.themes.length > 0 && (
          <div className="theme-chips">
            {region.themes.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        )}
        <p className="sheet-desc">{region.desc}</p>

        <div className="status-row">
          <span className={`chip ${region.impl === 'playable' ? 'ok' : ''}`}>
            구현: {region.impl === 'playable' ? '플레이 가능' : region.impl === 'preview' ? '미리보기' : '미공개'}
          </span>
          <span className={`chip ${access.unlocked ? 'ok' : 'warn'}`}>
            해금: {access.unlocked ? '해금됨' : '잠김'}
          </span>
        </div>
        {!access.unlocked && access.hint && <p className="dim hint-line">💡 {access.hint}</p>}

        {region.champion && (
          <div className="card">
            <b>👑 지역 챔피언</b>
            <p>
              <span className="champ-silhouette">👤</span> {region.champion.tentativeName}
            </p>
            <p className="dim">{region.champion.theme}</p>
            <p className="dim">
              보상: {region.champion.badgeName} ·{' '}
              <span className="chip">{CONTENT_STATUS_LABELS[region.champion.status]}</span>
            </p>
          </div>
        )}

        {region.contents.length > 0 && (
          <div className="card">
            <b>📌 주요 콘텐츠</b>
            {region.contents.map((c) => (
              <div key={c.name} className="content-row">
                <div>
                  <b>{c.name}</b>
                  <p className="dim">{c.desc}</p>
                </div>
                <span className={`chip ${c.status === 'playable' ? 'ok' : ''}`}>
                  {CONTENT_STATUS_LABELS[c.status]}
                </span>
              </div>
            ))}
          </div>
        )}

        {region.questIds.length > 0 && (
          <div className="card">
            <b>🧭 관련 퀘스트</b>
            {region.questIds.map((qid) => {
              const q = QUESTS[qid];
              if (!q) return null;
              const progress = props.state.quests[qid] ?? null;
              const active = progress !== null;
              const done = progress?.stage === 'done';
              return (
                <div key={qid} className="content-row">
                  <b>{q.name}</b>
                  <span className={`chip ${done ? 'ok' : ''}`}>
                    {done ? '완료' : active ? '진행 중' : '미시작'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {canEnter && (
          <button className="primary" onClick={props.onEnter}>
            이 지역 탐험하기
          </button>
        )}
        {region.impl === 'preview' && access.unlocked && (
          <p className="dim hint-line">이 지역의 탐험 콘텐츠는 아직 개발 중이다. 지금은 미리보기만 제공된다.</p>
        )}
      </div>
    </div>
  );
}
