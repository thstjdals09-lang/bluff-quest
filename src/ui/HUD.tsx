import { useState } from 'react';
import type { Dispatch } from 'react';
import type { GameAction, GameState } from '../game/types';
import { ITEMS, QUESTS } from '../game/content/world';
import { clearSave } from '../game/save';

export function HUD(props: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const { state } = props;
  const [showInv, setShowInv] = useState(false);
  const quest = QUESTS[state.quest.id];
  const stage = quest?.stages.find((s) => s.id === state.quest.stage);

  const newGame = () => {
    if (window.confirm('정말 처음부터 시작할까요? 현재 세이브 데이터가 삭제됩니다.')) {
      clearSave();
      props.dispatch({ type: 'RESET_GAME' });
    }
  };

  return (
    <header className="hud">
      <div className="hud-row">
        <span className="hud-gold">💰 {state.player.gold}</span>
        <button onClick={() => setShowInv((v) => !v)}>🎒 가방 ({state.inventory.length})</button>
        <button onClick={newGame}>🔄 처음부터</button>
      </div>
      {stage && (
        <div className="hud-quest">
          🧭 <b>{quest.name}</b> · {stage.title} — {stage.objective}
        </div>
      )}
      {showInv && (
        <div className="inventory">
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
      )}
    </header>
  );
}
