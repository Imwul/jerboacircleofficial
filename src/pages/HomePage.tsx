import { events, type ArchiveEvent } from '../data/events';
import { applyArchiveDrafts } from '../utils/archiveDrafts';
import './HomePage.css';

function SiteHeader() {
  return (
    <header className="archive-header" aria-label="Jerboa Circle navigation">
      <a className="archive-wordmark" href="./" aria-label="Jerboa Circle archive home">
        <span>Jerboa</span>
        <span>Circle</span>
        <small lang="ko">공식 포스터 보관소</small>
      </a>
      <nav className="archive-nav" aria-label="Primary navigation">
        <a href="#featured">현재</a>
        <a href="#archive">기록벽</a>
        <a href="#manifesto">선언문</a>
        <a href="#join">초대</a>
        <a href="./members/">회원실</a>
      </nav>
    </header>
  );
}

function Masthead({ featuredEvent }: { featuredEvent: ArchiveEvent }) {
  return (
    <section className="publication-masthead" aria-label="Jerboa Circle publication identity">
      <div className="masthead-mark">
        <span>Jerboa</span>
        <span>Circle</span>
      </div>
      <div className="masthead-index">
        <p lang="ko">문학 / 상징 / 신화 / 철학 / 실험 문화</p>
        <p>Independent reading society / programme archive / poster register</p>
      </div>
      <p className="masthead-latin">{featuredEvent.latinQuote}</p>
    </section>
  );
}

function EventMeta({ event }: { event: ArchiveEvent }) {
  return (
    <dl className="event-meta" aria-label={`${event.title} metadata`}>
      <div>
        <dt>판본</dt>
        <dd>{event.edition}</dd>
      </div>
      <div>
        <dt>일자</dt>
        <dd>{event.date}</dd>
      </div>
      <div>
        <dt>상태</dt>
        <dd>{event.status}</dd>
      </div>
      <div>
        <dt>형식</dt>
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

function FeaturedEvent({ featuredEvent }: { featuredEvent: ArchiveEvent }) {
  return (
    <section className="featured-event section-reveal" id="featured">
      <div className="featured-poster-wrap">
        <img src={featuredEvent.posterImage} alt={`${featuredEvent.title} poster`} />
      </div>
      <div className="featured-copy">
        <p className="section-kicker">{featuredEvent.edition} / 현재 걸린 포스터</p>
        <h1>{featuredEvent.title}</h1>
        <p className="korean-annotation" lang="ko">
          불씨의 여섯 장 / 성배 / 숲 / 성물 / 장미 / 불 / 별을 따라 읽는 비밀 프로그램
        </p>
        <p className="event-subtitle">{featuredEvent.subtitle}</p>
        <p className="latin-line">{featuredEvent.latinQuote}</p>
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
          <p>{event.shortDescription}</p>
          <ThemeList themes={event.themes} />
        </div>
      </a>
    </article>
  );
}

function PosterArchive({ archiveEvents }: { archiveEvents: ArchiveEvent[] }) {
  return (
    <section className="poster-archive" id="archive">
      <div className="archive-section-title">
        <p className="section-kicker">Programme archive / poster wall</p>
        <h2 lang="ko">낭독 / 연구 / 모임 / 사적인 기록의 벽</h2>
      </div>
      <div className="archive-ledger" aria-label="Programme index">
        {archiveEvents.map((event) => (
          <a href={event.ctaHref} key={event.id}>
            <span>{event.edition}</span>
            <strong>{event.title}</strong>
            <em>{event.date}</em>
            <small>{event.subtitle}</small>
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

function ManifestoBlock() {
  return (
    <section className="manifesto-block section-reveal" id="manifesto">
      <p className="section-kicker">선언문 / manifesto</p>
      <p lang="ko">
        저보아 서클은 낭독 / 파편 / 이미지 / 연구와 모임을 한 장의 포스터로 보관한다
        포스터는 문 / 문은 기록 / 기록은 잊힘에 맞서는 조용한 불씨
      </p>
    </section>
  );
}

function JoinBlock() {
  return (
    <section className="join-block section-reveal" id="join">
      <div>
        <p className="section-kicker">초대와 연락 / contact</p>
        <h2 lang="ko">초대 / 기록 열람 / 다음 프로그램에 관한 서신을 받습니다</h2>
      </div>
      <a className="archive-cta inverse" href="mailto:hello@jerboacircle.com">
        서신 보내기
      </a>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="archive-footer">
      <span>Jerboa Circle Official Archive</span>
      <span lang="ko">검정 / 양피지 / 산화된 붉은빛 / 재색</span>
    </footer>
  );
}

export default function HomePage() {
  const archiveEvents = applyArchiveDrafts(events);
  const currentEvent = archiveEvents.find((event) => event.status === 'current') ?? archiveEvents[0];

  return (
    <div className="public-home">
      <SiteHeader />
      <main>
        <Masthead featuredEvent={currentEvent} />
        <FeaturedEvent featuredEvent={currentEvent} />
        <PosterArchive archiveEvents={archiveEvents} />
        <ManifestoBlock />
        <JoinBlock />
      </main>
      <SiteFooter />
    </div>
  );
}
