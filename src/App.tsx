import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { GameAction, GameState, MapEntity } from './game/types';
import { reducer } from './game/state';
import { saveGame } from './game/save';
import { LOCATIONS } from './game/content/world';
import { getInteraction } from './game/content/dialogues';
import type { DialogueTree } from './game/content/dialogues';
import type { Facing } from './game/content/scenes';
import { SceneView } from './ui/SceneView';
import { DialogueScene } from './ui/DialogueScene';
import { EncounterView } from './ui/EncounterView';
import { EventScene } from './ui/EventScene';
import { ExploreHUD } from './ui/ExploreHUD';
import { TouchControls } from './ui/TouchControls';
import { DevPanel } from './ui/DevPanel';
import { GlobalNav } from './ui/GlobalNav';
import type { ScreenId } from './ui/GlobalNav';
import { WorldMapScreen } from './ui/screens/WorldMapScreen';
import { JournalScreen } from './ui/screens/JournalScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { CareerScreen } from './ui/screens/CareerScreen';
import { NpcScreen } from './ui/screens/NpcScreen';
import { CollectionScreen } from './ui/screens/CollectionScreen';
import { SpecialScreen } from './ui/screens/SpecialScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { logEvent } from './game/log';
import { setUiMode } from './game/uidebug';

export function isDevMode(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('dev');
}

