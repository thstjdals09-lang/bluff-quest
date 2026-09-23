import { getEventById } from '../game/content/events';

/**
 * MODE D — 이벤트 장면. 중요한 발견·사건을 별도 연출 화면으로 보여준다.
 * 이후 이벤트별 일러스트를 EventDef.image로 연결한다.
 */
export function EventScene(props: { eventId: string; onClose: () => void }) {
  const ev = getEventById(props.eventId);
  if (!ev) {
    props.onClose();
    return null;
  }
  return (
    <div className="event-scene">
      <div className="event-card">
        {ev.image ? (
          <img className="event-image" src={ev.image} alt="" />
        ) : (
          <div className="event-icon">{ev.icon}</div>
        )}
        <h3 className="event-title">{ev.title}</h3>
        <p className="event-text">{ev.text}</p>
        {ev.footnote && <p className="event-footnote">✦ {ev.footnote}</p>}
        <button className="gold" onClick={props.onClose}>
          계속
        </button>
      </div>
    </div>
  );
}
