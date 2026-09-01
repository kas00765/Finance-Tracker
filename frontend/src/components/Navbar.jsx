import { useAuth } from '../App.jsx';
import { useNavigate, NavLink } from 'react-router-dom';

export default function Navbar() {
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <div className="row">
        <strong className="brand">💰 Finance Tracker</strong>
        {user && (
          <div className="nav-links">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Dashboard
            </NavLink>
            <NavLink to="/reports" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Reports
            </NavLink>
            <NavLink to="/budgets" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Budgets
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Settings
            </NavLink>
          </div>
        )}
      </div>
      <div className="row">
        <button
          onClick={toggleTheme}
          className="btn-icon"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark/light mode"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {user && (
          <>
            <span className="user-email">{user.email}</span>
            <button onClick={handleLogout} className="btn-secondary">Log out</button>
          </>
        )}
      </div>
    </nav>
  );
}
