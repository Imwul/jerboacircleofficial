import { useEffect, useMemo, useState } from 'react';
import { events, type ArchiveEvent } from '../data/events';
import type { SiteText } from '../data/siteText';
import { applyArchiveDrafts } from '../utils/archiveDrafts';
import { loadServerSync } from '../utils/serverSync';
import { getSiteText, writeSiteTextDraft } from '../utils/siteTextDrafts';
import { writeArchiveDrafts, type ArchiveDraftMap } from '../utils/archiveDrafts';
import { usePageMetadata } from '../utils/pageMetadata';
import jerboaSeal from '../assets/identity/jerboa-seal.png';
import { editorialPlates } from '../data/manuscriptPlates';
import './HomePage.css';
import './EditorialStability.css';

interface ArchiveSyncPayload {
  drafts?: ArchiveDraftMap;
  siteText?: Partial<SiteText>;
}

type ArchiveStatusFilter = ArchiveEvent['status'] | 'all';

const archiveBookmarkStorageKey = 'jerboa-circle-archive-bookmarks';

function readArchiveBookmarks() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(archiveBookmarkStorageKey);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeArchiveBookmarks(ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(archiveBookmarkStorageKey, JSON.stringify(ids));
}

function textLang(text: string) {
  return /[가-힣]/.test(text) ? 'ko' : 'en';
}

function EditorialPlate({
  className,
  image,
}: {
  className: string;
  image: string;
}) {
  return (
    <figure className={`editorial-plate ${className}`} aria-hidden="true">
      <img src={image} alt="" loading="lazy" decoding="async" />
    </figure>
  );
}

function EditorialKicker({ en, ko }: { en: string; ko: string }) {
  const mode = en.length > 20 ? 'long' : 'short';

  return (
    <p className="section-kicker" data-kicker-mode={mode}>
      <span className="kicker-en" lang="en" data-kicker-en>{en}</span>
      <span className="kicker-divider" aria-hidden="true"> / </span>
      <span className="kicker-ko" lang="ko" data-kicker-ko>{ko}</span>
    </p>
  );
}

function SiteHeader({ siteText }: { siteText: SiteText }) {
  return (
    <header className="archive-header" aria-label="Jerboa Circle navigation">
      <a className="archive-wordmark" href="./" aria-label="Jerboa Circle archive home">
        <span>Jerboa</span>
        <span>Circle</span>
        <small lang="la">{siteText.wordmarkSmall}</small>
      </a>
      <nav className="archive-nav" aria-label="Primary navigation">
        <a className="archive-nav-threshold" href="#featured"><span className="nav-en" lang="en">{siteText.navFeaturedEn}</span><small lang="ko">{siteText.navFeaturedKo}</small></a>
        <a className="archive-nav-memory" href="#archive"><span className="nav-en" lang="en">{siteText.navArchiveEn}</span><small lang="ko">{siteText.navArchiveKo}</small></a>
        <a className="archive-nav-fragments" href="#manifesto"><span className="nav-en" lang="en">{siteText.navManifestoEn}</span><small lang="ko">{siteText.navManifestoKo}</small></a>
        <a className="archive-nav-letter" href="#join"><span className="nav-en" lang="en">{siteText.navJoinEn}</span><small lang="ko">{siteText.navJoinKo}</small></a>
        <a className="archive-private-door" href="./members/"><span className="nav-en" lang="en">{siteText.navMembersEn}</span><small lang="ko">{siteText.navMembersKo}</small></a>
      </nav>
    </header>
  );
}

