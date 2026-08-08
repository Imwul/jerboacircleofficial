import { lazy, Suspense, type ReactNode } from 'react';
import HomePage from './pages/HomePage';
import ArchiveDetailPage from './pages/ArchiveDetailPage';
import { usePageMetadata } from './utils/pageMetadata';
import EditorialHeader from './components/editorial/EditorialHeader';
import './JerboaCondoRefine.css';

const MembersApp = lazy(() => import('./MembersApp'));
const KeeperPage = lazy(() => import('./pages/KeeperPage'));
const CataloguePage = lazy(() => import('./pages/CataloguePage'));

function DeferredRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<span className="sr-only" role="status">페이지를 여는 중</span>}>
      {children}
    </Suspense>
  );
}

function NotFoundPage() {
  usePageMetadata({
    title: '없는 길 | Jerboa Circle',
    description: '이 주소에는 아직 열린 Jerboa Circle 기록이 없습니다.',
    noIndex: true,
  });

  return (
    <div className="public-home detail-home editorial-v3">
      <EditorialHeader note="A folio not yet found." />
      <main className="detail-record missing-record" aria-labelledby="not-found-title">
        <section className="detail-copy">
          <p className="section-kicker">
            <span className="kicker-en" lang="en">Unwritten route</span>
            <span className="kicker-divider" aria-hidden="true"> / </span>
            <span className="kicker-ko" lang="ko">없는 길</span>
          </p>
          <h1 id="not-found-title" lang="ko">이 주소에는 아직 열린 기록이 없습니다.</h1>
          <p className="event-description" lang="ko">
            공개 기록벽에서 판본을 다시 찾거나, 참여자 장부로 돌아가 주세요.
          </p>
          <a className="archive-cta" href="/#archive"><span className="archive-cta-label" lang="ko">공개 기록벽으로</span></a>
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
  const catalogueMatch = path.match(/\/catalogue\/([^/]+)$/);

  if (isHomeRoute || isArchiveIndexRoute) return <HomePage />;
  if (isMembersRoute) return <DeferredRoute><MembersApp /></DeferredRoute>;
  if (isKeeperRoute || isGodmodeRoute) return <DeferredRoute><KeeperPage /></DeferredRoute>;
  if (path === '/catalogue') return <DeferredRoute><CataloguePage /></DeferredRoute>;
  if (catalogueMatch) return <DeferredRoute><CataloguePage id={catalogueMatch[1]} /></DeferredRoute>;
  if (archiveMatch) return <ArchiveDetailPage id={archiveMatch[1]} />;
  return <NotFoundPage />;
}

export default App;
