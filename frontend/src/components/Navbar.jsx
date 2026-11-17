import { useAuth } from '../App.jsx';
import { NavLink, Link } from 'react-router-dom';
import {
  ShieldCheck,
  LayoutDashboard,
  ChartNoAxesCombined,
  Target,
  Settings,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';

export default function Navbar() {
  const { user, logout, theme, toggleTheme } = useAuth();
  const items = [
    ['/', 'Overview', LayoutDashboard],
    ['/budgets', 'Budgets', Target],
    ['/reports', 'Reports', ChartNoAxesCombined],
    ['/settings', 'Settings', Settings],
  ];
  return (
    <aside className={`sidebar ${user ? '' : 'guest-nav'}`}>
      <Link className="brand" to="/">
        <span className="brand-icon">
          <ShieldCheck size={24} />
        </span>
        <span>
          Finance Guard<small>PERSONAL FINANCE</small>
        </span>
      </Link>
      {user && (
        <>
          <p className="nav-label">WORKSPACE</p>
          <nav className="nav-links" aria-label="Main navigation">
            {items.map(([path, label, Icon]) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={19} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-note">
            <ShieldCheck size={22} />
            <strong>A clearer view of your money.</strong>
            <p>
              Small steps today.
              <br />
              More confidence tomorrow.
            </p>
          </div>
        </>
      )}
      <div className="sidebar-bottom">
        <button
          className="theme-switch btn-secondary"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span>
        </button>
        {user && (
          <button className="btn-icon mobile-logout" onClick={logout} aria-label="Log out">
            <LogOut size={18} />
          </button>
        )}
        {user && (
          <div className="user-block">
            <span className="avatar" aria-hidden="true">
              {user.email?.[0]?.toUpperCase()}
            </span>
            <div>
              <strong>Personal account</strong>
              <span className="user-email" title={user.email}>
                {user.email}
              </span>
            </div>
            <button className="btn-icon" onClick={logout} aria-label="Log out" title="Log out">
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
