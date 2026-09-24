import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { GameAction, GameState, ItemDef, MapEntity } from './game/types';
import { reducer } from './game/state';
import { saveGame } from './game/save';
import { LOCATIONS, getActiveTrackable, getTrackedQuest } from './game/content/world';
import { canPassExitDirectly, getInteraction } from './game/content/dialogues';
import { exitDestinationLabel, getExit, locationLabel } from './game/content/navigation';
import type { DialogueTree } from './game/content/dialogues';
import type { Facing } from './game/content/scenes';
import { SceneView } from './ui/SceneView';
import { DialogueScene } from './ui/DialogueScene';
import { EncounterView } from './ui/EncounterView';
import { EventScene } from './ui/EventScene';
import { ExploreHUD } from './ui/ExploreHUD';
import { BagPanel } from './ui/BagPanel';
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

/** 개발자 모드 화면 검수용: ?dev&bagfixture=N — 가방에 표시만 되는 긴 이름·설명 아이템 N개 (세이브에 들어가지 않음) */
function devBagFixture(): ItemDef[] {
  if (!isDevMode()) return [];
  const n = Math.min(40, Number(new URLSearchParams(window.location.search).get('bagfixture')) || 0);
  const icons = ['🧤', '🪙', '📜', '🎲', '🕯️', '🧿'];
  return Array.from({ length: n }, (_, i) => ({
    id: `fixture_${i + 1}`,
    name: i % 3 === 0 ? `이름이 아주 길게 붙은 검은 비단 장갑 한 켤레 제${i + 1}호` : `검수용 물건 ${i + 1}`,
    icon: icons[i % icons.length],
    desc: '화면 검수용 표시 전용 물건. '.repeat(i % 3 === 0 ? 9 : 2).trim(),
  }));
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
  // 가방(GameSheet) — 열린 동안 탐험 입력을 멈춘다. UI 상태일 뿐 세이브에 쓰지 않는다
  const [bagOpen, setBagOpen] = useState(false);
  const [bagPulse, setBagPulse] = useState(0);
  const bagFixture = useMemo(devBagFixture, []);
  const closeBag = useCallback(() => {
    setBagOpen(false);
    setBagPulse((n) => n + 1);
  }, []);
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

  // 인접한 대상이 여럿이면 바라보는 방향의 대상을 우선한다
  const adjacentEntity: MapEntity | null = useMemo(() => {
    const [fx, fy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[facing];
    const faced = location.entities.find(
      (e) => e.x === state.player.x + fx && e.y === state.player.y + fy,
    );
    return (
      faced ??
      location.entities.find(
        (e) => Math.abs(e.x - state.player.x) + Math.abs(e.y - state.player.y) === 1,
      ) ??
      null
    );
  }, [location, state.player.x, state.player.y, facing]);

  const encounterActive = state.activeEncounter !== null;
  const exploreActive =
    screen === 'explore' && !encounterActive && dialogue === null && eventId === null && !bagOpen;

  // 현재 화면 모드 (개발자 툴 표시용)
  const uiMode =
    screen !== 'explore'
      ? `system:${screen}`
      : bagOpen
        ? 'menu:bag'
        : encounterActive
        ? 'encounter'
        : eventId
          ? 'event'
          : dialogue
            ? 'dialogue'
            : 'explore';
  useEffect(() => setUiMode(uiMode), [uiMode]);

  // 장소 전환: 페이드 + 첫 방문 안내 배너 (이름·방향·눈에 띄는 대상)
  const prevVisited = useRef(state.visitedLocations);
  const [arrivalBanner, setArrivalBanner] = useState<string | null>(null);
  const [fadeKey, setFadeKey] = useState(0);
  useEffect(() => {
    const loc = state.player.location;
    if (!prevVisited.current.includes(loc)) setArrivalBanner(loc);
    prevVisited.current = state.visitedLocations;
    setFadeKey((k) => k + 1);
  }, [state.player.location]); // eslint-disable-line react-hooks/exhaustive-deps
  // 장소 전환 페이드(0.45s) 동안에는 메뉴를 열지 않는다 — 렌더 시점에 바로 판단(효과를 기다리지 않음)
  const [settledLocation, setSettledLocation] = useState(state.player.location);
  const transitioning = settledLocation !== state.player.location;
  useEffect(() => {
    if (!transitioning) return;
    const t = window.setTimeout(() => setSettledLocation(state.player.location), 450);
    return () => window.clearTimeout(t);
  }, [transitioning, state.player.location]);
  const bannerVisible = arrivalBanner !== null && arrivalBanner === state.player.location;
  useEffect(() => {
    if (!bannerVisible || dialogue || eventId || state.activeEncounter) return;
    const t = window.setTimeout(() => setArrivalBanner(null), 4200);
    return () => window.clearTimeout(t);
  }, [bannerVisible, dialogue, eventId, state.activeEncounter]);

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
    // 열린 출입구: 목적지는 이미 버튼에 표시되어 있으므로 바로 이동
    if (canPassExitDirectly(target.id, stateRef.current)) {
      dispatch({ type: 'USE_EXIT', entityId: target.id });
      return;
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

  // 추적할 사건 선택 — UI 상태일 뿐 세이브·퀘스트·이벤트에 쓰지 않는다 (새로고침하면 기본 우선순위로)
  const [trackPref, setTrackPref] = useState<string | null>(null);
  const cycleTrack = () => {
    const active = getActiveTrackable(state);
    if (active.length < 2) return;
    const cur = getTrackedQuest(state, trackPref)?.quest.id;
    setTrackPref(active[(active.indexOf(cur ?? '') + 1) % active.length]);
  };

  // 주변 NPC의 호객·혼잣말 — 시장이 플레이어 없이도 살아 있다는 느낌
  const barks = useMemo(() => {
    const b: Record<string, string> = {};
    if (state.player.location === 'market_road' && state.flags.gate_merchant_met !== true && !state.npcs.gate_merchant) {
      b.gate_merchant = '냄비 사세요, 냄비~ 안에서 사면 두 배!';
    }
    if (state.player.location === 'market' && !state.npcs.goblin) {
      b.goblin = '골라 골라~ 상자 셋에 보물 하나! 공짜 게임이라니까!';
    }
    if (state.player.location === 'market' && state.flags.prologue_card === true && state.flags.mira_card_bark_seen !== true) {
      // 카드 미스터리의 맥을 입구 장터에서 한 번만 되살린다 (시장을 떠나면 mira_card_bark_seen)
      b.mira = '그 카드, 여기선 넣어 두는 게 좋아.';
    } else if (state.player.location === 'market' && !state.npcs.mira) {
      b.mira = '말린 약초 있어요~ 속 쓰린 패배자용도!';
    }
    return b;
  }, [state.player.location, state.flags.gate_merchant_met, state.flags.prologue_card, state.flags.mira_card_bark_seen, state.npcs]);

  // 행동에 맞춘 최소 조작 안내 (프롤로그 한정)
  let tutorialHint: string | null = null;
  if (exploreActive && inPrologue) {
    if (!hasMoved) tutorialHint = '왼쪽 아래 방향 패드(또는 방향키)로 길을 걸어 보자';
    else if (adjacentEntity && state.flags.tut_interacted !== true)
      tutorialHint = '오른쪽 아래 💬 버튼(또는 E)으로 살펴볼 수 있다';
  }

  // 인접한 출입구의 목적지 — 버튼과 씬 위에 미리 보여준다
  const adjacentExit = adjacentEntity ? getExit(location.id, adjacentEntity.id) : undefined;
  const exitLabel = adjacentExit ? `→ ${exitDestinationLabel(location.id, adjacentExit)}` : null;

  return (
    <div className="game-root">
      {screen === 'explore' && (
        <div className="explore-viewport">
          <div key={fadeKey} className="scene-fade-wrap">
            <SceneView
              location={location}
              locationTitle={locationLabel(location.id)}
              player={state.player}
              facing={facing}
              moving={moving}
              highlightId={adjacentEntity?.id ?? null}
              exitLabel={exitLabel}
              flags={state.flags}
              barks={barks}
            />
          </div>
          <ExploreHUD
            state={state}
            onNavigate={setScreen}
            hideMap={inPrologue}
            trackedQuestId={trackPref}
            onCycleTrack={cycleTrack}
            onOpenBag={() => {
              if (exploreActive && !transitioning) setBagOpen(true);
            }}
            bagDisabled={!exploreActive || transitioning}
            bagPulse={bagPulse}
          />
          {tutorialHint && <div className="tutorial-hint">{tutorialHint}</div>}
          {bannerVisible && exploreActive && !tutorialHint && (
            <ArrivalBanner locationId={location.id} />
          )}
          {bagOpen && (
            <BagPanel state={state} place={locationLabel(location.id)} onClose={closeBag} extraItems={bagFixture} />
          )}
          {exploreActive && (
            <TouchControls
              onMove={move}
              onInteract={interact}
              interactLabel={exitLabel ?? (adjacentEntity ? adjacentEntity.name : null)}
              interactIcon={adjacentExit ? '🚪' : '💬'}
            />
          )}
        </div>
      )}

      {screen !== 'explore' && (
        <div className="screen-page">
          {screen === 'worldmap' && (
            <WorldMapScreen state={state} dispatch={dispatch} onExplore={() => setScreen('explore')} />
          )}
          {screen === 'journal' && <JournalScreen state={state} trackedQuestId={trackPref} onTrack={setTrackPref} />}
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
        <EventScene eventId={eventId} playerName={state.player.name} flags={state.flags} onClose={() => setEventId(null)} />
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

/** 첫 방문 안내 — 장소 이름, 출입구 방향, 눈에 띄는 대상 */
function ArrivalBanner(props: { locationId: string }) {
  const loc = LOCATIONS[props.locationId];
  if (!loc) return null;
  const ways = loc.exits.map((e) => `${e.direction}: ${exitDestinationLabel(loc.id, e)}`);
  return (
    <div className="arrival-banner">
      <div className="arrival-title">{locationLabel(loc.id)}</div>
      <div className="arrival-note">{loc.arrivalNote}</div>
      {ways.length > 0 && <div className="arrival-ways">{ways.join(' · ')}</div>}
    </div>
  );
}
