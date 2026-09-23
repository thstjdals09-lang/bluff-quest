import { useEffect, useState } from 'react';
import type { Dispatch } from 'react';
import type { EncounterState, GameAction, GameState } from '../game/types';
import { GOBLIN_SCENARIOS } from '../game/content/scenarios';
import { QUESTS, ITEMS } from '../game/content/world';
import { getScenario, INFO_ACTION_LABELS } from '../game/encounter';
import { clearSave, exportSave, getSaveMeta, importSave, loadGame, saveGame } from '../game/save';
import { getLog, subscribeLog } from '../game/log';
import { getDevView, setDevView, subscribeDevView } from '../game/devview';
import { getUiDebug, subscribeUiDebug } from '../game/uidebug';
import { SCENES, projectToScreen } from '../game/content/scenes';
import { LOCATIONS } from '../game/content/world';
import { REGIONS, getRegionAccess } from '../game/content/regions';
import { validateLocationGraph } from '../game/content/navigation';

type Tab = 'state' | 'control' | 'encounter' | 'save' | 'log';

export function DevPanel(props: {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  onClose: () => void;
}) {
  const { state, dispatch } = props;
  const [tab, setTab] = useState<Tab>('state');

  return (
    <div className="dev-panel">
      <div className="dev-head">
        <b>🛠 개발자 툴</b>
        <button onClick={props.onClose}>닫기 ✕</button>
      </div>
      <div className="dev-tabs">
        {(
          [
            ['state', 'A 상태'],
            ['control', 'B 제어'],
            ['encounter', 'C 대결'],
            ['save', 'D 세이브'],
            ['log', 'E 로그'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="dev-body">
        {tab === 'state' && <StateTab state={state} />}
        {tab === 'control' && <ControlTab state={state} dispatch={dispatch} />}
        {tab === 'encounter' && <EncounterTab state={state} dispatch={dispatch} />}
        {tab === 'save' && <SaveTab state={state} dispatch={dispatch} />}
        {tab === 'log' && <LogTab />}
      </div>
    </div>
  );
}

function StateTab({ state }: { state: GameState }) {
  const [, forceUi] = useState(0);
  useEffect(() => subscribeUiDebug(() => forceUi((n) => n + 1)), []);
  const ui = getUiDebug();
  const loc = LOCATIONS[state.player.location];
  const scene = SCENES[state.player.location];
  const pt = loc && scene
    ? projectToScreen(scene.projection, loc.layout[0].length, loc.layout.length, state.player.x, state.player.y)
    : null;
  return (
    <div>
      <p>
        화면 모드: <b>{ui.mode}</b>
        {ui.camera && (
          <>
            {' '}· 카메라 zoom {ui.camera.zoom} · 월드 {Math.round(ui.camera.worldW)}×{Math.round(ui.camera.worldH)}px ·
            오프셋 ({Math.round(ui.camera.tx)}, {Math.round(ui.camera.ty)}) · 뷰포트 {ui.camera.frameW}×{ui.camera.frameH}
          </>
        )}
      </p>
      <p>
        위치: <b>{state.player.location}</b> 그리드 ({state.player.x}, {state.player.y}) · 골드 {state.player.gold}
      </p>
      {pt && (
        <p>
          렌더링: 월드 ({pt.x.toFixed(1)}%, {pt.y.toFixed(1)}%) · 스케일 {pt.scale.toFixed(2)} · z-index {pt.z}
        </p>
      )}
      <p>
        퀘스트:{' '}
        {Object.entries(state.quests).map(([id, p]) => `${id}=${p.stage}`).join(' · ') || '없음'}
      </p>
      <p>해금: {state.unlocked.join(', ') || '없음'} · 아이템: {state.inventory.join(', ') || '없음'}</p>
      <p>플래그: <code>{JSON.stringify(state.flags)}</code></p>
      <p>NPC: <code>{JSON.stringify(state.npcs)}</code></p>
      <p>
        장소 방문 [{state.visitedLocations.join(', ')}] · 월드: 방문 [{state.visitedRegions.join(', ')}] · 발견 [{state.discovered.join(', ') || '없음'}] ·
        커리어 {state.career.duels}전 {state.career.wins}승 {state.career.losses}패 {state.career.walkaways}회피
      </p>
      <p>
        지역 해금:{' '}
        {REGIONS.map((r) => `${r.id}=${getRegionAccess(r.id, state).unlocked ? '해금' : '잠김'}`).join(' · ')}
      </p>
      <p>대결: <code>{state.activeEncounter ? `${state.activeEncounter.scenarioId} / ${state.activeEncounter.phase}` : '없음'}</code></p>
      <details>
        <summary>전체 상태 JSON</summary>
        <pre>{JSON.stringify(state, null, 2)}</pre>
      </details>
    </div>
  );
}

function ControlTab({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const [, forceDev] = useState(0);
  useEffect(() => subscribeDevView(() => forceDev((n) => n + 1)), []);
  const dv = getDevView();
  return (
    <div className="dev-controls">
      <div>
        <b>공간 디버그 오버레이</b>
        <label><input type="checkbox" checked={dv.grid} onChange={(e) => setDevView({ grid: e.target.checked })} /> 그리드·충돌 영역</label>
        <label><input type="checkbox" checked={dv.anchors} onChange={(e) => setDevView({ anchors: e.target.checked })} /> 앵커·렌더 순서(z)</label>
        <label><input type="checkbox" checked={dv.range} onChange={(e) => setDevView({ range: e.target.checked })} /> 상호작용 범위</label>
      </div>
      <div>
        <b>아이템</b>
        {Object.values(ITEMS).map((item) => (
          <span key={item.id}>
            {state.inventory.includes(item.id) ? (
              <button onClick={() => dispatch({ type: 'REMOVE_ITEM', itemId: item.id })}>− {item.name}</button>
            ) : (
              <button onClick={() => dispatch({ type: 'ADD_ITEM', itemId: item.id })}>+ {item.name}</button>
            )}
          </span>
        ))}
      </div>
      {Object.values(QUESTS).map((q) => (
        <div key={q.id}>
          <b>퀘스트 — {q.name} ({state.quests[q.id]?.stage ?? '미시작'})</b>
          {q.stages.map((s) => (
            <button
              key={s.id}
              className={state.quests[q.id]?.stage === s.id ? 'active' : ''}
              onClick={() => dispatch({ type: 'SET_QUEST_STAGE', questId: q.id, stage: s.id })}
            >
              {s.id}
            </button>
          ))}
        </div>
      ))}
      <div>
        <b>스토리 플래그</b>
        {(
          [
            'chip_seen', 'chip_refused', 'chip_pressed', 'chip_asked_mira', 'ledger_clue',
            'mira_slip', 'mira_admitted', 'pier_rumor', 'fin_bluff_called', 'night_pier_hint', 'invitation_shown',
          ] as const
        ).map((key) => (
          <button
            key={key}
            className={state.flags[key] !== undefined && state.flags[key] !== false ? 'active' : ''}
            onClick={() =>
              dispatch({
                type: 'SET_FLAG',
                key,
                value: state.flags[key] === true ? false : true,
              })
            }
          >
            {key}
          </button>
        ))}
        <button
          onClick={() => {
            dispatch({ type: 'SET_FLAG', key: 'chip_done', value: false });
            dispatch({ type: 'SET_FLAG', key: 'chip_pressed', value: false });
            dispatch({ type: 'SET_FLAG', key: 'chip_asked_mira', value: false });
          }}
        >
          칩 사건 초기화
        </button>
      </div>
      <div>
        <b>장소</b>
        <button onClick={() => dispatch({ type: 'UNLOCK', id: 'warehouse' })}>창고 해금</button>
        {Object.values(LOCATIONS).map((l) => (
          <button
            key={l.id}
            className={state.player.location === l.id ? 'active' : ''}
            onClick={() => dispatch({ type: 'GOTO_LOCATION', locationId: l.id, x: l.playerStart.x, y: l.playerStart.y })}
          >
            {l.code ? `${l.code} ` : ''}{l.name}
          </button>
        ))}
      </div>
      <div>
        <b>장소 연결 검사</b>
        {(() => {
          const problems = validateLocationGraph();
          return problems.length === 0 ? (
            <span className="dim">정상 — 장소 {Object.keys(LOCATIONS).length}곳, 출입구 {Object.values(LOCATIONS).reduce((n, l) => n + l.exits.length, 0)}개</span>
          ) : (
            problems.map((p) => (
              <span key={p} className="log-error">⛔ {p}</span>
            ))
          );
        })()}
      </div>
      <div>
        <b>월드</b>
        <button
          onClick={() => {
            dispatch({ type: 'ADD_ITEM', itemId: 'invitation' });
            dispatch({ type: 'SET_FLAG', key: 'found_invitation', value: true });
            dispatch({ type: 'SET_QUEST_STAGE', questId: 'q_invitation', stage: 'done' });
          }}
        >
          항구 해금(초대장 지급)
        </button>
        <button onClick={() => dispatch({ type: 'SET_FLAG', key: 'found_invitation', value: false })}>
          항구 잠금
        </button>
      </div>
      <div>
        <b>NPC 상태</b>
        <button onClick={() => dispatch({ type: 'NPC_SET', npcId: 'goblin', patch: { fooledPlayer: false, caughtLying: false, meetCount: 0 } })}>
          고블린 관계 초기화
        </button>
        <button onClick={() => dispatch({ type: 'SET_FLAG', key: 'lost_to_goblin', value: false })}>패배 플래그 해제</button>
        <button onClick={() => dispatch({ type: 'SET_FLAG', key: 'mira_hint', value: true })}>미라 힌트 켜기</button>
      </div>
    </div>
  );
}

function EncounterTab({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const enc = state.activeEncounter;
  const startScenario = (scenarioId: string) => {
    const forced: EncounterState = {
      encounterId: 'goblin_boxes',
      scenarioId,
      seed: -1,
      phase: 'intro',
      usedActions: [],
      bonusClue: null,
      chosenBox: null,
      result: null,
    };
    dispatch({ type: 'LOAD_STATE', state: { ...state, activeEncounter: forced } });
  };
  return (
    <div>
      <div className="dev-controls">
        <div>
          <b>테스트 시나리오 강제 시작</b>
          {GOBLIN_SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => startScenario(s.id)}>
              {s.id}
            </button>
          ))}
          <button onClick={() => dispatch({ type: 'LOAD_STATE', state: { ...state, activeEncounter: null } })}>
            대결 강제 종료
          </button>
        </div>
      </div>
      {enc ? (
        <EncounterInternals enc={enc} />
      ) : (
        <p className="dim">진행 중인 대결이 없습니다. 위에서 시나리오를 강제 시작할 수 있습니다.</p>
      )}
    </div>
  );
}

function EncounterInternals({ enc }: { enc: EncounterState }) {
  const s = getScenario(enc);
  return (
    <div className="dev-encounter">
      <p>시나리오: <b>{s.id}</b> (seed {enc.seed}) · 페이즈 <b>{enc.phase}</b></p>
      <p>상자 내용: [{s.boxes.join(', ')}] · 선택: {enc.chosenBox ?? '없음'} · 결과: {enc.result ?? '미정'}</p>
      <p>NPC 지식: 위치를 {s.npcKnowsLocation ? '안다' : '모른다'} / 믿는 위치: {s.npcBelievedIndex}</p>
      <p>NPC 목적: <b>{s.npcGoal}</b> — {s.goalDesc}</p>
      <p>주장: "{s.statement.text}" → <b>{s.statement.isTrue ? '진실' : '거짓'}</b> ({s.statement.reason})</p>
      <p>공개된 단서: {enc.usedActions.length === 0 ? '없음' : ''}</p>
      <ul>
        {enc.usedActions.map((a) => (
          <li key={a}>
            <b>{INFO_ACTION_LABELS[a]}</b>: {s.clues[a].devNote}
          </li>
        ))}
      </ul>
      <details>
        <summary>모든 단서의 내부 의미 (스포일러)</summary>
        <ul>
          {(Object.keys(s.clues) as (keyof typeof s.clues)[]).map((k) => (
            <li key={k}>
              <b>{INFO_ACTION_LABELS[k]}</b>: {s.clues[k].devNote}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function SaveTab({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState('');
  const meta = getSaveMeta();
  return (
    <div className="dev-controls">
      <p>마지막 저장: <b>{meta ? new Date(meta.savedAt).toLocaleString() : '없음'}</b> (v{meta?.version ?? '-'})</p>
      <div>
        <button onClick={() => setMsg(saveGame(state) ? '강제 저장 완료' : '저장 실패')}>강제 저장</button>
        <button
          onClick={() => {
            const { state: loaded, loadedFromSave } = loadGame();
            dispatch({ type: 'LOAD_STATE', state: loaded });
            setMsg(loadedFromSave ? '세이브 불러오기 완료' : '유효한 세이브 없음 — 초기 상태 로드');
          }}
        >
          저장된 상태 불러오기
        </button>
        <button
          className="danger"
          onClick={() => {
            if (window.confirm('세이브 데이터를 완전히 삭제할까요?')) {
              clearSave();
              setMsg('세이브 삭제됨 (현재 플레이 상태는 유지, 새로고침 시 새 게임)');
            }
          }}
        >
          세이브 초기화
        </button>
      </div>
      <div>
        <button
          onClick={() => {
            const data = exportSave();
            if (data) {
              void navigator.clipboard?.writeText(data);
              setImportText(data);
              setMsg('세이브 JSON을 아래 칸과 클립보드로 내보냈습니다.');
            } else setMsg('내보낼 세이브가 없습니다.');
          }}
        >
          JSON 내보내기
        </button>
        <button
          onClick={() => {
            const parsed = importSave(importText);
            if (parsed) {
              dispatch({ type: 'LOAD_STATE', state: parsed });
              setMsg('JSON에서 상태를 불러왔습니다.');
            } else setMsg('가져오기 실패: 유효하지 않은 데이터');
          }}
        >
          JSON 가져오기
        </button>
      </div>
      <textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder="세이브 JSON"
        rows={5}
      />
      {msg && <p className="dim">{msg}</p>}
    </div>
  );
}

function LogTab() {
  const [, force] = useState(0);
  useEffect(() => subscribeLog(() => force((n) => n + 1)), []);
  const entries = getLog();
  return (
    <div className="dev-log">
      {entries.length === 0 && <p className="dim">기록된 이벤트가 없습니다.</p>}
      {[...entries].reverse().map((e, i) => (
        <p key={i} className={e.level === 'error' ? 'log-error' : ''}>
          [{e.time}] {e.level === 'error' ? '⛔' : 'ℹ️'} {e.message}
        </p>
      ))}
    </div>
  );
}
