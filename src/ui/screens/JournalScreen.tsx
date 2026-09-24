import { useState } from 'react';
import type { GameState, QuestType } from '../../game/types';
import { QUESTS, getTrackedQuest, isQuestFinished } from '../../game/content/world';
import { getRegionById } from '../../game/content/regions';
import { RECORD_KIND_LABELS, getDiscoveredRecords } from '../../game/content/records';
import type { RecordKind } from '../../game/content/records';
import { getNotebook } from '../../game/content/incidents';
import type { IncidentView } from '../../game/content/incidents';
import { getRecap, recapAvailable } from '../../game/content/recap';

/** '지금까지' 요약 — 밤의 부두 이정표 이후 일지에서 언제든 다시 펼칠 수 있는 읽기 전용 카드 */
function RecapCard(props: { state: GameState }) {
  const [open, setOpen] = useState(false);
  const recap = getRecap(props.state);
  return (
    <div className="card recap">
      <div className="content-row">
        <b>📖 지금까지의 이야기</b>
        <button className="recap-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : '펼쳐 보기'}
        </button>
      </div>
      {open && (
        <div className="recap-body">
          <p className="recap-h">지나온 길</p>
          {recap.path.map((p) => (
            <p key={p.name} className="recap-line">
              {p.done ? '✓' : '◉'} <b>{p.name}</b> — {p.stageTitle}
            </p>
          ))}
          {recap.incidents.length > 0 && <p className="recap-h">시장의 사건 (내 판단)</p>}
          {recap.incidents.map((i) => (
            <div key={i.name} className="recap-incident">
              <p className="recap-line">
                <b>{i.name}</b> <span className={`chip ${i.status === 'active' ? 'warn' : 'ok'}`}>{i.status === 'active' ? '진행 중' : '해결'}</span>
              </p>
              <p className="dim recap-counts">{KIND_ORDER.map((k) => `${RECORD_KIND_LABELS[k]} ${i.counts[k]}`).join(' · ')}</p>
              {i.judgements.map((t) => (
                <RecordLine key={t} kind="inference" text={t} />
              ))}
            </div>
          ))}
          {recap.unconfirmed.length > 0 && <p className="recap-h">들었지만 확인하지 못한 이야기</p>}
          {recap.unconfirmed.map((r) => (
            <RecordLine key={r.text} kind={r.kind} text={r.text} />
          ))}
          <p className="dim recap-foot">직접 확인한 사실 {recap.factCount}개 — 나머지는 아직 누군가의 말이다.</p>
        </div>
      )}
    </div>
  );
}

const TYPE_LABELS: Record<QuestType, { name: string; desc: string }> = {
  main: { name: '메인 퀘스트', desc: '세계 전체에 걸친 주요 스토리.' },
  regional: { name: '지역 퀘스트', desc: '특정 지역의 고유한 사건.' },
  character: { name: '인물 퀘스트', desc: '주요 NPC의 개인적인 이야기.' },
  discovery: { name: '발견 사건', desc: '탐험과 정보 수집으로 발견하는 사건.' },
  challenge: { name: '도전', desc: '특별한 규칙이나 조건을 가진 대결.' },
  cross_region: { name: '월경 사건', desc: '여러 지역을 이동하며 진행하는 사건.' },
};

const TYPE_ORDER: QuestType[] = ['main', 'character', 'regional', 'discovery', 'challenge', 'cross_region'];

const KIND_ORDER: RecordKind[] = ['fact', 'claim', 'rumor', 'inference'];

function RecordLine(props: { kind: RecordKind; text: string }) {
  return (
    <p className="record-line">
      <span className={`chip record-${props.kind}`}>{RECORD_KIND_LABELS[props.kind]}</span> {props.text}
    </p>
  );
}

