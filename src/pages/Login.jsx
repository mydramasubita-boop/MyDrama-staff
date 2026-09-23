import React, { useState } from 'react';
import { loginUser, getUserProfile, auth } from '../firebase.js';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResetMessage('');
    try {
      const cred = await loginUser(email, password);
      const profile = await getUserProfile(cred.user.uid);
      if (!profile) { setError("Profilo non trovato. Contatta l'admin."); setLoading(false); return; }
      if (profile.disabled) {
        setError('Questo account è stato disattivato. Contatta un admin.');
        setLoading(false);
        return;
      }
      onLogin(cred.user, profile);
    } catch (err) {
      setError('Credenziali non valide.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setError(''); setResetMessage('');
    if (!email) {
      setError('Scrivi la tua email nel campo sopra, poi clicca di nuovo su "Password dimenticata".');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage('Email di recupero inviata! Controlla la posta (anche lo spam).');
    } catch (err) {
      setError("Impossibile inviare l'email di recupero. Controlla che l'indirizzo sia corretto.");
    }
    setResetLoading(false);
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
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: '100%', paddingRight: 40, boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                title={showPassword ? 'Nascondi password' : 'Mostra password'}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1 }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div style={{ textAlign: 'right', marginBottom: 12, marginTop: -6 }}>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {resetLoading ? 'Invio in corso...' : 'Password dimenticata?'}
            </button>
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Accesso...' : 'ACCEDI'}
          </button>
          {error && <div className="error-msg">{error}</div>}
          {resetMessage && <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: '#3ecf6a' }}>{resetMessage}</div>}
        </form>
      </div>
    </div>
  );
}
