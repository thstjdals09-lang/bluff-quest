import { getEventById } from '../game/content/events';

/**
 * MODE D — 이벤트 장면. 중요한 발견·사건을 별도 연출 화면으로 보여준다.
 * 이후 이벤트별 일러스트를 EventDef.image로 연결한다.
 * 텍스트의 {name}은 플레이어의 승부사 이름으로 치환된다.
 */
export function EventScene(props: { eventId: string; playerName: string; onClose: () => void }) {
  const ev = getEventById(props.eventId);
  if (!ev) {
    props.onClose();
    return null;
  }
  const fill = (s: string) => s.split('{name}').join(props.playerName);
  return (
    <div className="event-scene">
      <div className="event-card">
        {ev.image ? (
          <img className="event-image" src={ev.image} alt="" />
        ) : (
          <div className="event-icon">{ev.icon}</div>
        )}
        <h3 className="event-title">{fill(ev.title)}</h3>
        <p className="event-text">{fill(ev.text)}</p>
        {ev.footnote && <p className="event-footnote">✦ {fill(ev.footnote)}</p>}
        <button className="gold" onClick={props.onClose}>
          계속
        </button>
      </div>
    </div>
  );
}
