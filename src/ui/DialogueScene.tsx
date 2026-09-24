import type { DialogueChoice, GameState } from '../game/types';
import type { DialogueTree } from '../game/content/dialogues';
import { resolveDialogueNode } from '../game/content/dialogues';
import { NPCS } from '../game/content/npcs';
import { LOCATIONS } from '../game/content/world';
import { SCENES } from '../game/content/scenes';

/**
 * MODE B — 대화 전용 장면.
 * 탐험 씬 위에 전체 화면으로 전환되어 NPC의 얼굴·행동을 크게 보여준다.
 * 대화 로직(트리·효과)은 기존 dialogues.ts를 그대로 사용한다.
 */
export function DialogueScene(props: {
  state: GameState;
  entityId: string;
  nodeId: string;
  snapshot: DialogueTree | null;
  onChoice: (choice: DialogueChoice) => void;
  onClose: () => void;
}) {
  const node = resolveDialogueNode(props.entityId, props.state, props.nodeId, props.snapshot);
  const npc = NPCS.find((n) => n.id === props.entityId);
  const scene = SCENES[props.state.player.location];
  const loc = LOCATIONS[props.state.player.location];
  const entity = loc?.entities.find((e) => e.id === props.entityId);

  return (
    <div className="dialogue-scene" style={loc?.stub ? { background: loc.stub.tone } : undefined}>
      {scene && <img className="dialogue-bg" src={scene.bg} alt="" draggable={false} />}
      <div className="dialogue-vignette" />

      {npc?.bust ? (
        <img className="dialogue-bust" src={npc.bust} alt={npc.name} draggable={false} />
      ) : (
        <div className="dialogue-poi-icon">{entity?.icon ?? '❔'}</div>
      )}

      <div className="dialogue-panel">
        {node.speaker && <div className="dialogue-name">{node.speaker}</div>}
        <p className="dialogue-body">{node.text}</p>
        <div className="dialogue-choices">
          {node.choices.map((c, i) => (
            <button key={i} onClick={() => props.onChoice(c)}>
              {c.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
