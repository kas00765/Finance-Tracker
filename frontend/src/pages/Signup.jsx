import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api.signup(email, password);
      login(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card auth-card">
      <h2>Sign up</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            type="password" placeholder="Password (min 6 chars)" value={password}
            onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%' }}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit">Create account</button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
