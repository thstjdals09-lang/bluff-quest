import type { Dispatch } from 'react';
import type { GameAction, GameState } from '../../game/types';
import { SAVE_VERSION } from '../../game/state';
import { clearSave, getSaveMeta } from '../../game/save';

export function SettingsScreen(props: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const meta = getSaveMeta();

  const newGame = () => {
    if (window.confirm('정말 처음부터 시작할까요? 현재 세이브 데이터가 삭제됩니다.')) {
      clearSave();
      props.dispatch({ type: 'RESET_GAME' });
    }
  };

  return (
    <div className="screen">
      <h2 className="screen-title">⚙️ 설정</h2>

      <div className="card">
        <b>💾 세이브</b>
        <p className="dim">
          마지막 자동 저장: {meta ? new Date(meta.savedAt).toLocaleString() : '없음'} (v
          {meta?.version ?? SAVE_VERSION})
        </p>
        <p className="dim">게임은 중요한 행동 후와 화면 이탈 시 자동으로 저장된다.</p>
        <button className="danger" onClick={newGame}>
          🔄 처음부터 시작 (세이브 삭제)
        </button>
      </div>

      <div className="card">
        <b>ℹ️ 정보</b>
        <p className="dim">BLUFF QUEST 프로토타입 (작업명) · 세이브 포맷 v{SAVE_VERSION}</p>
        <p className="dim">개발자 툴: 개발 모드 또는 주소 뒤에 ?dev 를 붙이면 우하단 DEV 버튼이 나타난다.</p>
      </div>
    </div>
  );
}
