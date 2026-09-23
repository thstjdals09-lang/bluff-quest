import type { GameState } from '../../game/types';
import { SAVE_VERSION } from '../../game/state';
import { getSaveMeta } from '../../game/save';
import { getAccountById, getCurrentAccountId } from '../../game/accounts';

export function SettingsScreen(props: { state: GameState; onExitToTitle: () => void }) {
  const meta = getSaveMeta();
  const accountId = getCurrentAccountId();
  const account = accountId ? getAccountById(accountId) : undefined;

  return (
    <div className="screen">
      <h2 className="screen-title">⚙️ 설정</h2>

      <div className="card">
        <b>👤 계정</b>
        <p>
          {account?.name ?? '알 수 없음'} <span className="dim">· 승부사 {props.state.player.name}</span>
        </p>
        <p className="dim">이 기기에 저장되는 프로필입니다. 다른 기기와는 동기화되지 않습니다.</p>
        <button onClick={props.onExitToTitle}>🏠 저장하고 타이틀로</button>
      </div>

      <div className="card">
        <b>💾 세이브</b>
        <p className="dim">
          마지막 자동 저장: {meta ? new Date(meta.savedAt).toLocaleString() : '없음'} (v
          {meta?.version ?? SAVE_VERSION})
        </p>
        <p className="dim">
          게임은 중요한 행동 후와 화면 이탈 시 자동으로 저장된다. 처음부터 다시 하려면 타이틀에서
          '새 모험'을 선택한다(확인 절차가 있다).
        </p>
      </div>

      <div className="card">
        <b>ℹ️ 정보</b>
        <p className="dim">BLUFF QUEST 프로토타입 (작업명) · 세이브 포맷 v{SAVE_VERSION}</p>
        <p className="dim">개발자 툴: 개발 모드 또는 주소 뒤에 ?dev 를 붙이면 우하단 DEV 버튼이 나타난다.</p>
      </div>
    </div>
  );
}
