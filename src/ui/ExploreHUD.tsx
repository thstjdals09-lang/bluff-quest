import type { GameState } from '../game/types';
import type { ScreenId } from './GlobalNav';
import { getActiveTrackable, getTrackedQuest } from '../game/content/world';

/**
 * 탐험 화면(MODE A) 위에 겹쳐지는 인게임 HUD.
 * 좌상단: 금화·퀘스트 트래커 / 우상단: 지도·가방·일지 아이콘.
 * 가방은 App이 여는 GameSheet(BagPanel) — 여기서는 버튼만.
 */
export function ExploreHUD(props: {
  state: GameState;
  onNavigate: (s: ScreenId) => void;
  /** 프롤로그 중에는 월드맵 이동을 숨긴다 */
  hideMap?: boolean;
  /** 플레이어가 고른 추적 퀘스트 (UI 선택일 뿐 게임 상태가 아님) */
  trackedQuestId?: string | null;
  onCycleTrack?: () => void;
  onOpenBag: () => void;
  /** 대화·연출·장소 전환 중에는 가방을 열 수 없다 */
  bagDisabled?: boolean;
  /** 방금 가방을 닫았다 — 버튼이 한 번 빛나 돌아온 자리를 알려 준다 */
  bagPulse?: number;
}) {
  const { state } = props;
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
        <button
          key={`bag-${props.bagPulse ?? 0}`}
          className={`hud-icon hud-bag ${props.bagPulse ? 'pulse' : ''}`}
          onClick={props.onOpenBag}
          disabled={props.bagDisabled}
          aria-label="가방 열기"
        >
          <span>🎒</span>
          <label>가방</label>
        </button>
        <button className="hud-icon" onClick={() => props.onNavigate('journal')}>
          <span>📔</span>
          <label>일지</label>
        </button>
      </div>

    </>
  );
}
