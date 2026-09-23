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

const ALL_ACTIONS: InfoActionId[] = ['ask_boxes', 'ask_motive', 'observe', 'inspect'];

export function EncounterView(props: { enc: EncounterState; dispatch: Dispatch<GameAction> }) {
  const { enc, dispatch } = props;
  const scenario = getScenario(enc);
  const [confirmBox, setConfirmBox] = useState<BoxIndex | null>(null);

  if (enc.phase === 'intro') {
    return (
      <div className="overlay">
        <div className="encounter">
          <div className="speaker">👺 그리즐의 상자 대결</div>
          <p>
            그리즐이 좌판 위 세 개의 상자를 손바닥으로 탕탕 두드린다.
            <br />
            <b>"규칙은 간단해. 상자 하나를 골라. 맞히면 안의 물건은 네 거야."</b>
          </p>
          <p className="statement">
            그리즐이 씩 웃으며 말한다 — <b>“{scenario.statement.text}”</b>
          </p>
          {enc.bonusClue && <p className="clue bonus">💡 {enc.bonusClue}</p>}
          <div className="choices">
            <button onClick={() => dispatch({ type: 'ENCOUNTER_INTRO_DONE' })}>상자를 살펴본다</button>
            <button onClick={() => dispatch({ type: 'ENCOUNTER_LEAVE' })}>대결에서 물러난다</button>
          </div>
        </div>
      </div>
    );
  }

  if (enc.phase === 'left') {
    return (
      <div className="overlay">
        <div className="encounter">
          <p>"쳇, 배짱도 없긴." 그리즐이 상자를 도로 좌판 밑으로 밀어 넣는다. 대결은 언제든 다시 청할 수 있다.</p>
          <div className="choices">
            <button onClick={() => dispatch({ type: 'ENCOUNTER_CLOSE' })}>자리를 뜬다</button>
          </div>
        </div>
      </div>
    );
  }

  if (enc.phase === 'resolved' && enc.chosenBox !== null && enc.result !== null) {
    return (
      <div className="overlay">
        <div className="encounter">
          <div className="speaker">{enc.result === 'win' ? '🎉 승리!' : '💀 빗나갔다...'}</div>
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
            <p>"크크큭! 다음 손님~!" 그리즐이 신나게 상자를 정리한다. 재도전하거나, 시장 사람들에게 조언을 구해 보자.</p>
          )}
          <div className="choices">
            <button onClick={() => dispatch({ type: 'ENCOUNTER_CLOSE' })}>대결을 마친다</button>
          </div>
        </div>
      </div>
    );
  }

  // phase === 'info'
  const remain = remainingActions(enc);
  return (
    <div className="overlay">
      <div className="encounter">
        <div className="speaker">👺 그리즐의 상자 대결</div>
        <p className="statement">그리즐: <b>“{scenario.statement.text}”</b></p>
        {enc.bonusClue && <p className="clue bonus">💡 {enc.bonusClue}</p>}
        <div className="boxes">
          {BOX_LABELS.map((label, i) => (
            <button
              key={i}
              className={`box ${confirmBox === i ? 'selected' : ''}`}
              onClick={() => setConfirmBox(i as BoxIndex)}
            >
              📦
              <span>{label}</span>
            </button>
          ))}
        </div>
        {confirmBox !== null && (
          <div className="confirm-row">
            <span>
              {BOX_LABELS[confirmBox]}를 연다.{' '}
              {enc.usedActions.length === 0 ? '아직 아무 단서도 없다. 순전히 운에 맡길 것인가?' : '확신이 서는가?'}
            </span>
            <button className="danger" onClick={() => dispatch({ type: 'ENCOUNTER_CHOOSE', box: confirmBox })}>
              연다!
            </button>
            <button onClick={() => setConfirmBox(null)}>다시 생각한다</button>
          </div>
        )}
        <div className="clues">
          {enc.usedActions.map((a) => (
            <p key={a} className="clue">
              <b>{INFO_ACTION_LABELS[a]}</b> — {scenario.clues[a].text}
            </p>
          ))}
        </div>
        <div className="info-actions">
          <div className="dim">정보 수집 기회: {remain}회 남음</div>
          {ALL_ACTIONS.map((a) => (
            <button
              key={a}
              disabled={enc.usedActions.includes(a) || remain <= 0}
              onClick={() => dispatch({ type: 'ENCOUNTER_INFO', action: a })}
            >
              {INFO_ACTION_LABELS[a]}
            </button>
          ))}
          <button className="leave" onClick={() => dispatch({ type: 'ENCOUNTER_LEAVE' })}>
            대결에서 물러난다
          </button>
        </div>
      </div>
    </div>
  );
}