function Masthead({ featuredEvent, siteText }: { featuredEvent: ArchiveEvent; siteText: SiteText }) {
  return (
    <section className="publication-masthead" aria-label="Jerboa Circle publication identity">
      <div className="masthead-mark">
        <img className="masthead-logo" src={jerboaSeal} alt="" aria-hidden="true" decoding="async" width={591} height={591} />
        <svg className="masthead-ring" viewBox="0 0 600 600" aria-hidden="true">
          <defs>
            <path
              id="jerboaSealRingPath"
              d="M300,300 m-284,0 a284,284 0 1,1 568,0 a284,284 0 1,1 -568,0"
            />
          </defs>
          <text>
            <textPath href="#jerboaSealRingPath" startOffset="2%">
              {siteText.mastheadRing}
            </textPath>
          </text>
        </svg>
        <div className="masthead-seal-caption">
          <span lang="en">{siteText.mastheadCaptionEn}</span>
          <small lang="ko">{siteText.mastheadCaptionKo}</small>
        </div>
      </div>
      <div className="masthead-index">
        <p className="gate-label" lang="en">Gate</p>
        <p lang="en">{siteText.mastheadIntroEn}</p>
        <p lang="ko">{siteText.mastheadIntroKo}</p>
        <EditorialPlate
          className="editorial-plate--masthead"
          image={editorialPlates.masthead}
        />
        <div className="orientation-ledger" aria-label="How to read this archive">
          <p className="orientation-kicker">
            <span lang="en">{siteText.orientationKickerEn}</span>
            <span aria-hidden="true"> / </span>
            <span lang="ko">{siteText.orientationKickerKo}</span>
          </p>
          <strong><span lang="ko">{siteText.orientationStatementKo}</span></strong>
          <div className="orientation-routes">
            <a href="#featured">
              <span className="route-en" lang="en">{siteText.navFeaturedEn}</span>
              <small lang="ko">{siteText.orientationCurrentKo}</small>
            </a>
            <a href="#archive">
              <span className="route-en" lang="en">{siteText.navArchiveEn}</span>
              <small lang="ko">{siteText.orientationArchiveKo}</small>
            </a>
            <a href="./members/">
              <span className="route-en" lang="en">{siteText.navMembersEn}</span>
              <small lang="ko">{siteText.orientationPrivateKo}</small>
            </a>
          </div>
        </div>
        <ol className="masthead-ritual">
          <li>{siteText.ritualOne}</li>
          <li>{siteText.ritualTwo}</li>
          <li>{siteText.ritualThree}</li>
          <li>{siteText.ritualFour}</li>
        </ol>
      </div>
      <p className="masthead-latin">{featuredEvent.latinQuote}</p>
    </section>
  );
}

function statusLabel(status: ArchiveEvent['status'], siteText: SiteText) {
  if (status === 'current') return siteText.statusCurrent;
  if (status === 'upcoming') return siteText.statusUpcoming;
  return siteText.statusPast;
}

function EventMeta({ event, siteText }: { event: ArchiveEvent; siteText: SiteText }) {
  return (
    <dl className="event-meta" aria-label={`${event.title} metadata`}>
      <div>
        <dt lang={textLang(siteText.metaEdition)}>{siteText.metaEdition}</dt>
        <dd lang={textLang(event.edition)}>{event.edition}</dd>
      </div>
      <div>
        <dt lang={textLang(siteText.metaDate)}>{siteText.metaDate}</dt>
        <dd lang={textLang(event.date)}>{event.date}</dd>
      </div>
      <div>
        <dt lang={textLang(siteText.metaStatus)}>{siteText.metaStatus}</dt>
        <dd lang={textLang(statusLabel(event.status, siteText))}>{statusLabel(event.status, siteText)}</dd>
      </div>
      <div>
        <dt lang={textLang(siteText.metaFormat)}>{siteText.metaFormat}</dt>
        <dd lang={textLang(event.location)}>{event.location}</dd>
      </div>
    </dl>
  );
}

function TextIndex({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="text-index">
      <span className="text-index-title"><span lang={textLang(title)}>{title}</span></span>
      <ol>
        {items.map((item) => (
          <li key={item}><span lang={textLang(item)}>{item}</span></li>
        ))}
      </ol>
    </div>
  );
}

function ThemeList({ themes }: { themes: string[] }) {
  return (
    <ul className="theme-tags" aria-label="Themes">
      {themes.map((theme) => (
        <li key={theme} lang={textLang(theme)}>{theme}</li>
      ))}
    </ul>
  );
}

