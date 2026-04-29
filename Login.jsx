import React, { useState } from 'react';
import { loginUser, getUserProfile } from '../firebase.js';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const cred = await loginUser(email, password);
      const profile = await getUserProfile(cred.user.uid);
      if (!profile) { setError('Profilo non trovato. Contatta l\'admin.'); setLoading(false); return; }
      onLogin(cred.user, profile);
    } catch (err) {
      setError('Credenziali non valide.');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">MyDrama <span>Staff</span></div>
        <div className="login-sub">Area riservata al team</div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tuaemail@esempio.it" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Accesso...' : 'ACCEDI'}
          </button>
          {error && <div className="error-msg">{error}</div>}
        </form>
      </div>
    </div>
  );
}
