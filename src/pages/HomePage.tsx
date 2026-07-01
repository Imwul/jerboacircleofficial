import { events, type ArchiveEvent } from '../data/events';
import { applyArchiveDrafts } from '../utils/archiveDrafts';
import jerboaSeal from '../assets/identity/jerboa-seal.png';
import './HomePage.css';

function SiteHeader() {
  return (
    <header className="archive-header" aria-label="Jerboa Circle navigation">
      <a className="archive-wordmark" href="./" aria-label="Jerboa Circle archive home">
        <span>Jerboa</span>
        <span>Circle</span>
        <small lang="ko">여정과 기억의 장부</small>
      </a>
      <nav className="archive-nav" aria-label="Primary navigation">
        <a href="#featured"><span lang="en">Threshold</span><small lang="ko">지금 열려 있는 프로그램</small></a>
        <a href="#archive"><span lang="en">Memory</span><small lang="ko">지난 프로그램 아카이브</small></a>
        <a href="#manifesto"><span lang="en">Fragments</span><small lang="ko">저보아 서클 소개</small></a>
        <a href="#join"><span lang="en">Letter</span><small lang="ko">참여와 문의</small></a>
        <a href="./members/"><span lang="en">Private</span><small lang="ko">회원 전용 장부</small></a>
      </nav>
    </header>
  );
}

function Masthead({ featuredEvent }: { featuredEvent: ArchiveEvent }) {
  return (
    <section className="publication-masthead" aria-label="Jerboa Circle publication identity">
      <div className="masthead-mark">
        <img className="masthead-logo" src={jerboaSeal} alt="" aria-hidden="true" />
        <svg className="masthead-ring" viewBox="0 0 600 600" aria-hidden="true">
          <defs>
            <path
              id="jerboaSealRingPath"
              d="M300,300 m-247,0 a247,247 0 1,1 494,0 a247,247 0 1,1 -494,0"
            />
          </defs>
          <text>
            <textPath href="#jerboaSealRingPath" startOffset="2%">
              Jerboa Circle / Public archive / Programme memory / Slow reading / Symbolic passage /
            </textPath>
          </text>
        </svg>
        <div className="masthead-seal-caption">
          <span lang="en">Jerboa Circle</span>
          <small lang="ko">공개 기록벽</small>
        </div>
      </div>
      <div className="masthead-index">
        <p lang="en">A field of signs, entered slowly</p>
        <p lang="ko">책, 이미지, 신화, 철학, 종교, 예술을 엮어 하나의 프로그램으로 만드는 연구 모임입니다.</p>
        <ol className="masthead-ritual">
          <li>Beginning</li>
          <li>Passage</li>
          <li>Transformation</li>
          <li>Return</li>
        </ol>
      </div>
      <p className="masthead-latin">{featuredEvent.latinQuote}</p>
    </section>
  );
}

function statusLabel(status: ArchiveEvent['status']) {
  if (status === 'current') return '열려 있음';
  if (status === 'upcoming') return '예고됨';
  return '보존됨';
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
        <dd>{statusLabel(event.status)}</dd>
      </div>
      <div>
        <dt>형식</dt>
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

function FeaturedEvent({ featuredEvent }: { featuredEvent: ArchiveEvent }) {
  return (
    <section className="featured-event section-reveal" id="featured">
      <div className="featured-poster-wrap">
        <img src={featuredEvent.posterImage} alt={`${featuredEvent.title} poster`} />
      </div>
      <div className="featured-copy">
        <p className="section-kicker"><span lang="en">The open threshold</span> / <span lang="ko">현재 진행 중인 프로그램</span></p>
        <h1>{featuredEvent.title}</h1>
        <p className="korean-annotation" lang="ko">
          하나의 강의가 아니라 성배 / 숲 / 성물 / 장미 / 불 / 별을 지나는 느린 통과 의례
        </p>
        <p className="event-subtitle">{featuredEvent.subtitle}</p>
        <p className="latin-line">{featuredEvent.latinQuote}</p>
        <p className="marginal-note" lang="ko">{featuredEvent.marginalia}</p>
        <p className="event-description" lang="ko">{featuredEvent.shortDescription}</p>
        <div className="constellation-grid" aria-label="Programme constellation">
          <TextIndex title="여정" items={featuredEvent.passage} />
          <TextIndex title="자료" items={featuredEvent.materials} />
        </div>
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
          <p lang="ko">{event.shortDescription}</p>
          <em lang="ko">{event.marginalia}</em>
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
        <p className="section-kicker"><span lang="en">The visible memory</span> / <span lang="ko">지난 프로그램 기록</span></p>
        <h2 lang="ko">이곳은 지나간 행사 목록이 아니라, 프로그램이 쌓여 가는 공개 아카이브입니다</h2>
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

function ManifestoBlock() {
  return (
    <section className="manifesto-block section-reveal" id="manifesto">
      <p className="section-kicker"><span lang="en">Fragments toward a method</span> / <span lang="ko">저보아 서클 소개</span></p>
      <p lang="ko">
        저보아 서클의 프로그램은 교육 과정이 아니라 임시 별자리입니다
        책과 이미지와 사물과 장소가 잠시 한 방향을 가리키고
        참여자는 그 사이를 통과한 뒤 조금 다른 눈으로 돌아옵니다
      </p>
    </section>
  );
}

function JoinBlock() {
  return (
    <section className="join-block section-reveal" id="join">
      <div>
        <p className="section-kicker"><span lang="en">Correspondence</span> / <span lang="ko">문의와 초대</span></p>
        <h2 lang="ko">다음 프로그램, 참여, 기록 열람에 관한 문의를 받습니다</h2>
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
      <span lang="ko">시간은 삭제되지 않고 판본으로 남습니다</span>
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
