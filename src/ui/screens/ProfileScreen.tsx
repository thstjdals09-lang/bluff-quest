import type { GameState } from '../../game/types';
import { CHAMPIONS, REGIONS, getRegionById } from '../../game/content/regions';
import { LOCATION_REGION } from '../../game/content/regions';
import { QUESTS } from '../../game/content/world';
import playerPortrait from '../../assets/player-front.png';

/** 성장 방향 소개 — 확정된 스탯이 아니므로 수치 없이 방향만 보여준다. */
const GROWTH_DIRECTIONS = [
  { name: '블러핑', desc: '상대를 흔드는 기술' },
  { name: '협상', desc: '더 나은 조건을 끌어내는 기술' },
  { name: '관찰', desc: '단서를 놓치지 않는 눈' },
  { name: '승부', desc: '결정적 순간의 담력' },
  { name: '탐험', desc: '숨겨진 것을 찾아내는 감각' },
];

export function ProfileScreen(props: { state: GameState }) {
  const { state } = props;
  const currentRegion = getRegionById(LOCATION_REGION[state.player.location] ?? 'goblin_market');
  const quest = QUESTS[state.quest.id];
  const stageIdx = quest ? quest.stages.findIndex((s) => s.id === state.quest.stage) : 0;
  const progress = quest ? Math.round(((stageIdx + (state.quest.stage === 'done' ? 1 : 0)) / quest.stages.length) * 100) : 0;

  const records: string[] = [];
  if (state.career.duels > 0)
    records.push(`그리즐과 상자 대결 ${state.career.duels}회 (승 ${state.career.wins} · 패 ${state.career.losses})`);
  if (state.npcs.goblin?.caughtLying) records.push('고블린의 거짓말을 간파했다.');
  if (state.flags.warehouse_opened === true) records.push('낡은 열쇠로 오래된 창고를 열었다.');
  if (state.flags.found_invitation === true) records.push('수상한 초대장을 발견했다 — 사기꾼들의 항구가 기다린다.');
  if (records.length === 0) records.push('아직 기록된 모험이 없다. 시장의 고블린에게 말을 걸어 보자.');

  const badges = Object.values(CHAMPIONS);

  return (
    <div className="screen">
      <h2 className="screen-title">👤 승부사 프로필</h2>
      <div className="card profile-head">
        <img className="profile-portrait" src={playerPortrait} alt="플레이어" />
        <div>
          <b>이름 없는 승부사</b>
          <p className="dim">📍 현재 지역: {currentRegion?.name ?? '고블린 시장'}</p>
          <p className="dim">💰 금화 {state.player.gold}닢</p>
        </div>
      </div>

      <div className="card">
        <b>🧭 현재 진행</b>
        {quest && (
          <>
            <p>
              {quest.name} — {quest.stages[Math.max(0, stageIdx)]?.title}
            </p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="dim">{progress}% 진행</p>
          </>
        )}
      </div>

      <div className="card">
        <b>🗺️ 방문한 지역 ({state.visitedRegions.length}/{REGIONS.length})</b>
        <div className="theme-chips">
          {REGIONS.map((r) => {
            const visited = state.visitedRegions.includes(r.id);
            return (
              <span key={r.id} className={`chip ${visited ? 'ok' : ''}`}>
                {visited ? r.name : r.impl === 'unknown' ? '???' : `${r.name} (미방문)`}
              </span>
            );
          })}
        </div>
      </div>

      <div className="card">
        <b>🎖️ 지역 배지 (0/{badges.length})</b>
        <p className="dim">지역 챔피언을 꺾으면 얻는 증표. 챔피언전은 개발 예정이다.</p>
        <div className="badge-row">
          {badges.map((c) => (
            <div key={c.id} className="badge-slot" title={c.badgeName}>
              🔒
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <b>📖 주요 모험 기록</b>
        {records.map((r, i) => (
          <p key={i}>· {r}</p>
        ))}
      </div>

      <div className="card">
        <b>🌱 성장 방향 <span className="chip">개발 예정</span></b>
        <p className="dim">
          승부사로서의 성장 계통. 아직 확정된 수치나 능력이 아니며, 이후 개발에서 실제 시스템으로
          이어질 예정이다.
        </p>
        {GROWTH_DIRECTIONS.map((g) => (
          <div key={g.name} className="content-row">
            <b>{g.name}</b>
            <span className="dim">{g.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
