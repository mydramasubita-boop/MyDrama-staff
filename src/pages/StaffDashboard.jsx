import React, { useState, useEffect } from 'react';
import { logoutUser, getProjects } from '../firebase.js';
import { auth } from '../firebase.js';

export default function StaffDashboard({ profile, onOpenProject }) {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const unsub = getProjects(all => {
      // Mostra solo i progetti in cui l'utente è nel team
      setProjects(all.filter(p => (p.team || []).includes(auth.currentUser?.uid)));
    });
    return unsub;
  }, []);

  const statusLabel = (s) => s === 'in_progress' ? 'In corso' : s === 'translation_done' ? 'Da checkare' : 'Pronto per encoding';

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
          <div className="page-subtitle">{projects.length} progetti assegnati</div>
        </div>
        {projects.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text2)' }}>
            Nessun progetto assegnato al momento.
          </div>
        ) : (
          <div className="card-grid">
            {projects.map(p => (
              <div key={p.id} className="project-card" onClick={() => onOpenProject(p)}>
                <div className="project-title">{p.title}</div>
                <div className="project-ep">Ep. {p.episode} • {p.series}</div>
                <span className={`project-status status-${p.status}`}>{statusLabel(p.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
