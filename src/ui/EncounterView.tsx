import { useState } from 'react';
import type { Dispatch } from 'react';
import type { BoxIndex, GameAction, EncounterState, InfoActionId } from '../game/types';
import {
  BOX_CONTENT_LABELS,
  BOX_LABELS,
  INFO_ACTION_LABELS,
  getScenario,
  remainingActions,
} from '../game/encounter';
import encounterBackdrop from '../assets/encounter-grix.jpg';

/**
 * MODE C — 심리전 전용 장면 (Phase 4).
 * 그릭스(그리즐)와 상자 3개를 그린 전용 일러스트 위에
 * 기존 대결 엔진의 상태를 그대로 연결한다. 로직·판정은 encounter.ts 그대로다.
 */

const ACTION_META: { id: InfoActionId; icon: string; short: string }[] = [
  { id: 'observe', icon: '👁️', short: '관찰' },
  { id: 'ask_boxes', icon: '💬', short: '질문·상자' },
  { id: 'ask_motive', icon: '🗨️', short: '질문·속내' },
  { id: 'inspect', icon: '🔍', short: '조사' },
];

/** 일러스트 위 상자 히트 영역 위치 (% 좌표) */
const CHEST_POS: { x: number; y: number }[] = [
  { x: 17, y: 60 },
  { x: 50, y: 61 },
  { x: 83, y: 60 },
];

