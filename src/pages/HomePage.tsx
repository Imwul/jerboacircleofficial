import { useEffect, useMemo, useState } from 'react';
import {
  archiveCollections,
  archiveSeasons,
  events,
  getCollectionsForEvent,
  getPublicArchiveEvents,
  getSeasonById,
  type ArchiveEvent,
} from '../data/events';
import type { SiteText } from '../data/siteText';
import { applyArchiveDrafts } from '../utils/archiveDrafts';
import { loadServerSync } from '../utils/serverSync';
import { getSiteText, writeSiteTextDraft } from '../utils/siteTextDrafts';
import { writeArchiveDrafts, type ArchiveDraftMap } from '../utils/archiveDrafts';
import { usePageMetadata } from '../utils/pageMetadata';
import { normalizeSearchTerm, trackProductEvent } from '../utils/productAnalytics';
import jerboaSeal from '../assets/identity/jerboa-seal-transparent.webp';
import { editorialPlates } from '../data/manuscriptPlates';
import type { ArchiveMediaAsset } from '../data/mediaAssets';
import { archiveKnowledgeSearchText, archiveReferences, type ArchiveReference } from '../data/archiveKnowledge';
import {
  applyArchiveReferenceDrafts,
  writeArchiveReferenceDrafts,
  type ArchiveReferenceDraftMap,
} from '../utils/archiveReferenceDrafts';
import ArchiveConstellation from '../components/archive/ArchiveConstellation';
import './HomePage.css';
import './EditorialStability.css';
import '../JerboaCondoRefine.css';

interface ArchiveSyncPayload {
  schemaVersion?: 1 | 2 | 3;
  drafts?: ArchiveDraftMap;
  siteText?: Partial<SiteText>;
  references?: ArchiveReferenceDraftMap;
}

type ArchiveStatusFilter = ArchiveEvent['status'] | 'all';
type ArchiveTaxonomyFilter = string | 'all';

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

function readArchiveQueryState() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  return {
    query: params.get('q') ?? '',
    status: status === 'current' || status === 'upcoming' || status === 'past' ? status : 'all',
    season: params.get('season') ?? 'all',
    collection: params.get('collection') ?? 'all',
    filed: params.get('filed') === '1',
    view: params.get('view') === 'constellation' ? 'constellation' : 'chronology',
  } as const;
}

function textLang(text: string) {
  return /[가-힣]/.test(text) ? 'ko' : 'en';
}

function EditorialPlate({
  className,
  asset,
}: {
  className: string;
  asset: ArchiveMediaAsset;
}) {
  return (
    <figure className={`editorial-plate ${className}`} aria-hidden="true">
      <img src={asset.src} alt="" loading="lazy" decoding="async" />
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
        <p lang="en">{siteText.mastheadIntroEn}</p>
        <p lang="ko">{siteText.mastheadIntroKo}</p>
        <EditorialPlate
          className="editorial-plate--masthead"
          asset={editorialPlates.masthead}
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
        <h1 lang={textLang(featuredEvent.title)}>{featuredEvent.title}</h1>
        <p className="event-subtitle" lang={textLang(featuredEvent.subtitle)}>{featuredEvent.subtitle}</p>
        <p className="latin-line" lang={textLang(featuredEvent.latinQuote)}>{featuredEvent.latinQuote}</p>
        <p className="marginal-note" lang="ko">{featuredEvent.marginalia}</p>
        <EditorialPlate
          className="editorial-plate--featured"
          asset={editorialPlates.featured}
        />
        <p className="event-description" lang="ko">{featuredEvent.shortDescription}</p>
        <div className="constellation-grid" aria-label="Programme constellation">
          <TextIndex title={siteText.journeyLabel} items={featuredEvent.passage} />
          <TextIndex title={siteText.materialsLabel} items={featuredEvent.materials} />
        </div>
        <EventMeta event={featuredEvent} siteText={siteText} />
        <a className="archive-cta" href={featuredEvent.ctaHref}>
          <span className="archive-cta-label" lang={textLang(featuredEvent.ctaLabel)}>{featuredEvent.ctaLabel}</span>
        </a>
      </div>
    </section>
  );
}

function matchesArchiveQuery(
  event: ArchiveEvent,
  query: string,
  archiveEvents: ArchiveEvent[],
  references: ArchiveReference[],
) {
  if (!query.trim()) return true;

  const searchable = [
    event.kind,
    event.edition,
    event.title,
    event.subtitle,
    event.latinQuote,
    event.marginalia,
    event.date,
    event.shortDescription,
    event.longDescription,
    event.location,
    getSeasonById(event.seasonId)?.title,
    getSeasonById(event.seasonId)?.label,
    ...getCollectionsForEvent(event).map((collection) => collection.title),
    ...event.passage,
    ...event.materials,
    ...event.themes,
    archiveKnowledgeSearchText(event, archiveEvents, references),
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
          <h2 lang={textLang(event.title)}>{event.title}</h2>
          <p lang="ko">{event.shortDescription}</p>
          <ThemeList themes={event.themes.slice(0, 3)} />
        </div>
        <span className="poster-open-tab" aria-hidden="true">Open <i>🜍</i></span>
      </a>
    </article>
  );
}

