import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Icon from './components/Icon.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Planner from './pages/Planner.jsx';
import Vehicles from './pages/Vehicles.jsx';
import Guide from './pages/Guide.jsx';
import { AuthProvider, useAuth, GoogleSignIn } from './auth/AuthContext.jsx';
import { api } from './services/api.js';

export default function App() {
  return (
    <AuthProvider>
      <Workspace />
    </AuthProvider>
  );
}
function Workspace() {
  const auth = useAuth();
  const [health, setHealth] = useState(null);
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);
  useEffect(() => {
    api('/health')
      .then(setHealth)
      .catch(() => setHealth({ status: 'offline' }));
  }, [location.pathname]);
  const section = location.pathname.startsWith('/plans')
    ? 'Load planner'
    : location.pathname === '/vehicles'
      ? 'Vehicles'
      : location.pathname === '/guide'
        ? 'Field guide'
        : 'Overview';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="DockPlan overview">
          <span className="brand-mark">
            <Icon name="cube" size={27} />
          </span>
          <span>
            dockplan<span className="brand-dot">.</span>
            <small>SPACE FOR A BETTER ROUTE</small>
          </span>
        </NavLink>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            <Icon name="grid" />
            Overview
          </NavLink>
          <NavLink
            to="/plans/demo"
            className={() =>
              location.pathname.startsWith('/plans') ? 'active' : ''
            }
          >
            <Icon name="layers" />
            Load planner<span className="nav-mini">3D</span>
          </NavLink>
          <NavLink to="/vehicles">
            <Icon name="truck" />
            Vehicles
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <Icon name="route" size={22} />
            </span>
            <strong>Every stop, considered.</strong>
            <p>Good loading makes the whole route feel lighter.</p>
            <NavLink to="/guide">
              Explore the field guide <Icon name="arrow" size={15} />
            </NavLink>
          </div>
          <NavLink className="guide-link" to="/guide">
            <Icon name="book" size={18} />
            How DockPlan works
          </NavLink>
          <div className="workspace-user">
            <span>DP</span>
            <div>
              {auth.user?.name ?? 'Guest workspace'}
              <small>
                {auth.user ? 'PRIVATE GOOGLE ACCOUNT' : 'TRY THE PUBLIC DEMO'}
              </small>
            </div>
            <Icon name="chevron" size={15} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <Icon name="chevron" size={13} />
            <strong>{section}</strong>
          </div>
          <div className="topbar-right">
            <span
              className={`storage-status ${health?.status === 'offline' ? 'offline' : ''}`}
            >
              <i />
              {health?.status === 'offline'
                ? 'API offline'
                : health?.storage === 'mongodb'
                  ? 'MongoDB connected'
                  : 'Local demo mode'}
            </span>
            <span className="topbar-divider" />
            {auth.user ? (
              <div className="account-controls">
                <span className="account-name">{auth.user.name}</span>
                <button
                  className="button secondary small"
                  onClick={auth.logout}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <GoogleSignIn compact />
            )}
          </div>
        </header>
        <main>
          {auth.error && (
            <div role="alert" className="error-banner account-error">
              {auth.error}
              <button
                onClick={auth.clearError}
                aria-label="Dismiss account error"
              >
                ×
              </button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Dashboard health={health} />} />
            <Route path="/plans/:id" element={<Planner health={health} />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/guide" element={<Guide />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>That route is off the map.</h1>
                  <NavLink className="button primary" to="/">
                    Back to overview
                  </NavLink>
                </div>
              }
            />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>Built for the space between pickup and delivery.</span>
          <span>
            DOCKPLAN <i /> 1.0
          </span>
        </footer>
      </div>
    </div>
  );
}
