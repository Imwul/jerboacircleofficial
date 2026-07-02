import HomePage from './pages/HomePage';
import MembersApp from './MembersApp';
import ArchiveDetailPage from './pages/ArchiveDetailPage';
import KeeperPage from './pages/KeeperPage';

function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  const isMembersRoute = path.endsWith('/members');
  const isKeeperRoute = path.endsWith('/keeper');
  const isGodmodeRoute = path.endsWith('/godmode');
  const archiveMatch = path.match(/\/archive\/([^/]+)$/);

  if (isMembersRoute) return <MembersApp />;
  if (isKeeperRoute || isGodmodeRoute) return <KeeperPage />;
  if (archiveMatch) return <ArchiveDetailPage id={archiveMatch[1]} />;
  return <HomePage />;
}

export default App;
