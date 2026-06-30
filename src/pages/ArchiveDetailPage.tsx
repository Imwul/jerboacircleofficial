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
        </a>
        <nav className="archive-nav" aria-label="Archive record navigation">
          <a href={detailRootHref()}>Archive wall</a>
          <a href={`${detailRootHref()}members/`}>Members</a>
        </nav>
      </header>
      <main className="detail-record section-reveal">
        <aside className="detail-poster">
          <img src={event.posterImage} alt={`${event.title} poster`} />
        </aside>
        <article className="detail-copy">
          <p className="section-kicker">Archive record / {event.status}</p>
          <h1>{event.title}</h1>
          <p className="event-subtitle">{event.subtitle}</p>
          <p className="detail-long">{event.longDescription}</p>
          <dl className="event-meta detail-meta">
            <div>
              <dt>Date</dt>
              <dd>{event.date}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{event.location}</dd>
            </div>
            <div>
              <dt>Themes</dt>
              <dd>{event.themes.join(' / ')}</dd>
            </div>
          </dl>
          <a className="archive-cta" href={detailRootHref()}>
            Return to archive
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
          </a>
        </header>
        <main className="missing-record">
          <p className="section-kicker">Archive record missing</p>
          <h1>This poster has not entered the wall.</h1>
          <a className="archive-cta" href={detailRootHref()}>
            Return to archive
          </a>
        </main>
      </div>
    );
  }

  return <EventDetail event={event} />;
}
