import type { GameState } from '../../game/types';
import { NPCS, getNpcRelation } from '../../game/content/npcs';
import { CHAMPIONS, getRegionById } from '../../game/content/regions';
import { QUESTS } from '../../game/content/world';

/** NPC 관계 — 만난 NPC는 실제 런타임 상태에서 관계를 파생, 못 만난 NPC는 미발견 처리. */
export function NpcScreen(props: { state: GameState }) {
  const { state } = props;

  return (
    <div className="screen">
      <h2 className="screen-title">👥 인물과 관계</h2>
      <p className="screen-sub">세계에서 만난 사람들. 관계는 다른 지역의 사건에도 영향을 준다.</p>

      {NPCS.map((def) => {
        const view = getNpcRelation(def, state);
        const region = getRegionById(def.regionId);
        if (!view.met) {
          return (
            <div key={def.id} className="card npc-card undiscovered">
              <div className="npc-portrait">❓</div>
              <div>
                <b>???</b>
                <p className="dim">📍 {region?.name} · 아직 만나지 못했다.</p>
              </div>
            </div>
          );
        }
        return (
          <div key={def.id} className="card npc-card">
            {def.portrait ? (
              <img className="npc-portrait" src={def.portrait} alt={def.name} />
            ) : (
              <div className="npc-portrait">👤</div>
            )}
            <div>
              <b>{def.name}</b> <span className="dim">— {def.role}</span>
              <p className="dim">📍 {region?.name} · 만남 {view.meetCount}회{def.reappears ? ' · 재등장 가능' : ''}</p>
              <p className="relation-line">🤝 {view.relation}</p>
              <p className="dim">{def.desc}</p>
              {view.records.map((r, i) => (
                <p key={i} className="dim">· {r}</p>
              ))}
              {def.questIds.map((qid) => (
                <p key={qid} className="dim">🧭 관련 퀘스트: {QUESTS[qid]?.name}</p>
              ))}
            </div>
          </div>
        );
      })}

      <div className="card">
        <b>👑 소문 속의 인물들</b>
        <p className="dim">각 지역의 챔피언. 언젠가 마주하게 될 상대들이다. (명칭은 임시)</p>
        {Object.values(CHAMPIONS).map((ch) => {
          const region = getRegionById(ch.regionId);
          return (
            <div key={ch.id} className="content-row">
              <div>
                <b>👤 {ch.tentativeName}</b>
                <p className="dim">📍 {region?.name}</p>
              </div>
              <span className="chip">미조우</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
