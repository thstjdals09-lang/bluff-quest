import type { GameState } from '../../game/types';
import { CHAMPIONS, CONTENT_STATUS_LABELS } from '../../game/content/regions';

/** 포커 커리어 — 실제 집계(state.career)만 수치로 표시하고, 미구현 콘텐츠는 잠금 표시. */
export function CareerScreen(props: { state: GameState }) {
  const { state } = props;
  const c = state.career;

  return (
    <div className="screen">
      <h2 className="screen-title">🃏 포커 커리어</h2>
      <p className="screen-sub">승부사로서 걸어온 길의 기록.</p>

      <div className="card">
        <b>📊 대결 기록 — 고블린 시장</b>
        <div className="stat-grid">
          <div className="stat"><span className="stat-num">{c.duels}</span><span className="dim">대결</span></div>
          <div className="stat"><span className="stat-num">{c.wins}</span><span className="dim">승리</span></div>
          <div className="stat"><span className="stat-num">{c.losses}</span><span className="dim">패배</span></div>
          <div className="stat"><span className="stat-num">{c.walkaways}</span><span className="dim">물러남</span></div>
        </div>
        {c.duels === 0 && <p className="dim">아직 대결 기록이 없다. 그리즐의 상자가 기다린다.</p>}
        {c.walkaways > 0 && (
          <p className="dim">물러남은 패배가 아니다 — 확신 없는 판을 접는 것도 실력이다.</p>
        )}
      </div>

      <div className="card">
        <b>👑 챔피언 기록</b>
        {Object.values(CHAMPIONS).map((ch) => (
          <div key={ch.id} className="content-row">
            <div>
              <b>{ch.tentativeName}</b>
              <p className="dim">{ch.theme}</p>
            </div>
            <span className="chip">{CONTENT_STATUS_LABELS[ch.status]}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <b>⭐ 특별 대결 기록</b>
        {state.flags.found_invitation === true ? (
          <p>· 수상한 초대장을 손에 넣었다 — 밤의 부두 비밀 경기 참가 자격 <span className="chip">개발 예정</span></p>
        ) : (
          <p className="dim">아직 특별 대결에 초대받지 못했다.</p>
        )}
      </div>

      <div className="card">
        <b>🏛️ 포커 클럽</b>
        <p className="dim">각 지역의 승부사들이 모이는 클럽. 커리어와 명성이 쌓이는 곳이다.</p>
        <div className="content-row">
          <b>고블린 포커 클럽</b>
          <span className="chip">개발 예정</span>
        </div>
        <div className="content-row">
          <b>황금 도시 고급 클럽</b>
          <span className="chip">개발 예정</span>
        </div>
      </div>

      <p className="dim hint-line">
        실제 홀덤 대결과 토너먼트는 이후 개발 단계에서 추가될 예정이다.
      </p>
    </div>
  );
}