export function EncounterView(props: { enc: EncounterState; dispatch: Dispatch<GameAction> }) {
  const { enc, dispatch } = props;
  const scenario = getScenario(enc);
  const [confirmBox, setConfirmBox] = useState<BoxIndex | null>(null);
  const [cluesOpen, setCluesOpen] = useState(false);

  const backdrop = (
    <>
      <img className="enc-bg" src={encounterBackdrop} alt="" draggable={false} />
      <div className="enc-vignette" />
    </>
  );

  if (enc.phase === 'intro') {
    return (
      <div className="encounter-scene">
        {backdrop}
        <div className="enc-bubble">“{scenario.statement.text}”</div>
        <div className="enc-panel">
          <div className="enc-title">👺 그리즐의 상자 대결</div>
          <p>
            그리즐이 세 개의 상자를 손바닥으로 탕탕 두드린다.
            <br />
            <b>"규칙은 간단해. 상자 하나를 골라. 맞히면 안의 물건은 네 거야."</b>
          </p>
          {enc.bonusClue && <p className="enc-clue bonus">💡 {enc.bonusClue}</p>}
          <div className="enc-panel-buttons">
            <button className="gold" onClick={() => dispatch({ type: 'ENCOUNTER_INTRO_DONE' })}>
              상자를 살펴본다
            </button>
            <button onClick={() => dispatch({ type: 'ENCOUNTER_LEAVE' })}>대결에서 물러난다</button>
          </div>
        </div>
      </div>
    );
  }

  if (enc.phase === 'left') {
    return (
      <div className="encounter-scene">
        {backdrop}
        <div className="enc-panel">
          <p>"쳇, 배짱도 없긴." 그리즐이 상자를 도로 좌판 밑으로 밀어 넣는다. 대결은 언제든 다시 청할 수 있다.</p>
          <div className="enc-panel-buttons">
            <button className="gold" onClick={() => dispatch({ type: 'ENCOUNTER_CLOSE' })}>자리를 뜬다</button>
          </div>
        </div>
      </div>
    );
  }

  if (enc.phase === 'resolved' && enc.chosenBox !== null && enc.result !== null) {
    return (
      <div className="encounter-scene">
        {backdrop}
        <div className="enc-panel enc-result">
          <div className="enc-title">{enc.result === 'win' ? '🎉 승리!' : '💀 빗나갔다...'}</div>
          <p>
            {BOX_LABELS[enc.chosenBox]}를 열었다 — <b>{BOX_CONTENT_LABELS[scenario.boxes[enc.chosenBox]]}</b>
          </p>
          <div className="reveal-boxes">
            {scenario.boxes.map((b, i) => (
              <div key={i} className={`reveal-box ${i === enc.chosenBox ? 'chosen' : ''}`}>
                <div>{BOX_LABELS[i]}</div>
                <div>{BOX_CONTENT_LABELS[b]}</div>
              </div>
            ))}
          </div>
          <div className="reveal-explain">
            <b>대결 복기</b>
            <p>{scenario.reveal}</p>
            <p className="dim">
              그리즐의 주장 "{scenario.statement.text}" — {scenario.statement.isTrue ? '진실이었다' : '거짓이었다'}.{' '}
              {scenario.statement.reason}
            </p>
            {enc.usedActions.length > 0 ? (
              <p className="dim">내가 수집한 단서: {enc.usedActions.map((a) => INFO_ACTION_LABELS[a]).join(', ')}</p>
            ) : (
              <p className="dim">단서 없이 선택했다 — 근거 없는 선택은 순전히 운에 맡기는 것이다.</p>
            )}
          </div>
          {enc.result === 'win' ? (
            <p>상자 안에서 <b>낡은 열쇠 🗝️</b>와 금화 5닢을 얻었다! 이 열쇠에 맞는 자물쇠가 시장 어딘가에 있을 것이다.</p>
          ) : (
            <p>"크크큭! 다음 손님~!" 재도전하거나, 시장 사람들에게 조언을 구해 보자.</p>
          )}
          <div className="enc-panel-buttons">
            <button className="gold" onClick={() => dispatch({ type: 'ENCOUNTER_CLOSE' })}>대결을 마친다</button>
          </div>
        </div>
      </div>
    );
  }

  // phase === 'info'
  const remain = remainingActions(enc);
  const lastAction = enc.usedActions[enc.usedActions.length - 1];

  return (
    <div className="encounter-scene">
      {backdrop}
      <div className="enc-bubble">“{scenario.statement.text}”</div>

      {/* 상자 히트 영역 (일러스트 위) */}
      {CHEST_POS.map((pos, i) => (
        <button
          key={i}
          className={`chest-hotspot ${confirmBox === i ? 'selected' : ''}`}
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          onClick={() => setConfirmBox(i as BoxIndex)}
        >
          <span className="chest-label">{BOX_LABELS[i]}</span>
        </button>
      ))}

      {/* 단서 로그 */}
      {enc.usedActions.length > 0 && (
        <div className={`enc-clues ${cluesOpen ? 'open' : ''}`} onClick={() => setCluesOpen((v) => !v)}>
          <div className="enc-clues-head">
            🔎 단서 {enc.usedActions.length}개 {cluesOpen ? '▾' : '▸'}
          </div>
          {(cluesOpen ? enc.usedActions : lastAction ? [lastAction] : []).map((a) => (
            <p key={a} className="enc-clue">
              <b>{INFO_ACTION_LABELS[a]}</b> — {scenario.clues[a].text}
            </p>
          ))}
        </div>
      )}
      {enc.bonusClue && enc.usedActions.length === 0 && <div className="enc-clues"><p className="enc-clue bonus">💡 {enc.bonusClue}</p></div>}

      {/* 선택 확인 바 */}
      {confirmBox !== null && (
        <div className="enc-confirm">
          <span>
            <b>{BOX_LABELS[confirmBox]}</b>를 연다.{' '}
            {enc.usedActions.length === 0 ? '아직 단서가 없다. 운에 맡길 것인가?' : '확신이 서는가?'}
          </span>
          <div className="enc-confirm-buttons">
            <button className="gold" onClick={() => dispatch({ type: 'ENCOUNTER_CHOOSE', box: confirmBox })}>
              연다!
            </button>
            <button onClick={() => setConfirmBox(null)}>다시 생각한다</button>
          </div>
        </div>
      )}

      {/* 행동 바 */}
      <div className="enc-actions">
        <div className="enc-remain">정보 수집 {remain}회 남음 · 상자를 눌러 선택</div>
        <div className="enc-action-row">
          {ACTION_META.map((a) => (
            <button
              key={a.id}
              className="enc-action"
              disabled={enc.usedActions.includes(a.id) || remain <= 0}
              onClick={() => dispatch({ type: 'ENCOUNTER_INFO', action: a.id })}
            >
              <span className="enc-action-icon">{a.icon}</span>
              <span>{a.short}</span>
            </button>
          ))}
          <button className="enc-action leave" onClick={() => dispatch({ type: 'ENCOUNTER_LEAVE' })}>
            <span className="enc-action-icon">🏃</span>
            <span>떠나기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
