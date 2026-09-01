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
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  const refreshProfile = useCallback(async () => {
    try {
      const me = await api.getMe();
      setHomeCurrency(me.home_currency);
    } catch {
      // not logged in yet, or request failed — dashboard/settings will surface real errors
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setUser(JSON.parse(stored));
      refreshProfile();
    }
    setLoading(false);
  }, [refreshProfile]);

  function login(userData, token) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    refreshProfile();
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  if (loading) return null;

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
