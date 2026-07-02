import { useEffect, useMemo, useState } from 'react';
import { getEventById, type ArchiveEvent } from '../data/events';
import type { SiteText } from '../data/siteText';
import { applyArchiveDrafts, writeArchiveDrafts, type ArchiveDraftMap } from '../utils/archiveDrafts';
import { loadServerSync } from '../utils/serverSync';
import { getSiteText, writeSiteTextDraft } from '../utils/siteTextDrafts';
import './HomePage.css';

interface ArchiveSyncPayload {
  drafts?: ArchiveDraftMap;
  siteText?: Partial<SiteText>;
}

function detailRootHref() {
  return window.location.pathname.includes('/archive/') ? '../../' : './';
}

function EventDetail({ event, siteText }: { event: ArchiveEvent; siteText: SiteText }) {
  return (
    <div className="public-home detail-home">
      <header className="archive-header">
        <a className="archive-wordmark" href={detailRootHref()}>
          <span>Jerboa</span>
          <span>Circle</span>
          <small lang="ko">{siteText.wordmarkSmall}</small>
        </a>
        <nav className="archive-nav" aria-label="Archive record navigation">
          <a className="archive-nav-memory" href={detailRootHref()}><span lang="en">{siteText.detailNavArchiveEn}</span><small lang="ko">{siteText.detailNavArchiveKo}</small></a>
          <a className="archive-private-door" href={`${detailRootHref()}members/`}><span lang="en">{siteText.detailNavMembersEn}</span><small lang="ko">{siteText.detailNavMembersKo}</small></a>
        </nav>
      </header>
      <main className="detail-record section-reveal">
        <aside className="detail-poster">
          <img src={event.posterImage} alt={`${event.title} poster`} />
        </aside>
        <article className="detail-copy">
          <p className="section-kicker"><span lang="en">{event.edition}</span> / <span lang="ko">{siteText.detailKickerKo}</span></p>
          <h1>{event.title}</h1>
          <p className="event-subtitle">{event.subtitle}</p>
          <p className="latin-line">{event.latinQuote}</p>
          <p className="marginal-note" lang="ko">{event.marginalia}</p>
          <p className="detail-long" lang="ko">{event.longDescription}</p>
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
              <dt>{siteText.metaEdition}</dt>
              <dd>{event.edition}</dd>
            </div>
            <div>
              <dt>{siteText.metaDate}</dt>
              <dd>{event.date}</dd>
            </div>
            <div>
              <dt>{siteText.metaFormat}</dt>
              <dd>{event.location}</dd>
            </div>
            <div>
              <dt>{siteText.detailThemeLabel}</dt>
              <dd>{event.themes.join(' / ')}</dd>
            </div>
          </dl>
          <a className="archive-cta" href={detailRootHref()}>
            {siteText.detailBackLabel}
          </a>
        </article>
      </main>
    </div>
  );
}

export default function ArchiveDetailPage({ id }: { id: string | undefined }) {
  const [version, setVersion] = useState(0);
  const [siteText, setSiteText] = useState(() => getSiteText());
  const baseEvent = getEventById(id);
  const event = useMemo(
    () => (baseEvent ? applyArchiveDrafts([baseEvent])[0] : undefined),
    [baseEvent, version],
  );

  useEffect(() => {
    let ignore = false;

    async function loadPublicArchive() {
      try {
        const result = await loadServerSync<ArchiveSyncPayload>('archive');
        if (ignore || !result.exists || !result.saved?.data) return;

        if (result.saved.data.drafts) {
          writeArchiveDrafts(result.saved.data.drafts);
        }

        if (result.saved.data.siteText) {
          writeSiteTextDraft(result.saved.data.siteText);
          setSiteText(getSiteText());
        }

        setVersion((current) => current + 1);
      } catch (error) {
        console.warn('Public archive sync skipped:', error);
      }
    }

    void loadPublicArchive();

    return () => {
      ignore = true;
    };
  }, []);

  if (!event) {
    return (
      <div className="public-home detail-home">
        <header className="archive-header">
          <a className="archive-wordmark" href={detailRootHref()}>
          <span>Jerboa</span>
          <span>Circle</span>
            <small lang="ko">{siteText.wordmarkSmall}</small>
          </a>
        </header>
        <main className="missing-record">
          <p className="section-kicker">{siteText.missingKicker}</p>
          <h1 lang="ko">{siteText.missingTitle}</h1>
          <a className="archive-cta" href={detailRootHref()}>
            {siteText.detailBackLabel}
          </a>
        </main>
      </div>
    );
  }

  return <EventDetail event={event} siteText={siteText} />;
}
