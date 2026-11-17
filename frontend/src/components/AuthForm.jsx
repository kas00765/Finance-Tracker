import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { ErrorNotice } from './Feedback.jsx';

export default function AuthForm({ signup = false }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await (signup
        ? api.signup(email.trim(), password)
        : api.login(email.trim(), password));
      login(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="card auth-card">
      <p className="eyebrow">WELCOME TO FINANCE GUARD</p>
      <h1>{signup ? 'Start your next chapter.' : 'Welcome back.'}</h1>
      <p className="muted">
        {signup
          ? 'Build a clearer picture of your money, one transaction at a time.'
          : 'Your finances, all in one place. Pick up where you left off.'}
      </p>
      <form onSubmit={submit}>
        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            minLength={signup ? 6 : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            aria-describedby={signup ? 'password-help' : undefined}
          />
        </label>
        {signup && (
          <small id="password-help" className="muted">
            Use at least 6 characters (up to 72 UTF-8 bytes).
          </small>
        )}
        <ErrorNotice message={error} />
        <button disabled={busy}>
          {busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}
        </button>
      </form>
      <p>
        {signup ? 'Already have an account?' : 'New here?'}{' '}
        <Link to={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Create an account'}</Link>
      </p>
    </section>
  );
}