/** 사건 수첩의 사건 한 장 — 상태·현재 실마리·종류별 개수. 기록은 기본으로 펼쳐 두고 접을 수 있다 */
function IncidentCard(props: { inc: IncidentView; tracked: boolean; onTrack?: (questId: string) => void }) {
  const { inc } = props;
  const active = inc.status === 'active';
  return (
    <div className={`incident ${active ? 'active' : 'resolved'}`} data-incident={inc.id}>
      <div className="content-row">
        <b>{inc.name}</b>
        <span className={`chip ${active ? 'warn' : 'ok'}`}>{active ? '진행 중' : '해결'}</span>
      </div>
      {inc.lead && <p className="incident-lead">📍 {inc.lead}</p>}
      <p className="dim incident-counts">
        {KIND_ORDER.map((k) => `${RECORD_KIND_LABELS[k]} ${inc.counts[k]}`).join(' · ')}
      </p>
      {active && props.onTrack && (
        <button className={`incident-track ${props.tracked ? 'on' : ''}`} onClick={() => props.onTrack!(inc.questId)} disabled={props.tracked}>
          {props.tracked ? '📌 추적 중' : '📌 이 사건 추적'}
        </button>
      )}
      {inc.records.length > 0 && (
        <details open>
          <summary>기록 {inc.records.length}개</summary>
          {inc.records.map((r) => (
            <RecordLine key={r.order} kind={r.kind} text={r.text} />
          ))}
        </details>
      )}
    </div>
  );
}

/** 퀘스트 일지 — 사건별 수첩(기본) / 시간순 기록 + 유형별 진행 상태. */
export function JournalScreen(props: { state: GameState; trackedQuestId?: string | null; onTrack?: (questId: string) => void }) {
  const { state } = props;
  const allQuests = Object.values(QUESTS);
  const records = getDiscoveredRecords(state);
  const notebook = getNotebook(state);
  const [view, setView] = useState<'grouped' | 'chrono'>('grouped');
  const trackedId = getTrackedQuest(state, props.trackedQuestId)?.quest.id ?? null;

  return (
    <div className="screen">
      <h2 className="screen-title">📜 모험 일지</h2>
      <p className="screen-sub">지금까지의 사건과 실마리.</p>
      {recapAvailable(state) && <RecapCard state={state} />}

      <div className="card">
        <b>🔎 수집한 정보 ({records.length})</b>
        <p className="dim">확인된 사실과 누군가의 주장은 다르다. 무엇을 믿을지는 당신의 몫이다.</p>
        <div className="journal-toggle" role="tablist">
          <button className={view === 'grouped' ? 'active' : ''} onClick={() => setView('grouped')}>
            사건별
          </button>
          <button className={view === 'chrono' ? 'active' : ''} onClick={() => setView('chrono')}>
            시간순
          </button>
        </div>
        {records.length === 0 && notebook.incidents.length === 0 ? (
          <p className="dim empty-line">아직 기록된 정보가 없다. 세계를 조사해 보자.</p>
        ) : view === 'chrono' ? (
          <div className="journal-chrono">
            {records.map((r, i) => (
              <RecordLine key={i} kind={r.kind} text={r.text} />
            ))}
          </div>
        ) : (
          <div className="journal-grouped">
            {notebook.incidents.map((inc) => (
              <IncidentCard key={inc.id} inc={inc} tracked={trackedId === inc.questId} onTrack={props.onTrack} />
            ))}
            {notebook.general.length > 0 && (
              <div className="incident general" data-incident="general">
                <details open>
                  <summary>
                    <b>이야기·지역 기록</b> <span className="dim">({notebook.general.length})</span>
                  </summary>
                  {notebook.general.map((r) => (
                    <RecordLine key={r.order} kind={r.kind} text={r.text} />
                  ))}
                </details>
              </div>
            )}
          </div>
        )}
      </div>

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
                const progress = state.quests[q.id] ?? null;
                const region = getRegionById(q.regionId);
                const done = !!progress && isQuestFinished(q.id, progress.stage);
                return (
                  <div key={q.id} className="quest-entry">
                    <div className="content-row">
                      <b>{q.name}</b>
                      <span className={`chip ${done ? 'ok' : ''}`}>
                        {done ? '완료' : progress ? '진행 중' : '미시작'}
                      </span>
                    </div>
                    {region && <p className="dim">📍 {region.name}</p>}
                    {progress && (
                      <div className="stage-list">
                        {q.stages.map((s) => {
                          const isPast = progress.completed.includes(s.id) || (done && s.id === progress.stage);
                          const isCurrent = !done && s.id === progress.stage;
                          return (
                            <div
                              key={s.id}
                              className={`stage-line ${isPast && !isCurrent ? 'past' : ''} ${isCurrent ? 'current' : ''}`}
                            >
                              {isCurrent ? '◉' : isPast ? '✓' : '○'} <b>{s.title}</b>
                              {(isCurrent || (done && s.id === progress.stage)) && (
                                <span className="dim"> — {s.objective}</span>
                              )}
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
