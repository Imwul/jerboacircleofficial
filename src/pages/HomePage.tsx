import { useEffect, useMemo, useState } from 'react';
import { events, type ArchiveEvent } from '../data/events';
import type { SiteText } from '../data/siteText';
import { applyArchiveDrafts } from '../utils/archiveDrafts';
import { loadServerSync } from '../utils/serverSync';
import { getSiteText, writeSiteTextDraft } from '../utils/siteTextDrafts';
import { writeArchiveDrafts, type ArchiveDraftMap } from '../utils/archiveDrafts';
import jerboaSeal from '../assets/identity/jerboa-seal.png';
import './HomePage.css';

interface ArchiveSyncPayload {
  drafts?: ArchiveDraftMap;
  siteText?: Partial<SiteText>;
}

function SiteHeader({ siteText }: { siteText: SiteText }) {
  return (
    <header className="archive-header" aria-label="Jerboa Circle navigation">
      <a className="archive-wordmark" href="./" aria-label="Jerboa Circle archive home">
        <span>Jerboa</span>
        <span>Circle</span>
        <small lang="ko">{siteText.wordmarkSmall}</small>
      </a>
      <nav className="archive-nav" aria-label="Primary navigation">
        <a href="#featured"><span lang="en">{siteText.navFeaturedEn}</span><small lang="ko">{siteText.navFeaturedKo}</small></a>
        <a href="#archive"><span lang="en">{siteText.navArchiveEn}</span><small lang="ko">{siteText.navArchiveKo}</small></a>
        <a href="#manifesto"><span lang="en">{siteText.navManifestoEn}</span><small lang="ko">{siteText.navManifestoKo}</small></a>
        <a href="#join"><span lang="en">{siteText.navJoinEn}</span><small lang="ko">{siteText.navJoinKo}</small></a>
        <a href="./members/"><span lang="en">{siteText.navMembersEn}</span><small lang="ko">{siteText.navMembersKo}</small></a>
      </nav>
    </header>
  );
}

function Masthead({ featuredEvent, siteText }: { featuredEvent: ArchiveEvent; siteText: SiteText }) {
  return (
    <section className="publication-masthead" aria-label="Jerboa Circle publication identity">
      <div className="masthead-mark">
        <img className="masthead-logo" src={jerboaSeal} alt="" aria-hidden="true" />
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
        <dt>{siteText.metaEdition}</dt>
        <dd>{event.edition}</dd>
      </div>
      <div>
        <dt>{siteText.metaDate}</dt>
        <dd>{event.date}</dd>
      </div>
      <div>
        <dt>{siteText.metaStatus}</dt>
        <dd>{statusLabel(event.status, siteText)}</dd>
      </div>
      <div>
        <dt>{siteText.metaFormat}</dt>
        <dd>{event.location}</dd>
      </div>
    </dl>
  );
}

function TextIndex({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="text-index">
      <span>{title}</span>
      <ol>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </div>
  );
}

function ThemeList({ themes }: { themes: string[] }) {
  return (
    <ul className="theme-tags" aria-label="Themes">
      {themes.map((theme) => (
        <li key={theme}>{theme}</li>
      ))}
    </ul>
  );
}

function FeaturedEvent({ featuredEvent, siteText }: { featuredEvent: ArchiveEvent; siteText: SiteText }) {
  return (
    <section className="featured-event section-reveal" id="featured">
      <div className="featured-poster-wrap">
        <img src={featuredEvent.posterImage} alt={`${featuredEvent.title} poster`} />
      </div>
      <div className="featured-copy">
        <p className="section-kicker"><span lang="en">{siteText.featuredKickerEn}</span> / <span lang="ko">{siteText.featuredKickerKo}</span></p>
        <h1>{featuredEvent.title}</h1>
        <p className="korean-annotation" lang="ko">
          {siteText.featuredAnnotation}
        </p>
        <p className="event-subtitle">{featuredEvent.subtitle}</p>
        <p className="latin-line">{featuredEvent.latinQuote}</p>
        <p className="marginal-note" lang="ko">{featuredEvent.marginalia}</p>
        <p className="event-description" lang="ko">{featuredEvent.shortDescription}</p>
        <div className="constellation-grid" aria-label="Programme constellation">
          <TextIndex title={siteText.journeyLabel} items={featuredEvent.passage} />
          <TextIndex title={siteText.materialsLabel} items={featuredEvent.materials} />
        </div>
        <EventMeta event={featuredEvent} siteText={siteText} />
        <ThemeList themes={featuredEvent.themes} />
        <a className="archive-cta" href={featuredEvent.ctaHref}>
          {featuredEvent.ctaLabel}
        </a>
      </div>
    </section>
  );
}

function PosterTile({ event }: { event: ArchiveEvent }) {
  return (
    <article className="poster-tile section-reveal">
      <a href={event.ctaHref} aria-label={`Open archive record for ${event.title}`}>
        <div className="poster-frame">
          <img src={event.posterImage} alt={`${event.title} poster`} />
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
  return (
    <section className="poster-archive" id="archive">
      <div className="archive-section-title">
        <p className="section-kicker"><span lang="en">{siteText.archiveKickerEn}</span> / <span lang="ko">{siteText.archiveKickerKo}</span></p>
        <h2 lang="ko">{siteText.archiveHeading}</h2>
      </div>
      <div className="archive-ledger" aria-label="Programme index">
        {archiveEvents.map((event) => (
          <a href={event.ctaHref} key={event.id}>
            <span>{event.edition}</span>
            <strong>{event.title}</strong>
            <em>{event.date}</em>
            <small lang="ko">{event.marginalia}</small>
          </a>
        ))}
      </div>
      <div className="poster-grid">
        {archiveEvents.map((event) => (
          <PosterTile event={event} key={event.id} />
        ))}
      </div>
    </section>
  );
}

function ManifestoBlock({ siteText }: { siteText: SiteText }) {
  return (
    <section className="manifesto-block section-reveal" id="manifesto">
      <p className="section-kicker"><span lang="en">{siteText.manifestoKickerEn}</span> / <span lang="ko">{siteText.manifestoKickerKo}</span></p>
      <p lang="ko">{siteText.manifestoBody}</p>
    </section>
  );
}

function JoinBlock({ siteText }: { siteText: SiteText }) {
  return (
    <section className="join-block section-reveal" id="join">
      <div>
        <p className="section-kicker"><span lang="en">{siteText.joinKickerEn}</span> / <span lang="ko">{siteText.joinKickerKo}</span></p>
        <h2 lang="ko">{siteText.joinHeading}</h2>
      </div>
      <a className="archive-cta inverse" href={siteText.joinCtaHref}>
        {siteText.joinCtaLabel}
      </a>
    </section>
  );
}

function SiteFooter({ siteText }: { siteText: SiteText }) {
  return (
    <footer className="archive-footer">
      <span>{siteText.footerLeft}</span>
      <span lang="ko">{siteText.footerRight}</span>
    </footer>
  );
}

export default function HomePage() {
  const [version, setVersion] = useState(0);
  const [siteText, setSiteText] = useState(() => getSiteText());
  const archiveEvents = useMemo(() => applyArchiveDrafts(events), [version]);
  const currentEvent = archiveEvents.find((event) => event.status === 'current') ?? archiveEvents[0];

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

  return (
    <div className="public-home">
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
