import { useState } from 'react';
import type { GameState, ItemDef } from '../game/types';
import { getBag, bagSlotCount } from '../game/content/bag';
import { RECORD_KIND_LABELS } from '../game/content/records';
import { GameSheet } from './GameSheet';
import { ItemGlyph } from './ItemGlyph';

/**
 * 가방 (GM-P8 세로 슬라이스) — 칸 그리드 → 고른 아이템의 큰 그림·이름·설명·실제로 이어진 사건/기록.
 * 읽기 전용: 사용·보여주기처럼 지금 할 수 없는 행동 버튼은 두지 않는다.
 */
export function BagPanel(props: {
  state: GameState;
  place: string;
  onClose: () => void;
  /** 개발자 모드 화면 검수용 표시 전용 아이템 */
  extraItems?: readonly ItemDef[];
}) {
  const bag = getBag(props.state, props.extraItems);
  const [selectedId, setSelectedId] = useState<string | null>(bag[0]?.item.id ?? null);
  const selected = bag.find((b) => b.item.id === selectedId) ?? bag[0] ?? null;
  const slots = bagSlotCount(bag.length);

  return (
    <GameSheet title="가방" icon="🎒" meta={`${bag.length}/${slots}`} place={props.place} className="bag-sheet" onClose={props.onClose}>
      <div className="bag-grid" role="listbox" aria-label="소지품">
        {Array.from({ length: slots }, (_, i) => {
          const entry = bag[i];
          if (!entry) return <div key={`empty-${i}`} className="bag-slot empty" aria-hidden="true" />;
          const on = entry.item.id === selected?.item.id;
          return (
            <button
              key={entry.item.id}
              className={`bag-slot ${on ? 'selected' : ''}`}
              role="option"
              aria-selected={on}
              aria-label={entry.item.name}
              data-item={entry.item.id}
              onClick={() => setSelectedId(entry.item.id)}
            >
              <ItemGlyph item={entry.item} />
              {(entry.quests.some((q) => !q.done)) && <span className="bag-slot-pip" title="진행 중인 사건과 이어짐" />}
            </button>
          );
        })}
      </div>

      <div className="bag-detail" aria-live="polite">
        {!selected && (
          <div className="bag-empty">
            <p>가방이 비어 있다.</p>
            <p className="dim">길에서 주운 것, 승부에서 딴 것이 이 칸들에 담긴다.</p>
          </div>
        )}
        {selected && (
          <div key={selected.item.id} className="bag-detail-inner">
            <div className="bag-hero">
              <div className="bag-hero-plate">
                <ItemGlyph item={selected.item} className="large" />
              </div>
              <h3 className="bag-item-name">{selected.item.name}</h3>
            </div>
            <p className="bag-item-desc">{selected.item.desc}</p>
            {selected.quests.length > 0 && (
              <div className="bag-links">
                <b className="bag-links-title">이어진 사건</b>
                {selected.quests.map((q) => (
                  <div key={q.id} className={`bag-quest ${q.done ? 'done' : 'active'}`}>
                    <span className="chip">{q.done ? '끝남' : '진행 중'}</span>
                    <span>
                      <b>{q.name}</b> · {q.stageTitle}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {selected.records.length > 0 && (
              <div className="bag-links">
                <b className="bag-links-title">관련 기록</b>
                {selected.records.map((r, i) => (
                  <p key={i} className="bag-record">
                    <span className={`chip record-${r.kind}`}>{RECORD_KIND_LABELS[r.kind]}</span> {r.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </GameSheet>
  );
}
