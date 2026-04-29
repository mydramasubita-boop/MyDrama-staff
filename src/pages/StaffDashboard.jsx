import React, { useState, useEffect } from 'react';
import { logoutUser, getSeries, getEpisodes } from '../firebase.js';
import { auth } from '../firebase.js';

export default function StaffDashboard({ profile, onOpenEpisode }) {
  const [series, setSeries] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [episodes, setEpisodes] = useState({});

  useEffect(() => {
    const unsub = getSeries(all => {
      setSeries(all.filter(s => (s.team || []).includes(auth.currentUser?.uid)));
    });
    return unsub;
  }, []);

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    if (!episodes[id]) {
      getEpisodes(id, (eps) => setEpisodes(prev => ({ ...prev, [id]: eps })));
    }
  };

  const statusLabel = (s) => {
    if (s === 'pending') return { label: 'Da tradurre', cls: 'status-in_progress' };
    if (s === 'translating') return { label: 'In traduzione', cls: 'status-in_progress' };
    if (s === 'translation_done') return { label: 'Da checkare', cls: 'status-translation_done' };
    if (s === 'check_done') return { label: 'Pronto encoding', cls: 'status-check_done' };
    return { label: s, cls: '' };
  };

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
          <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>Nessun progetto assegnato.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {series.map(s => (
              <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', cursor: 'pointer', borderBottom: expanded[s.id] ? '1px solid var(--border)' : 'none' }} onClick={() => toggleExpand(s.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{s.isFilm ? 'Film' : `Serie • ${s.episodeCount || 0} episodi`}</div>
                  </div>
                  <span style={{ color: 'var(--text2)', fontSize: 18 }}>{expanded[s.id] ? '▲' : '▼'}</span>
                </div>
                {expanded[s.id] && (
                  <div style={{ padding: '16px 24px' }}>
                    <table className="table">
                      <thead><tr><th>Ep.</th><th>Titolo</th><th>Stato</th><th></th></tr></thead>
                      <tbody>
                        {(episodes[s.id] || []).map(ep => {
                          const st = statusLabel(ep.status);
                          return (
                            <tr key={ep.id}>
                              <td style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{ep.number}</td>
                              <td>{ep.title || `Episodio ${ep.number}`}</td>
                              <td><span className={`project-status ${st.cls}`}>{st.label}</span></td>
                              <td><button className="btn btn-sm btn-grad" onClick={() => onOpenEpisode({ series: s, episode: ep })}>Apri</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
