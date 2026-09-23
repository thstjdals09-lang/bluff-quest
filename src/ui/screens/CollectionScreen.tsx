import type { GameState } from '../../game/types';
import { COLLECTION, countDiscovered, isDiscovered } from '../../game/content/collection';
import { ITEMS } from '../../game/content/world';

/**
 * 컬렉션 — 발견 기록(state.discovered)과 현재 보유(state.inventory)를 구분해 표시.
 * 아이템을 사용해도 발견 기록은 남는다.
 */
export function CollectionScreen(props: { state: GameState }) {
  const { state } = props;
  const { found, total } = countDiscovered(state);

  return (
    <div className="screen">
      <h2 className="screen-title">🎴 컬렉션</h2>
      <p className="screen-sub">
        발견 {found} / {total} — 세계 곳곳의 특별한 것들.
      </p>

      {COLLECTION.map((cat) => (
        <div key={cat.id} className="card">
          <b>{cat.name}</b>
          <p className="dim">{cat.desc}</p>
          <div className="collection-grid">
            {cat.entries.map((entry) => {
              const discovered = isDiscovered(entry, state);
              const owned = entry.itemId !== undefined && state.inventory.includes(entry.itemId);
              if (discovered) {
                return (
                  <div key={entry.id} className="collect-slot found" title={entry.desc}>
                    <span className="collect-icon">{ITEMS[entry.itemId ?? '']?.icon ?? entry.icon}</span>
                    <b>{entry.name}</b>
                    <span className="dim">{owned ? '보유 중' : '발견 기록'}</span>
                  </div>
                );
              }
              return (
                <div key={entry.id} className="collect-slot locked" title={entry.desc}>
                  <span className="collect-icon silhouette">{entry.status === 'unrevealed' ? '🂠' : entry.icon}</span>
                  <b>{entry.status === 'unrevealed' ? '???' : entry.name}</b>
                  <span className="dim">
                    {entry.status === 'coming_soon' ? '개발 예정' : entry.status === 'obtainable' ? '미발견' : '미공개'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