function PosterArchive({ archiveEvents, references, siteText }: { archiveEvents: ArchiveEvent[]; references: ArchiveReference[]; siteText: SiteText }) {
  const initialQueryState = useMemo(readArchiveQueryState, []);
  const [query, setQuery] = useState(initialQueryState.query);
  const [statusFilter, setStatusFilter] = useState<ArchiveStatusFilter>(initialQueryState.status);
  const [seasonFilter, setSeasonFilter] = useState<ArchiveTaxonomyFilter>(initialQueryState.season);
  const [collectionFilter, setCollectionFilter] = useState<ArchiveTaxonomyFilter>(initialQueryState.collection);
  const [filedOnly, setFiledOnly] = useState(initialQueryState.filed);
  const [archiveView, setArchiveView] = useState<'chronology' | 'constellation'>(initialQueryState.view);
  const [bookmarkedIds, setBookmarkedIds] = useState(() => readArchiveBookmarks());
  const statusFilters: ArchiveStatusFilter[] = ['all', 'current', 'upcoming', 'past'];
  const seasonOptions = archiveSeasons.filter((season) => archiveEvents.some((event) => event.seasonId === season.id));
  const collectionOptions = archiveCollections.filter((collection) => (
    collection.visibility === 'public'
    && archiveEvents.some((event) => event.collectionIds.includes(collection.id) || collection.eventIds.includes(event.id))
  ));
  const visibleEvents = archiveEvents.filter((event) => {
    const statusMatches = statusFilter === 'all' || event.status === statusFilter;
    const seasonMatches = seasonFilter === 'all' || event.seasonId === seasonFilter;
    const collectionMatches = collectionFilter === 'all' || event.collectionIds.includes(collectionFilter);
    const filedMatches = !filedOnly || bookmarkedIds.includes(event.id);
    return statusMatches && seasonMatches && collectionMatches && filedMatches
      && matchesArchiveQuery(event, query, archiveEvents, references);
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
      trackProductEvent('archive_bookmark_toggle', {
        recordId: id,
        active: next.includes(id),
      });
      return next;
    });
  }

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (seasonFilter !== 'all') params.set('season', seasonFilter);
    if (collectionFilter !== 'all') params.set('collection', collectionFilter);
    if (filedOnly) params.set('filed', '1');
    if (archiveView === 'constellation') params.set('view', 'constellation');
    const archiveHash = params.size > 0 || window.location.hash === '#archive' ? '#archive' : '';
    const nextUrl = `${window.location.pathname}${params.size ? `?${params}` : ''}${archiveHash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [query, statusFilter, seasonFilter, collectionFilter, filedOnly, archiveView]);

  useEffect(() => {
    const term = normalizeSearchTerm(query);
    if (term.length < 2) return;

    const timer = window.setTimeout(() => {
      trackProductEvent('archive_search', {
        term,
        resultCount: visibleEvents.length,
        statusFilter,
        seasonFilter,
        collectionFilter,
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [query, visibleEvents.length, statusFilter, seasonFilter, collectionFilter]);

  useEffect(() => {
    trackProductEvent('archive_filter_change', {
      statusFilter,
      seasonFilter,
      collectionFilter,
      archiveView,
      resultCount: visibleEvents.length,
    });
  }, [statusFilter, seasonFilter, collectionFilter, archiveView, visibleEvents.length]);

  return (
    <section className="poster-archive" id="archive">
      <div className="archive-section-title">
        <EditorialKicker en={siteText.archiveKickerEn} ko={siteText.archiveKickerKo} />
        <h2 className="ko-display"><span lang="ko">{siteText.archiveHeading}</span></h2>
        <EditorialPlate
          className="editorial-plate--archive"
          asset={editorialPlates.archive}
        />
      </div>
      <div className="archive-tools" aria-label="Archive search and filters">
        <div className="archive-view-switch" aria-label="아카이브 보기 방식">
          <button type="button" aria-pressed={archiveView === 'chronology'} className={archiveView === 'chronology' ? 'is-active' : ''} onClick={() => setArchiveView('chronology')}>
            <span lang="en">Chronology</span><small lang="ko">시간순</small>
          </button>
          <button type="button" aria-pressed={archiveView === 'constellation'} className={archiveView === 'constellation' ? 'is-active' : ''} onClick={() => setArchiveView('constellation')}>
            <span lang="en">Constellation</span><small lang="ko">관계 지도</small>
          </button>
          <a href="/catalogue/">
            <span lang="en">Catalogue</span><small lang="ko">자료 장부</small>
          </a>
        </div>
        <div className="archive-discovery">
          <label className="archive-search">
            <span className="archive-search-control">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="아카이브 검색"
              />
              {!query && <span className="archive-search-placeholder" lang="ko" aria-hidden="true">제목, 주제, 자료 검색</span>}
            </span>
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
                <span className="archive-filter-label" lang={filter === 'all' ? 'en' : 'ko'}>
                  {filter === 'all' ? 'All' : statusLabel(filter, siteText)}
                </span>
              </button>
            ))}
            <button
              type="button"
              className={filedOnly ? 'is-active' : ''}
              aria-pressed={filedOnly}
              onClick={() => setFiledOnly((current) => !current)}
            >
              <span className="archive-filter-label" lang="ko">북마크</span>
            </button>
          </div>
          <label className="archive-select">
            <span lang="ko">시즌</span>
            <select
              value={seasonFilter}
              onChange={(event) => setSeasonFilter(event.target.value)}
              aria-label="시즌으로 기록 필터링"
            >
              <option value="all">All seasons</option>
              {seasonOptions.map((season) => (
                <option value={season.id} key={season.id}>{season.label} / {season.title}</option>
              ))}
            </select>
          </label>
          <label className="archive-select">
            <span lang="ko">컬렉션</span>
            <select
              value={collectionFilter}
              onChange={(event) => setCollectionFilter(event.target.value)}
              aria-label="컬렉션으로 기록 필터링"
            >
              <option value="all">All collections</option>
              {collectionOptions.map((collection) => (
                <option value={collection.id} key={collection.id}>{collection.title}</option>
              ))}
            </select>
          </label>
          {(query || statusFilter !== 'all' || seasonFilter !== 'all' || collectionFilter !== 'all' || filedOnly) && (
            <p className="archive-results-count">
              <span lang="ko">기록 {visibleEvents.length}개</span>
            </p>
          )}
          {(query || statusFilter !== 'all' || seasonFilter !== 'all' || collectionFilter !== 'all' || filedOnly) && (
            <button
              className="archive-filter-reset"
              type="button"
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
                setSeasonFilter('all');
                setCollectionFilter('all');
                setFiledOnly(false);
              }}
            >
              <span lang="ko">필터 지우기</span>
            </button>
          )}
        </div>
      </div>
      {archiveView === 'chronology' ? (
        orderedVisibleEvents.length > 0 ? (
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
        ) : null
      ) : orderedVisibleEvents.length > 0 ? <ArchiveConstellation records={orderedVisibleEvents} references={references} /> : null}
      {orderedVisibleEvents.length === 0 && (
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
        asset={editorialPlates.manifesto}
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
          asset={editorialPlates.join}
        />
        <h2 className="ko-display"><span lang="ko">{siteText.joinHeading}</span></h2>
      </div>
      <a className="archive-cta inverse" href={siteText.joinCtaHref}>
        <span className="archive-cta-label" lang={textLang(siteText.joinCtaLabel)}>{siteText.joinCtaLabel}</span>
      </a>
    </section>
  );
}

function SiteFooter({ siteText }: { siteText: SiteText }) {
  return (
    <footer className="archive-footer">
      <span>{siteText.footerLeft}</span>
      <nav aria-label="Archive feeds and catalogue">
        <a href="/catalogue/">Catalogue</a>
        <a href="/feed.xml">Feed</a>
        <a href="/archive.json">Data</a>
        <a href="/catalogue/?kind=image">Image credits</a>
      </nav>
      <span lang="it">{siteText.footerRight}</span>
    </footer>
  );
}

export default function HomePage() {
  const [version, setVersion] = useState(0);
  const [siteText, setSiteText] = useState(() => getSiteText());
  const archiveEvents = useMemo(() => getPublicArchiveEvents(applyArchiveDrafts(events)), [version]);
  const references = useMemo(() => applyArchiveReferenceDrafts(archiveReferences), [version]);
  const currentEvent = archiveEvents.find((event) => event.status === 'current') ?? archiveEvents[0] ?? events[0];

  usePageMetadata({
    title: 'Jerboa Circle Official Archive',
    description: `${currentEvent.title}: ${currentEvent.shortDescription}`,
    canonicalPath: '/',
    image: currentEvent.posterImage,
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

        if (result.saved.data.references) {
          writeArchiveReferenceDrafts(result.saved.data.references);
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
    <div className="public-home archive-home">
      <a className="skip-to-archive" href="#archive"><span lang="ko">기록 목록으로 바로가기</span></a>
      <SiteHeader siteText={siteText} />
      <main>
        <Masthead featuredEvent={currentEvent} siteText={siteText} />
        <FeaturedEvent featuredEvent={currentEvent} siteText={siteText} />
        <PosterArchive archiveEvents={archiveEvents} references={references} siteText={siteText} />
        <ManifestoBlock siteText={siteText} />
        <JoinBlock siteText={siteText} />
      </main>
      <SiteFooter siteText={siteText} />
    </div>
  );
}
