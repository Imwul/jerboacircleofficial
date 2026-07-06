import HomePage from './pages/HomePage';
import MembersApp from './MembersApp';
import ArchiveDetailPage from './pages/ArchiveDetailPage';
import KeeperPage from './pages/KeeperPage';

function NotFoundPage() {
  return (
    <div className="public-home detail-home">
      <header className="archive-header" aria-label="Jerboa Circle navigation">
        <a className="archive-wordmark" href="/" aria-label="Jerboa Circle archive home">
          <span>Jerboa</span>
          <span>Circle</span>
          <small lang="la">Ad quaerendum.</small>
        </a>
        <nav className="archive-nav" aria-label="Not found navigation">
          <a className="archive-nav-memory" href="/#archive">
            <span className="nav-en" lang="en">Memory</span>
            <small lang="ko">기록벽으로 돌아가기</small>
          </a>
          <a className="archive-private-door" href="/members/">
            <span className="nav-en" lang="en">Scriptorium</span>
            <small lang="ko">비공개 장부</small>
          </a>
        </nav>
      </header>
      <main className="detail-record missing-record" aria-labelledby="not-found-title">
        <section className="detail-copy">
          <p className="section-kicker">
            <span className="kicker-en" lang="en">Unwritten route</span>
            <span className="kicker-divider" aria-hidden="true"> / </span>
            <span className="kicker-ko" lang="ko">없는 길</span>
          </p>
          <h1 id="not-found-title" lang="ko">이 주소에는 아직 열린 기록이 없습니다.</h1>
          <p className="event-description" lang="ko">
            기록벽에서 프로그램을 다시 찾거나, 비공개 장부로 돌아가 주세요.
          </p>
          <a className="archive-cta" href="/#archive" lang="ko">기록벽으로 돌아가기</a>
        </section>
      </main>
    </div>
  );
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  const isHomeRoute = path === '';
  const isArchiveIndexRoute = path === '/archive';
  const isMembersRoute = path === '/members';
  const isKeeperRoute = path === '/keeper';
  const isGodmodeRoute = path === '/godmode';
  const archiveMatch = path.match(/\/archive\/([^/]+)$/);

  if (isHomeRoute || isArchiveIndexRoute) return <HomePage />;
  if (isMembersRoute) return <MembersApp />;
  if (isKeeperRoute || isGodmodeRoute) return <KeeperPage />;
  if (archiveMatch) return <ArchiveDetailPage id={archiveMatch[1]} />;
  return <NotFoundPage />;
}

export default App;
