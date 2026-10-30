import React, { useState, useEffect, useRef } from 'react';
import { logoutUser, getSeries, getEpisodes } from '../firebase.js';
import { auth } from '../firebase.js';

// Riassunto avanzamento traduzione mostrato sotto il titolo nelle liste progetti.
// Serie: ultimo episodio con righe tradotte e fino a dove. Film: fino a dove.
function progressSummary(isFilm, eps) {
  if (!eps || eps.length === 0) return '';
  const fmt = (e) => {
    const tot = e.totalSegments, done = e.translatedCount || 0;
    if (tot && done >= tot) return 'completo';
    if (!tot) return '';
    const line = e.lastTranslatedLine;
    const pct = e.progress ?? Math.round((done / tot) * 100);
    return line ? `fino a riga ${line}/${tot} (${pct}%)` : `${done}/${tot} righe (${pct}%)`;
  };
  if (isFilm) {
    const e = eps[0];
    if (!(e.translatedCount > 0)) return 'Traduzione non ancora iniziata';
    return `Tradotto ${fmt(e)}`;
  }
  const started = eps.filter(e => (e.translatedCount || 0) > 0);
  if (started.length === 0) return 'Traduzione non ancora iniziata';
  const last = started.reduce((a, b) => ((b.number || 0) > (a.number || 0) ? b : a));
  return `Ultimo tradotto: Ep. ${last.number} — ${fmt(last)}`;
}

export default function StaffDashboard({ profile, onOpenEpisode }) {
  const [series, setSeries] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [episodes, setEpisodes] = useState({});
  const unsubsRef = useRef({});

  useEffect(() => {
    const unsub = getSeries(all => {
      setSeries(all.filter(s => (s.team || []).includes(auth.currentUser?.uid)));
    });
    return unsub;
  }, []);

  // Un listener episodi per ogni serie assegnata (non solo quelle aperte), cosi'
  // sotto il titolo si vede subito a che punto e' la traduzione.
  useEffect(() => {
    series.forEach(s => {
      if (!unsubsRef.current[s.id]) {
        unsubsRef.current[s.id] = getEpisodes(s.id, (eps) => setEpisodes(prev => ({ ...prev, [s.id]: eps })));
      }
    });
  }, [series]);
  useEffect(() => () => {
    Object.values(unsubsRef.current).forEach(u => { if (typeof u === 'function') u(); });
  }, []);

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
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
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{s.isFilm ? 'Film' : `Serie • ${(episodes[s.id] || []).length || s.episodeCount || 0} episodi`}</div>
                    {progressSummary(s.isFilm, episodes[s.id]) && (
                      <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 4 }}>{progressSummary(s.isFilm, episodes[s.id])}</div>
                    )}
                  </div>
                  <span style={{ color: 'var(--text2)', fontSize: 18 }}>{expanded[s.id] ? '▲' : '▼'}</span>
                </div>
                {expanded[s.id] && (
                  <div style={{ padding: '16px 24px' }}>
                    <div className="table-scroll">
                    <table className="table">
                      <thead><tr><th>Ep.</th><th>Titolo</th><th>Stato</th><th>Tradotte</th><th></th></tr></thead>
                      <tbody>
                        {(episodes[s.id] || []).map(ep => {
                          const st = statusLabel(ep.status);
                          return (
                            <tr key={ep.id}>
                              <td style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{ep.number}</td>
                              <td>{ep.title || `Episodio ${ep.number}`}</td>
                              <td><span className={`project-status ${st.cls}`}>{st.label}</span></td>
                              <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{ep.totalSegments ? `${ep.translatedCount || 0}/${ep.totalSegments} (${ep.progress || 0}%)` : '—'}</td>
                              <td><button className="btn btn-sm btn-grad" onClick={() => onOpenEpisode({ series: s, episode: ep })}>Apri</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
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
