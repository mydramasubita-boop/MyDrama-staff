import React, { useState, useEffect } from 'react';
import { logoutUser, getSeries, getEpisodes } from '../firebase.js';
import { auth } from '../firebase.js';

export default function StaffDashboard({ profile, onOpenEpisode }) {
  const [series, setSeries] = useState([]);
  const [expandedSeries, setExpandedSeries] = useState({});
  const [episodes, setEpisodes] = useState({});

  useEffect(() => {
    const unsub = getSeries(all => {
      const mine = all.filter(s => (s.team || []).includes(auth.currentUser?.uid));
      setSeries(mine);
    });
    return unsub;
  }, []);

  const toggleExpand = (id) => {
    setExpandedSeries(p => ({ ...p, [id]: !p[id] }));
    if (!episodes[id]) {
      getEpisodes(id, eps => setEpisodes(p => ({ ...p, [id]: eps })));
    }
  };

  const statusLabel = (s) => ({ pending: 'In attesa', in_progress: 'In corso', translation_done: 'Da checkare', check_done: 'Pronto' })[s] || s;

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-logo">MyDrama <span>Staff</span></div>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{profile.name}</div>
          <div className="sidebar-user-role">Staff</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item active">📁 I miei progetti</div>
        </nav>
        <button className="sidebar-logout" onClick={logoutUser}>Esci</button>
      </div>
      <div className="main-content">
        <div className="page-header">
          <div className="page-title">I miei progetti</div>
          <div className="page-subtitle">{series.length} serie assegnate</div>
        </div>
        {series.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text2)' }}>Nessun progetto assegnato.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {series.map(s => (
              <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => toggleExpand(s.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{s.type === 'film' ? '🎬 Film' : '📺 Serie'}</div>
                  </div>
                  <span style={{ color: 'var(--text2)', fontSize: 18 }}>{expandedSeries[s.id] ? '▲' : '▼'}</span>
                </div>
                {expandedSeries[s.id] && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(episodes[s.id] || []).map(ep => (
                      <div key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer' }}
                        onClick={() => onOpenEpisode(ep, s)}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>Ep. {ep.number} — {ep.title}</div>
                        </div>
                        <span className={`project-status status-${ep.status}`}>{statusLabel(ep.status)}</span>
                        <button className="btn btn-sm btn-grad">Apri →</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
