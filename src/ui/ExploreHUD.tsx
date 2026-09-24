import { useState } from 'react';
import type { GameState } from '../game/types';
import type { ScreenId } from './GlobalNav';
import { ITEMS, getActiveTrackable, getTrackedQuest } from '../game/content/world';

/**
 * 탐험 화면(MODE A) 위에 겹쳐지는 인게임 HUD.
 * 좌상단: 금화·퀘스트 트래커 / 우상단: 지도·가방·일지 아이콘.
 */
export function ExploreHUD(props: {
  state: GameState;
  onNavigate: (s: ScreenId) => void;
  /** 프롤로그 중에는 월드맵 이동을 숨긴다 */
  hideMap?: boolean;
  /** 플레이어가 고른 추적 퀘스트 (UI 선택일 뿐 게임 상태가 아님) */
  trackedQuestId?: string | null;
  onCycleTrack?: () => void;
}) {
  const { state } = props;
  const [bagOpen, setBagOpen] = useState(false);
  const tracked = getTrackedQuest(state, props.trackedQuestId);
  const active = getActiveTrackable(state);
  const trackIdx = tracked ? active.indexOf(tracked.quest.id) : -1;
  const quest = tracked?.quest;
  const stage = tracked?.stage;

  return (
    <>
      <div className="hud-top-left">
        <div className="hud-gold-pill">💰 {state.player.gold}</div>
        {quest && stage && (
          <div className="hud-quest-row">
            <button className="hud-quest-pill" onClick={() => props.onNavigate('journal')}>
              <span className="hud-quest-mark">❗</span>
              <span>
                <b>{quest.name}</b>
                <br />
                {stage.title}
              </span>
            </button>
            {active.length >= 2 && props.onCycleTrack && (
              <button className="hud-quest-cycle" onClick={props.onCycleTrack} aria-label="추적할 사건 바꾸기">
                ⇄ {trackIdx + 1}/{active.length}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="hud-top-right">
        {!props.hideMap && (
          <button className="hud-icon" onClick={() => props.onNavigate('worldmap')}>
            <span>🗺️</span>
            <label>지도</label>
          </button>
        )}
        <button className="hud-icon" onClick={() => setBagOpen(true)}>
          <span>🎒</span>
          <label>가방</label>
        </button>
        <button className="hud-icon" onClick={() => props.onNavigate('journal')}>
          <span>📔</span>
          <label>일지</label>
        </button>
      </div>

      {bagOpen && (
        <div className="sheet-backdrop" onClick={() => setBagOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h3>🎒 가방</h3>
              <button onClick={() => setBagOpen(false)}>✕</button>
            </div>
            {state.inventory.length === 0 && <p className="dim">아직 아무것도 없다.</p>}
            {state.inventory.map((id) => {
              const item = ITEMS[id];
              return item ? (
                <div key={id} className="item">
                  <span className="item-icon">{item.icon}</span>
                  <div>
                    <b>{item.name}</b>
                    <p className="dim">{item.desc}</p>
                  </div>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
    </>
  );
}
