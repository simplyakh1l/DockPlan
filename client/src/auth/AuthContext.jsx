import { createContext, useContext, useEffect, useState } from 'react';
import { api, post, setCsrfToken } from '../services/api.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    loading: true,
    configured: false,
    user: null,
  });
  const [error, setError] = useState('');
  useEffect(() => {
    api('/auth/session')
      .then((session) => {
        setCsrfToken(session.csrfToken);
        setAuth({ ...session, loading: false });
      })
      .catch(() => {
        setAuth({ loading: false, configured: false, user: null });
        setError('Account service unavailable. Please refresh to reconnect.');
      });
    if (new URLSearchParams(window.location.search).has('authError')) {
      setError(
        'Google sign-in did not complete. Try again; if this continues, check the OAuth configuration.',
      );
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);
  async function logout() {
    try {
      await post('/auth/logout', {});
      setCsrfToken(null);
      setAuth((current) => ({ ...current, user: null }));
      window.location.assign('/');
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <AuthContext.Provider
      value={{ ...auth, error, logout, clearError: () => setError('') }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export function GoogleSignIn({ compact = false }) {
  const auth = useAuth();
  if (auth.loading)
    return (
      <span className="account-hint" role="status">
        Checking account…
      </span>
    );
  if (!auth.configured)
    return (
      <span className="account-hint">
        Google sign-in awaits setup.{' '}
        <a
          href="https://github.com/simplyakh1l/DockPlan/blob/main/docs/DEPLOYMENT.md"
          target="_blank"
          rel="noreferrer"
        >
          Setup guide
        </a>
      </span>
    );
  return (
    <a
      className={'button secondary ' + (compact ? 'small' : '')}
      href={
        '/api/auth/google?returnTo=' +
        encodeURIComponent(window.location.pathname)
      }
    >
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c2-1.8 2.9-4.3 2.9-7.4Z"
        />
        <path
          fill="currentColor"
          d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22Zm-5.6-8a6 6 0 0 1 0-4V7.4H3a10 10 0 0 0 0 9.2L6.4 14ZM12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.4L6.4 10C7.2 7.7 9.4 5.9 12 5.9Z"
        />
      </svg>
      Sign in with Google
    </a>
  );
}
export function AccountNotice() {
  const { user, loading } = useAuth();
  if (user || loading) return null;
  return (
    <div className="account-notice">
      <div>
        <strong>A workspace of your own.</strong>
        <p>
          Try every planning tool freely. Sign in to save private load plans and
          vehicles.
        </p>
      </div>
      <GoogleSignIn />
    </div>
  );
}
