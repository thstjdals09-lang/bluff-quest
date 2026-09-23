import type { LocationDef, PlayerState } from '../game/types';

export function MapView(props: {
  location: LocationDef;
  player: PlayerState;
  highlightId: string | null;
}) {
  const { location, player } = props;
  const rows = location.layout;
  const cols = rows[0].length;

  return (
    <div className="map-wrap">
      <div className="map-title">📍 {location.name}</div>
      <div
        className="map-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {rows.map((row, y) =>
          row.split('').map((cell, x) => {
            const entity = location.entities.find((e) => e.x === x && e.y === y);
            const isPlayer = player.x === x && player.y === y;
            const cls = cell === '#' ? 'tile wall' : 'tile floor';
            return (
              <div key={`${x}-${y}`} className={cls}>
                {isPlayer ? (
                  <span className="sprite player">🤠</span>
                ) : entity ? (
                  <span
                    className={`sprite ${props.highlightId === entity.id ? 'highlight' : ''}`}
                    title={entity.name}
                  >
                    {entity.icon}
                  </span>
                ) : null}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
