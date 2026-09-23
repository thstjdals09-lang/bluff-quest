import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { GameAction, MapEntity } from './game/types';
import { reducer } from './game/state';
import { loadGame, saveGame } from './game/save';
import { LOCATIONS } from './game/content/world';
import { getInteraction } from './game/content/dialogues';
import type { Facing } from './game/content/scenes';
import { SceneView } from './ui/SceneView';
import { DialogueView } from './ui/DialogueView';
import { EncounterView } from './ui/EncounterView';
import { HUD } from './ui/HUD';
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

export function isDevMode(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('dev');
}

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const { state, loadedFromSave } = loadGame();
    logEvent('info', loadedFromSave ? '세이브 데이터에서 게임을 복원했습니다.' : '새 게임을 시작합니다.');
    return state;
  });
  const [dialogue, setDialogue] = useState<{ entityId: string; nodeId: string } | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [screen, setScreen] = useState<ScreenId>('explore');
  const [facing, setFacing] = useState<Facing>('down');
  const [moving, setMoving] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const moveTimer = useRef<number | undefined>(undefined);

  const move = useCallback((dx: number, dy: number) => {
    setFacing(dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right');
    dispatch({ type: 'MOVE', dx, dy });
    setMoving(true);
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
  const exploreActive = screen === 'explore' && !encounterActive && dialogue === null;

  const interact = useCallback(() => {
    const target = adjacentEntity;
    if (!target) return;
    setDialogue({ entityId: target.id, nodeId: getInteraction(target.id, stateRef.current).entry });
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

  return (
    <div className="app">
      {screen === 'explore' && <HUD state={state} dispatch={dispatch} />}
      {screen === 'explore' && (
        <>
          <div className="stage">
            <SceneView
              location={location}
              player={state.player}
              facing={facing}
              moving={moving}
              highlightId={adjacentEntity?.id ?? null}
            />
            {dialogue && !encounterActive && (
              <DialogueView
                state={state}
                entityId={dialogue.entityId}
                nodeId={dialogue.nodeId}
                onChoice={(choice) => {
                  runEffects(choice.effects);
                  if (choice.startEncounter) {
                    setDialogue(null);
                    dispatch({ type: 'ENCOUNTER_START', npcId: dialogue.entityId });
                  } else if (choice.next) {
                    setDialogue({ entityId: dialogue.entityId, nodeId: choice.next });
                  } else {
                    setDialogue(null);
                  }
                }}
              />
            )}
            {encounterActive && state.activeEncounter && (
              <EncounterView enc={state.activeEncounter} dispatch={dispatch} />
            )}
          </div>
          {exploreActive && (
            <Controls
              onMove={move}
              onInteract={interact}
              interactLabel={adjacentEntity ? `${adjacentEntity.icon} ${adjacentEntity.name}` : null}
            />
          )}
        </>
      )}
      {screen === 'worldmap' && (
        <WorldMapScreen state={state} dispatch={dispatch} onExplore={() => setScreen('explore')} />
      )}
      {screen === 'journal' && <JournalScreen state={state} />}
      {screen === 'profile' && <ProfileScreen state={state} />}
      {screen === 'career' && <CareerScreen state={state} />}
      {screen === 'npcs' && <NpcScreen state={state} />}
      {screen === 'collection' && <CollectionScreen state={state} />}
      {screen === 'special' && <SpecialScreen />}
      {screen === 'settings' && <SettingsScreen state={state} dispatch={dispatch} />}
      <GlobalNav screen={screen} onNavigate={setScreen} />
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

function Controls(props: {
  onMove: (dx: number, dy: number) => void;
  onInteract: () => void;
  interactLabel: string | null;
}) {
  return (
    <div className="controls">
      <div className="dpad">
        <button className="dpad-up" onClick={() => props.onMove(0, -1)}>▲</button>
        <button className="dpad-left" onClick={() => props.onMove(-1, 0)}>◀</button>
        <button className="dpad-right" onClick={() => props.onMove(1, 0)}>▶</button>
        <button className="dpad-down" onClick={() => props.onMove(0, 1)}>▼</button>
      </div>
      <button
        className={`interact ${props.interactLabel ? 'active' : ''}`}
        disabled={!props.interactLabel}
        onClick={props.onInteract}
      >
        {props.interactLabel ? `상호작용 — ${props.interactLabel}` : '가까이 가면 상호작용할 수 있다'}
      </button>
    </div>
  );
}
