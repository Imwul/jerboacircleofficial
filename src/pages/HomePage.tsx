import { events, featuredEvent, type ArchiveEvent } from '../data/events';
import './HomePage.css';

function SiteHeader() {
  return (
    <header className="archive-header" aria-label="Jerboa Circle navigation">
      <a className="archive-wordmark" href="./" aria-label="Jerboa Circle archive home">
        <span>Jerboa</span>
        <span>Circle</span>
      </a>
      <nav className="archive-nav" aria-label="Primary navigation">
        <a href="#featured">Current</a>
        <a href="#archive">Archive</a>
        <a href="#manifesto">Manifesto</a>
        <a href="#join">Join</a>
        <a href="./members/">Members</a>
      </nav>
    </header>
  );
}

function EventMeta({ event }: { event: ArchiveEvent }) {
  return (
    <dl className="event-meta" aria-label={`${event.title} metadata`}>
      <div>
        <dt>Date</dt>
        <dd>{event.date}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{event.status}</dd>
      </div>
      <div>
        <dt>Format</dt>
        <dd>{event.location}</dd>
      </div>
    </dl>
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

function FeaturedEvent() {
  return (
    <section className="featured-event section-reveal" id="featured">
      <div className="featured-poster-wrap">
        <img src={featuredEvent.posterImage} alt={`${featuredEvent.title} poster`} />
      </div>
      <div className="featured-copy">
        <p className="section-kicker">Featured current event</p>
        <h1>{featuredEvent.title}</h1>
        <p className="event-subtitle">{featuredEvent.subtitle}</p>
        <p className="event-description">{featuredEvent.shortDescription}</p>
        <EventMeta event={featuredEvent} />
        <ThemeList themes={featuredEvent.themes} />
        <a className="archive-cta" href={featuredEvent.ctaHref}>
          {featuredEvent.ctaLabel}
        </a>
      </div>
    </section>
  );
}

function PosterTile({ event, index }: { event: ArchiveEvent; index: number }) {
  return (
    <article className="poster-tile section-reveal">
      <a href={event.ctaHref} aria-label={`Open archive record for ${event.title}`}>
        <div className="poster-frame">
          <img src={event.posterImage} alt={`${event.title} poster`} />
        </div>
        <div className="poster-caption">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <h2>{event.title}</h2>
          <p>{event.shortDescription}</p>
          <ThemeList themes={event.themes} />
        </div>
      </a>
    </article>
  );
}

function PosterArchive() {
  return (
    <section className="poster-archive" id="archive">
      <div className="archive-section-title">
        <p className="section-kicker">Poster archive</p>
        <h2>Programs, readings, studies, and private records.</h2>
      </div>
      <div className="poster-grid">
        {events.map((event, index) => (
          <PosterTile event={event} index={index} key={event.id} />
        ))}
      </div>
    </section>
  );
}

function ManifestoBlock() {
  return (
    <section className="manifesto-block section-reveal" id="manifesto">
      <p className="section-kicker">Manifesto</p>
      <p>
        Jerboa Circle keeps a wall of signs: readings, fragments, gatherings,
        images, and studies. Each poster is a door, each door a record, each
        record a small resistance to forgetting.
      </p>
    </section>
  );
}

function JoinBlock() {
  return (
    <section className="join-block section-reveal" id="join">
      <div>
        <p className="section-kicker">Contact</p>
        <h2>For invitations, records, and future programs.</h2>
      </div>
      <a className="archive-cta inverse" href="mailto:hello@jerboacircle.com">
        Write to Jerboa Circle
      </a>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="archive-footer">
      <span>Jerboa Circle Official Archive</span>
      <span>Black / parchment / oxblood / ash</span>
    </footer>
  );
}

export default function HomePage() {
  return (
    <div className="public-home">
      <SiteHeader />
      <main>
        <FeaturedEvent />
        <PosterArchive />
        <ManifestoBlock />
        <JoinBlock />
      </main>
      <SiteFooter />
    </div>
  );
}