function FeaturedEvent({ featuredEvent, siteText }: { featuredEvent: ArchiveEvent; siteText: SiteText }) {
  return (
    <section className="featured-event section-reveal" id="featured">
      <div className="featured-poster-wrap">
        <img src={featuredEvent.posterImage} alt={`${featuredEvent.title} poster`} decoding="async" width={1200} height={1600} />
      </div>
      <div className="featured-copy">
        <EditorialKicker en={siteText.featuredKickerEn} ko={siteText.featuredKickerKo} />
        <h1>{featuredEvent.title}</h1>
        <p className="korean-annotation" lang="ko">
          {siteText.featuredAnnotation}
        </p>
        <p className="event-subtitle">{featuredEvent.subtitle}</p>
        <p className="latin-line">{featuredEvent.latinQuote}</p>
        <p className="marginal-note" lang="ko">{featuredEvent.marginalia}</p>
        <EditorialPlate
          className="editorial-plate--featured"
          image={editorialPlates.featured}
        />
        <p className="event-description" lang="ko">{featuredEvent.shortDescription}</p>
        <div className="constellation-grid" aria-label="Programme constellation">
          <TextIndex title={siteText.journeyLabel} items={featuredEvent.passage} />
          <TextIndex title={siteText.materialsLabel} items={featuredEvent.materials} />
        </div>
        <EventMeta event={featuredEvent} siteText={siteText} />
        <a className="archive-cta" href={featuredEvent.ctaHref} lang={textLang(featuredEvent.ctaLabel)}>
          {featuredEvent.ctaLabel}
        </a>
      </div>
    </section>
  );
}

function matchesArchiveQuery(event: ArchiveEvent, query: string) {
  if (!query.trim()) return true;

  const searchable = [
    event.edition,
    event.title,
    event.subtitle,
    event.latinQuote,
    event.marginalia,
    event.date,
    event.shortDescription,
    event.longDescription,
    event.location,
    ...event.passage,
    ...event.materials,
    ...event.themes,
  ].join(' ').toLowerCase();

  return searchable.includes(query.trim().toLowerCase());
}

function PosterTile({
  event,
  isBookmarked,
  onToggleBookmark,
}: {
  event: ArchiveEvent;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
}) {
  return (
    <article className="poster-tile section-reveal">
      <button
        type="button"
        className="archive-bookmark"
        aria-pressed={isBookmarked}
        aria-label={`${event.title} ${isBookmarked ? '북마크 해제' : '북마크'}`}
        onClick={() => onToggleBookmark(event.id)}
      >
        <span aria-hidden="true">{isBookmarked ? 'Filed' : 'File'}</span>
      </button>
      <a href={event.ctaHref} aria-label={`Open archive record for ${event.title}`}>
        <div className="poster-frame">
          <img src={event.posterImage} alt={`${event.title} poster`} loading="lazy" decoding="async" width={1200} height={1600} />
        </div>
        <div className="poster-caption">
          <span>{event.edition}</span>
          <h2>{event.title}</h2>
          <small>{event.latinQuote}</small>
          <p lang="ko">{event.shortDescription}</p>
          <em lang="ko">{event.marginalia}</em>
          <ThemeList themes={event.themes} />
        </div>
      </a>
    </article>
  );
}

