import type { GameState, QuestType } from '../../game/types';
import { QUESTS } from '../../game/content/world';
import { getRegionById } from '../../game/content/regions';

const TYPE_LABELS: Record<QuestType, { name: string; desc: string }> = {
  main: { name: '메인 퀘스트', desc: '세계 전체에 걸친 주요 스토리.' },
  regional: { name: '지역 퀘스트', desc: '특정 지역의 고유한 사건.' },
  character: { name: '인물 퀘스트', desc: '주요 NPC의 개인적인 이야기.' },
  discovery: { name: '발견 사건', desc: '탐험과 정보 수집으로 발견하는 사건.' },
  challenge: { name: '도전', desc: '특별한 규칙이나 조건을 가진 대결.' },
  cross_region: { name: '월경 사건', desc: '여러 지역을 이동하며 진행하는 사건.' },
};

const TYPE_ORDER: QuestType[] = ['main', 'regional', 'character', 'discovery', 'challenge', 'cross_region'];

/** 퀘스트 일지 — 유형별로 구분하며, 실제 존재하는 퀘스트만 표시한다. */
export function JournalScreen(props: { state: GameState }) {
  const { state } = props;
  const allQuests = Object.values(QUESTS);

  return (
    <div className="screen">
      <h2 className="screen-title">📜 모험 일지</h2>
      <p className="screen-sub">지금까지의 사건과 앞으로의 실마리.</p>
      {TYPE_ORDER.map((type) => {
        const quests = allQuests.filter((q) => q.type === type);
        return (
          <div key={type} className="card">
            <b>{TYPE_LABELS[type].name}</b>
            <p className="dim">{TYPE_LABELS[type].desc}</p>
            {quests.length === 0 ? (
              <p className="dim empty-line">아직 기록된 사건이 없다. 모험이 계속되면 채워진다.</p>
            ) : (
              quests.map((q) => {
                const active = state.quest.id === q.id;
                const region = getRegionById(q.regionId);
                const stageIdx = active ? q.stages.findIndex((s) => s.id === state.quest.stage) : -1;
                const done = active && state.quest.stage === 'done';
                return (
                  <div key={q.id} className="quest-entry">
                    <div className="content-row">
                      <b>{q.name}</b>
                      <span className={`chip ${done ? 'ok' : ''}`}>
                        {done ? '완료' : active ? '진행 중' : '미시작'}
                      </span>
                    </div>
                    {region && <p className="dim">📍 {region.name}</p>}
                    {active && (
                      <div className="stage-list">
                        {q.stages.map((s, i) => {
                          const isPast = state.quest.completed.includes(s.id) || (done && i < q.stages.length);
                          const isCurrent = !done && s.id === state.quest.stage;
                          return (
                            <div
                              key={s.id}
                              className={`stage-line ${isPast && !isCurrent ? 'past' : ''} ${isCurrent ? 'current' : ''}`}
                            >
                              {isCurrent ? '◉' : isPast ? '✓' : '○'} <b>{s.title}</b>
                              {(isCurrent || i === stageIdx) && <span className="dim"> — {s.objective}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
      <p className="dim hint-line">
        떠도는 소문: 세계 곳곳에서 이름난 승부사들이 사라지고 있다고 한다. 수상한 초대장이 그
        열쇠라는 이야기도… (이후 이야기에서 이어진다)
      </p>
    </div>
  );
}
