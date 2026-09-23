import { useState } from 'react';
import type { GameState } from '../game/types';
import type { ScreenId } from './GlobalNav';
import { ITEMS, QUESTS } from '../game/content/world';

/**
 * 탐험 화면(MODE A) 위에 겹쳐지는 인게임 HUD.
 * 좌상단: 금화·퀘스트 트래커 / 우상단: 지도·가방·일지 아이콘.
 */
export function ExploreHUD(props: { state: GameState; onNavigate: (s: ScreenId) => void }) {
  const { state } = props;
  const [bagOpen, setBagOpen] = useState(false);
  const quest = QUESTS[state.quest.id];
  const stage = quest?.stages.find((s) => s.id === state.quest.stage);

  return (
    <>
      <div className="hud-top-left">
        <div className="hud-gold-pill">💰 {state.player.gold}</div>
        {stage && (
          <button className="hud-quest-pill" onClick={() => props.onNavigate('journal')}>
            <span className="hud-quest-mark">❗</span>
            <span>
              <b>{quest.name}</b>
              <br />
              {stage.title}
            </span>
          </button>
        )}
      </div>

      <div className="hud-top-right">
        <button className="hud-icon" onClick={() => props.onNavigate('worldmap')}>
          <span>🗺️</span>
          <label>지도</label>
        </button>
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
