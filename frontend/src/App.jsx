import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import Budgets from './pages/Budgets.jsx';
import Navbar from './components/Navbar.jsx';
import { api } from './api.js';
import { clearSession, SESSION_EXPIRED } from './utils/session.js';

export const AuthContext = createContext(null);
export function useAuth() {
  return useContext(AuthContext);
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [homeCurrency, setHomeCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [retry, setRetry] = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setHomeCurrency('USD');
    setSessionError('');
  }, []);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED, logout);
    return () => window.removeEventListener(SESSION_EXPIRED, logout);
  }, [logout]);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('token');
    setSessionError('');
    if (!token) {
      clearSession();
      setLoading(false);
      return;
    }
    setLoading(true);
    api.getMe().then((me) => {
      if (!active || localStorage.getItem('token') !== token) return;
      setUser(me);
      setHomeCurrency(me.home_currency);
      localStorage.setItem('user', JSON.stringify(me));
    }).catch((err) => {
      if (active && err.status !== 401 && localStorage.getItem('token') === token) {
        setSessionError('Could not check your session. Please try again.');
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  function login(userData, token) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setHomeCurrency(userData.home_currency || 'USD');
    setSessionError('');
  }

  if (loading) return <div className="container" role="status">Checking your session…</div>;
  if (sessionError) return (
    <div className="container">
      <p role="alert">{sessionError}</p>
      <button onClick={() => setRetry((value) => value + 1)}>Retry</button>
      <button onClick={logout}>Sign out</button>
    </div>
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, homeCurrency, setHomeCurrency, theme, toggleTheme }}>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/signup" element={user ? <Navigate to="/" /> : <Signup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/budgets"
            element={
              <ProtectedRoute>
                <Budgets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </AuthContext.Provider>
  );
}
