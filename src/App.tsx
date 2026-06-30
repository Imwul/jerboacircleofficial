import HomePage from './pages/HomePage';
import MembersApp from './MembersApp';
import ArchiveDetailPage from './pages/ArchiveDetailPage';

function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  const isMembersRoute = path.endsWith('/members');
  const archiveMatch = path.match(/\/archive\/([^/]+)$/);

  if (isMembersRoute) return <MembersApp />;
  if (archiveMatch) return <ArchiveDetailPage id={archiveMatch[1]} />;
  return <HomePage />;
}

export default App;
