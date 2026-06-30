import { getEventById, type ArchiveEvent } from '../data/events';
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
          <small lang="ko">공식 포스터 보관소</small>
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
          <p className="section-kicker">개별 기록 / {event.status}</p>
          <h1>{event.title}</h1>
          <p className="event-subtitle">{event.subtitle}</p>
          <p className="detail-long">{event.longDescription}</p>
          <dl className="event-meta detail-meta">
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
  const event = getEventById(id);

  if (!event) {
    return (
      <div className="public-home detail-home">
        <header className="archive-header">
          <a className="archive-wordmark" href={detailRootHref()}>
            <span>Jerboa</span>
            <span>Circle</span>
            <small lang="ko">공식 포스터 보관소</small>
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