/** 로그인한 계정의 게임 세션. 타이틀(Root)에서 초기 상태를 받아 시작한다. */
export function App(props: { initialState: GameState; onExitToTitle: () => void }) {
  const [state, dispatch] = useReducer(reducer, props.initialState);
  const [dialogue, setDialogue] = useState<{
    entityId: string;
    nodeId: string;
    /** 대화 중 지나온 노드들 — 효과로 분기 조건이 바뀌어도 다음 노드를 잃지 않게 한다 */
    snapshot: DialogueTree;
  } | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [screen, setScreen] = useState<ScreenId>('explore');
  const [facing, setFacing] = useState<Facing>('down');
  const [moving, setMoving] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const moveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    logEvent('info', `게임 세션 시작: ${props.initialState.player.name} @ ${props.initialState.player.location}`);
  }, [props.initialState]);

  const move = useCallback((dx: number, dy: number) => {
    setFacing(dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right');
    dispatch({ type: 'MOVE', dx, dy });
    setMoving(true);
    setHasMoved(true);
    window.clearTimeout(moveTimer.current);
    moveTimer.current = window.setTimeout(() => setMoving(false), 220);
  }, []);

  // 자동 저장: 상태가 바뀔 때마다 + 화면 이탈 시
  useEffect(() => {
    saveGame(state);
  }, [state]);
  useEffect(() => {
    const onHide = () => saveGame(stateRef.current);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
  }, []);

  const location = LOCATIONS[state.player.location] ?? LOCATIONS.market;

  const adjacentEntity: MapEntity | null = useMemo(() => {
    return (
      location.entities.find(
        (e) => Math.abs(e.x - state.player.x) + Math.abs(e.y - state.player.y) === 1,
      ) ?? null
    );
  }, [location, state.player.x, state.player.y]);

  const encounterActive = state.activeEncounter !== null;
  const exploreActive =
    screen === 'explore' && !encounterActive && dialogue === null && eventId === null;

  // 현재 화면 모드 (개발자 툴 표시용)
  const uiMode =
    screen !== 'explore'
      ? `system:${screen}`
      : encounterActive
        ? 'encounter'
        : eventId
          ? 'event'
          : dialogue
            ? 'dialogue'
            : 'explore';
  useEffect(() => setUiMode(uiMode), [uiMode]);

  // MODE D: 새 모험 첫 장면 — 시장으로 가는 길 (1회)
  useEffect(() => {
    if (
      state.player.location === 'market_road' &&
      state.quests.q_prologue?.stage === 'road' &&
      state.flags.prologue_opening_seen !== true
    ) {
      setEventId('prologue_opening');
      dispatch({ type: 'SET_FLAG', key: 'prologue_opening_seen', value: true });
    }
  }, [state.player.location, state.quests.q_prologue, state.flags.prologue_opening_seen]);

  // MODE D: 항구 첫 도착 연출 (도착 플래그 → 1회 이벤트)
  useEffect(() => {
    if (state.flags.port_arrived === true && state.flags.port_arrival_seen !== true) {
      setEventId('port_arrival');
      dispatch({ type: 'SET_FLAG', key: 'port_arrival_seen', value: true });
    }
  }, [state.flags.port_arrived, state.flags.port_arrival_seen]);

  const interact = useCallback(() => {
    const target = adjacentEntity;
    if (!target) return;
    if (stateRef.current.flags.tut_interacted !== true) {
      dispatch({ type: 'SET_FLAG', key: 'tut_interacted', value: true });
    }
    const tree = getInteraction(target.id, stateRef.current);
    setDialogue({ entityId: target.id, nodeId: tree.entry, snapshot: tree });
  }, [adjacentEntity]);

  // 키보드 조작 (탐험 모드)
  useEffect(() => {
    if (!exploreActive) return;
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        move(dir[0], dir[1]);
      } else if (e.key === 'e' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        interact();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exploreActive, interact, move]);

  const runEffects = (effects: GameAction[] | undefined) => {
    effects?.forEach((a) => dispatch(a));
  };

  // 프롤로그(시장으로 가는 길) 진행 중에는 월드맵 이동을 막아 도입부에 집중시킨다
  const inPrologue =
    state.player.location === 'market_road' &&
    state.quests.q_prologue !== undefined &&
    state.quests.q_prologue.stage !== 'done';

  // 주변 NPC의 호객·혼잣말 — 시장이 플레이어 없이도 살아 있다는 느낌
  const barks = useMemo(() => {
    const b: Record<string, string> = {};
    if (state.player.location === 'market_road' && state.flags.gate_merchant_met !== true && !state.npcs.gate_merchant) {
      b.gate_merchant = '냄비 사세요, 냄비~ 안에서 사면 두 배!';
    }
    if (state.player.location === 'market' && !state.npcs.goblin) {
      b.goblin = '골라 골라~ 상자 셋에 보물 하나! 공짜 게임이라니까!';
    }
    if (state.player.location === 'market' && !state.npcs.mira) {
      b.mira = '말린 약초 있어요~ 속 쓰린 패배자용도!';
    }
    return b;
  }, [state.player.location, state.flags.gate_merchant_met, state.npcs]);

  // 행동에 맞춘 최소 조작 안내 (프롤로그 한정)
  let tutorialHint: string | null = null;
  if (exploreActive && inPrologue) {
    if (!hasMoved) tutorialHint = '왼쪽 아래 방향 패드(또는 방향키)로 길을 걸어 보자';
    else if (adjacentEntity && state.flags.tut_interacted !== true)
      tutorialHint = '오른쪽 아래 💬 버튼(또는 E)으로 살펴볼 수 있다';
  }

  return (
    <div className="game-root">
      {screen === 'explore' && (
        <div className="explore-viewport">
          <SceneView
            location={location}
            player={state.player}
            facing={facing}
            moving={moving}
            highlightId={adjacentEntity?.id ?? null}
            flags={state.flags}
            barks={barks}
          />
          <ExploreHUD state={state} onNavigate={setScreen} hideMap={inPrologue} />
          {tutorialHint && <div className="tutorial-hint">{tutorialHint}</div>}
          {exploreActive && (
            <TouchControls
              onMove={move}
              onInteract={interact}
              interactLabel={adjacentEntity ? `${adjacentEntity.name}` : null}
            />
          )}
        </div>
      )}

      {screen !== 'explore' && (
        <div className="screen-page">
          {screen === 'worldmap' && (
            <WorldMapScreen state={state} dispatch={dispatch} onExplore={() => setScreen('explore')} />
          )}
          {screen === 'journal' && <JournalScreen state={state} />}
          {screen === 'profile' && <ProfileScreen state={state} />}
          {screen === 'career' && <CareerScreen state={state} />}
          {screen === 'npcs' && <NpcScreen state={state} />}
          {screen === 'collection' && <CollectionScreen state={state} />}
          {screen === 'special' && <SpecialScreen />}
          {screen === 'settings' && (
            <SettingsScreen
              state={state}
              onExitToTitle={() => {
                saveGame(stateRef.current);
                props.onExitToTitle();
              }}
            />
          )}
        </div>
      )}

      {!inPrologue && <GlobalNav screen={screen} onNavigate={setScreen} />}
      {inPrologue && screen !== 'explore' && (
        <button className="gold back-to-explore" onClick={() => setScreen('explore')}>
          ← 길로 돌아가기
        </button>
      )}

      {/* MODE B — 대화 장면 */}
      {screen === 'explore' && dialogue && !encounterActive && eventId === null && (
        <DialogueScene
          state={state}
          entityId={dialogue.entityId}
          nodeId={dialogue.nodeId}
          snapshot={dialogue.snapshot}
          onClose={() => setDialogue(null)}
          onChoice={(choice) => {
            // 효과 적용 전 트리를 스냅샷에 누적 (다음 노드가 조건 변화로 사라지지 않게)
            const before = getInteraction(dialogue.entityId, stateRef.current);
            const snapshot: DialogueTree = {
              entry: before.entry,
              nodes: { ...dialogue.snapshot.nodes, ...before.nodes },
            };
            runEffects(choice.effects);
            if (choice.startEncounter) {
              setDialogue(null);
              dispatch({ type: 'ENCOUNTER_START', npcId: dialogue.entityId });
            } else if (choice.event) {
              setDialogue(null);
              setEventId(choice.event);
            } else if (choice.next) {
              setDialogue({ entityId: dialogue.entityId, nodeId: choice.next, snapshot });
            } else {
              setDialogue(null);
            }
          }}
        />
      )}

      {/* MODE C — 심리전 장면 */}
      {screen === 'explore' && encounterActive && state.activeEncounter && (
        <EncounterView enc={state.activeEncounter} dispatch={dispatch} />
      )}

      {/* MODE D — 이벤트 장면 */}
      {eventId && (
        <EventScene eventId={eventId} playerName={state.player.name} onClose={() => setEventId(null)} />
      )}

      {isDevMode() && (
        <button className="dev-toggle" onClick={() => setDevOpen((v) => !v)}>
          DEV
        </button>
      )}
      {isDevMode() && devOpen && (
        <DevPanel state={state} dispatch={dispatch} onClose={() => setDevOpen(false)} />
      )}
    </div>
  );
}
