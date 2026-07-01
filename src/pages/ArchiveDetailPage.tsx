import { getEventById, type ArchiveEvent } from '../data/events';
import { applyArchiveDrafts } from '../utils/archiveDrafts';
import './HomePage.css';

function detailRootHref() {
  return window.location.pathname.includes('/archive/') ? '../../' : './';
}

function EventDetail({ event }: { event: ArchiveEvent }) {
  return (
    <div className="public-home detail-home">
      <header className="archive-header">
        <a className="archive-wordmark" href={detailRootHref()}>
          <span>Jerboa</span>
          <span>Circle</span>
          <small lang="ko">여정과 기억의 장부</small>
        </a>
        <nav className="archive-nav" aria-label="Archive record navigation">
          <a href={detailRootHref()}>기록벽</a>
          <a href={`${detailRootHref()}members/`}>회원실</a>
        </nav>
      </header>
      <main className="detail-record section-reveal">
        <aside className="detail-poster">
          <img src={event.posterImage} alt={`${event.title} poster`} />
        </aside>
        <article className="detail-copy">
          <p className="section-kicker">{event.edition} / 개별 여정 / {event.status}</p>
          <h1>{event.title}</h1>
          <p className="event-subtitle">{event.subtitle}</p>
          <p className="latin-line">{event.latinQuote}</p>
          <p className="marginal-note" lang="ko">{event.marginalia}</p>
          <p className="detail-long">{event.longDescription}</p>
          <div className="constellation-grid" aria-label="Archive record path and materials">
            <div className="text-index">
              <span>여정</span>
              <ol>
                {event.passage.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </div>
            <div className="text-index">
              <span>자료</span>
              <ol>
                {event.materials.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </div>
          </div>
          <dl className="event-meta detail-meta">
            <div>
              <dt>판본</dt>
              <dd>{event.edition}</dd>
            </div>
            <div>
              <dt>일자</dt>
              <dd>{event.date}</dd>
            </div>
            <div>
              <dt>형식</dt>
              <dd>{event.location}</dd>
            </div>
            <div>
              <dt>주제</dt>
              <dd>{event.themes.join(' / ')}</dd>
            </div>
          </dl>
          <a className="archive-cta" href={detailRootHref()}>
            기록벽으로 돌아가기
          </a>
        </article>
      </main>
    </div>
  );
}

export default function ArchiveDetailPage({ id }: { id: string | undefined }) {
  const baseEvent = getEventById(id);
  const event = baseEvent ? applyArchiveDrafts([baseEvent])[0] : undefined;

  if (!event) {
    return (
      <div className="public-home detail-home">
        <header className="archive-header">
          <a className="archive-wordmark" href={detailRootHref()}>
          <span>Jerboa</span>
          <span>Circle</span>
            <small lang="ko">여정과 기억의 장부</small>
          </a>
        </header>
        <main className="missing-record">
          <p className="section-kicker">사라진 기록</p>
          <h1 lang="ko">아직 벽에 걸리지 않은 포스터입니다.</h1>
          <a className="archive-cta" href={detailRootHref()}>
            기록벽으로 돌아가기
          </a>
        </main>
      </div>
    );
  }

  return <EventDetail event={event} />;
}
