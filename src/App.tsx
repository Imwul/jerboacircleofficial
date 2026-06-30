import HomePage from './pages/HomePage';
import MembersApp from './MembersApp';

function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  const isMembersRoute = path.endsWith('/members');

  return isMembersRoute ? <MembersApp /> : <HomePage />;
}

export default App;
