import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * 게임 안 메뉴 셸 (GM-P8) — 탐험 장면 위에 겹치는 일시정지형 판.
 * 장면·플레이어는 뒤에 그대로 남고(어둡게만), 메뉴가 열린 동안 이동·상호작용 입력은 App이 막는다.
 * 세로: 아래에서 올라오는 판 / 가로: 아래쪽 넓은 판(내용은 두 열). 닫으면 바로 원래 화면·조작으로 돌아간다.
 * 가방 외 탭(일지·프로필)으로 넓힐 때도 이 셸을 그대로 쓴다.
 */
export function GameSheet(props: {
  title: string;
  icon: string;
  /** 제목 옆 짧은 상태 (예: 4/12) */
  meta?: string;
  /** 장면 맥락 — 지금 서 있는 장소 */
  place?: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { onClose } = props;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="gs-backdrop" onClick={onClose} data-testid="game-sheet">
      <section
        className={`gs-panel ${props.className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="gs-head">
          <span className="gs-title">
            <span className="gs-title-icon" aria-hidden="true">{props.icon}</span>
            {props.title}
            {props.meta && <span className="gs-meta">{props.meta}</span>}
          </span>
          <span className="gs-pause" title="메뉴가 열린 동안 탐험은 멈춰 있다">⏸ 탐험 멈춤{props.place ? ` · ${props.place}` : ''}</span>
          <button ref={closeRef} className="gs-close" onClick={onClose} aria-label="닫기">
            ✕<span className="gs-close-label">닫기</span>
          </button>
        </header>
        <div className="gs-body">{props.children}</div>
      </section>
    </div>
  );
}
