import { CONTENT_STATUS_LABELS, SPECIAL_CONTENTS } from '../../game/content/regions';

/** 특별 콘텐츠 — 반복 도전·장기 목표 콘텐츠의 위치와 상태. 전부 제안/개발 예정 단계. */
export function SpecialScreen() {
  return (
    <div className="screen">
      <h2 className="screen-title">🏛️ 특별 콘텐츠</h2>
      <p className="screen-sub">서사가 끝나도 승부는 끝나지 않는다 — 장기 도전 콘텐츠.</p>

      {SPECIAL_CONTENTS.map((sc) => (
        <div key={sc.id} className="card">
          <div className="content-row">
            <b>{sc.id === 'gamblers_tower' ? '🗼 ' : sc.id === 'poker_clubs' ? '🏛️ ' : sc.id === 'secret_arena' ? '🎭 ' : '🗝️ '}{sc.name}</b>
            <span className="chip">{CONTENT_STATUS_LABELS[sc.status]}</span>
          </div>
          <p className="dim">{sc.desc}</p>
          <p className="dim">※ {sc.note}</p>
        </div>
      ))}

      <p className="dim hint-line">
        위 콘텐츠들은 아직 실제 플레이할 수 없다. 규칙과 보상은 기획 확정 후 개발된다.
      </p>
    </div>
  );
}
