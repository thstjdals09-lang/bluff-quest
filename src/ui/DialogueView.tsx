import type { DialogueChoice, GameState } from '../game/types';
import { getInteraction } from '../game/content/dialogues';

export function DialogueView(props: {
  state: GameState;
  entityId: string;
  nodeId: string;
  onChoice: (choice: DialogueChoice) => void;
}) {
  const treeData = getInteraction(props.entityId, props.state);
  const node = treeData.nodes[props.nodeId] ?? treeData.nodes[treeData.entry];

  return (
    <div className="overlay">
      <div className="dialogue">
        {node.speaker && <div className="speaker">{node.speaker}</div>}
        <p className="dialogue-text">{node.text}</p>
        <div className="choices">
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