function PosterArchive({ archiveEvents, siteText }: { archiveEvents: ArchiveEvent[]; siteText: SiteText }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArchiveStatusFilter>('all');
  const [bookmarkedIds, setBookmarkedIds] = useState(() => readArchiveBookmarks());
  const statusFilters: ArchiveStatusFilter[] = ['all', 'current', 'upcoming', 'past'];
  const visibleEvents = archiveEvents.filter((event) => {
    const statusMatches = statusFilter === 'all' || event.status === statusFilter;
    return statusMatches && matchesArchiveQuery(event, query);
  });
  const bookmarkedEvents = visibleEvents.filter((event) => bookmarkedIds.includes(event.id));
  const unbookmarkedEvents = visibleEvents.filter((event) => !bookmarkedIds.includes(event.id));
  const orderedVisibleEvents = [...bookmarkedEvents, ...unbookmarkedEvents];

  function toggleBookmark(id: string) {
    setBookmarkedIds((current) => {
      const next = current.includes(id)
        ? current.filter((bookmarkId) => bookmarkId !== id)
        : [...current, id];
      writeArchiveBookmarks(next);
      return next;
    });
  }

  return (
    <section className="poster-archive" id="archive">
      <div className="archive-section-title">
        <EditorialKicker en={siteText.archiveKickerEn} ko={siteText.archiveKickerKo} />
        <h2 className="ko-display"><span lang="ko">{siteText.archiveHeading}</span></h2>
        <EditorialPlate
          className="editorial-plate--archive"
          image={editorialPlates.archive}
        />
      </div>
      <div className="archive-tools" aria-label="Archive search and filters">
        <label className="archive-search">
          <span lang="en">Find</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목, 주제, 자료 검색"
            aria-label="아카이브 검색"
          />
        </label>
        <div className="archive-filter-set" aria-label="Archive status filter">
          {statusFilters.map((filter) => (
            <button
              type="button"
              key={filter}
              className={statusFilter === filter ? 'is-active' : ''}
              aria-pressed={statusFilter === filter}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'all' ? 'All' : statusLabel(filter, siteText)}
            </button>
          ))}
        </div>
        <p className="archive-results-count" lang="ko">
          {visibleEvents.length}개의 기록
          {bookmarkedIds.length > 0 ? ` / 북마크 ${bookmarkedIds.length}` : ''}
        </p>
      </div>
      <div className="archive-ledger" aria-label="Programme index">
        {orderedVisibleEvents.map((event) => (
          <a href={event.ctaHref} key={event.id}>
            <span>{event.edition}</span>
            <strong>{event.title}</strong>
            <em>{event.date}</em>
            <small lang="ko">{event.marginalia}</small>
          </a>
        ))}
      </div>
      {orderedVisibleEvents.length > 0 ? (
        <div className="poster-grid">
          {orderedVisibleEvents.map((event) => (
            <PosterTile
              event={event}
              isBookmarked={bookmarkedIds.includes(event.id)}
              key={event.id}
              onToggleBookmark={toggleBookmark}
            />
          ))}
        </div>
      ) : (
        <div className="archive-empty-state" role="status" lang="ko">
          맞는 기록이 없습니다. 검색어를 줄이거나 상태 필터를 바꿔보세요.
        </div>
      )}
    </section>
  );
}

function ManifestoBlock({ siteText }: { siteText: SiteText }) {
  return (
    <section className="manifesto-block section-reveal" id="manifesto">
      <EditorialKicker en={siteText.manifestoKickerEn} ko={siteText.manifestoKickerKo} />
      <EditorialPlate
        className="editorial-plate--manifesto"
        image={editorialPlates.manifesto}
      />
      <p className="ko-display"><span lang="ko">{siteText.manifestoBody}</span></p>
    </section>
  );
}

function JoinBlock({ siteText }: { siteText: SiteText }) {
  return (
    <section className="join-block section-reveal" id="join">
      <div>
        <EditorialKicker en={siteText.joinKickerEn} ko={siteText.joinKickerKo} />
        <EditorialPlate
          className="editorial-plate--join"
          image={editorialPlates.join}
        />
        <h2 className="ko-display"><span lang="ko">{siteText.joinHeading}</span></h2>
      </div>
      <a className="archive-cta inverse" href={siteText.joinCtaHref} lang={textLang(siteText.joinCtaLabel)}>
        {siteText.joinCtaLabel}
      </a>
    </section>
  );
}

function SiteFooter({ siteText }: { siteText: SiteText }) {
  return (
    <footer className="archive-footer">
      <span>{siteText.footerLeft}</span>
      <span lang="it">{siteText.footerRight}</span>
    </footer>
  );
}

export default function HomePage() {
  const [version, setVersion] = useState(0);
  const [siteText, setSiteText] = useState(() => getSiteText());
  const archiveEvents = useMemo(() => applyArchiveDrafts(events), [version]);
  const currentEvent = archiveEvents.find((event) => event.status === 'current') ?? archiveEvents[0];

  usePageMetadata({
    title: 'Jerboa Circle Official Archive',
    description: `${currentEvent.title}: ${currentEvent.shortDescription}`,
    canonicalPath: '/',
  });

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
        if (!(error instanceof Error) || error.message !== 'sync_unavailable') {
          console.warn('Public archive sync skipped:', error);
        }
      }
    }

    void loadPublicArchive();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="public-home">
      <a className="skip-to-archive" href="#archive">기록 목록으로 바로가기</a>
      <SiteHeader siteText={siteText} />
      <main>
        <Masthead featuredEvent={currentEvent} siteText={siteText} />
        <FeaturedEvent featuredEvent={currentEvent} siteText={siteText} />
        <PosterArchive archiveEvents={archiveEvents} siteText={siteText} />
        <ManifestoBlock siteText={siteText} />
        <JoinBlock siteText={siteText} />
      </main>
      <SiteFooter siteText={siteText} />
    </div>
  );
}
