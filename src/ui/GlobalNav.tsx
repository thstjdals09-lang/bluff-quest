import { useState } from 'react';

export type ScreenId =
  | 'explore'
  | 'worldmap'
  | 'journal'
  | 'profile'
  | 'career'
  | 'npcs'
  | 'collection'
  | 'special'
  | 'settings';

const MAIN_ITEMS: [ScreenId, string, string][] = [
  ['explore', '🧭', '탐험'],
  ['worldmap', '🗺️', '월드맵'],
  ['journal', '📜', '일지'],
  ['profile', '👤', '프로필'],
];

const MORE_ITEMS: [ScreenId, string, string][] = [
  ['career', '🃏', '포커 커리어'],
  ['npcs', '👥', '인물·관계'],
  ['collection', '🎴', '컬렉션'],
  ['special', '🏛️', '특별 콘텐츠'],
  ['settings', '⚙️', '설정'],
];

/** 전역 하단 내비게이션 — 주요 메뉴 4개 + 더보기(보조 메뉴). */
export function GlobalNav(props: { screen: ScreenId; onNavigate: (s: ScreenId) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = MORE_ITEMS.some(([id]) => id === props.screen);

  return (
    <>
      {moreOpen && (
        <div className="sheet-backdrop nav-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            {MORE_ITEMS.map(([id, icon, label]) => (
              <button
                key={id}
                className={props.screen === id ? 'active' : ''}
                onClick={() => {
                  props.onNavigate(id);
                  setMoreOpen(false);
                }}
              >
                <span>{icon}</span> {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <nav className="global-nav">
        {MAIN_ITEMS.map(([id, icon, label]) => (
          <button
            key={id}
            className={props.screen === id ? 'active' : ''}
            onClick={() => props.onNavigate(id)}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
        <button className={inMore || moreOpen ? 'active' : ''} onClick={() => setMoreOpen((v) => !v)}>
          <span className="nav-icon">☰</span>
          <span className="nav-label">더보기</span>
        </button>
      </nav>
    </>
  );
}
