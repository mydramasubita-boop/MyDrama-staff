import React, { useState, useEffect } from 'react';
import { auth, logoutUser, getAllUsers, createUser, saveUserProfile, createProject, getProjects, deleteProject, updateProject } from '../firebase.js';

export default function AdminDashboard({ profile, onOpenProject }) {
  const [tab, setTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);

  useEffect(() => {
    const unsub = getProjects(setProjects);
    getAllUsers().then(setUsers);
    return unsub;
  }, []);

  const refreshUsers = () => getAllUsers().then(setUsers);

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-logo">MyDrama <span>Staff</span></div>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{profile.name}</div>
          <div className="sidebar-user-role">Admin</div>
        </div>
        <nav className="sidebar-nav">
          <div className={`nav-item ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}>📁 Progetti</div>
          <div className={`nav-item ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>👥 Utenti</div>
        </nav>
        <button className="sidebar-logout" onClick={logoutUser}>Esci</button>
      </div>

      <div className="main-content">
        {tab === 'projects' && (
          <>
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="page-title">Progetti</div>
                <div className="page-subtitle">{projects.length} progetti totali</div>
              </div>
              <button className="btn btn-grad" onClick={() => setShowNewProject(true)}>+ Nuovo progetto</button>
            </div>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-num">{projects.length}</div><div className="stat-label">Totale</div></div>
              <div className="stat-card"><div className="stat-num">{projects.filter(p => p.status === 'in_progress').length}</div><div className="stat-label">In corso</div></div>
              <div className="stat-card"><div className="stat-num">{projects.filter(p => p.status === 'translation_done').length}</div><div className="stat-label">Da checkare</div></div>
              <div className="stat-card"><div className="stat-num">{projects.filter(p => p.status === 'check_done').length}</div><div className="stat-label">Pronti</div></div>
            </div>
            <div className="card-grid">
              {projects.map(p => (
                <div key={p.id} className="project-card" onClick={() => onOpenProject(p)}>
                  <div className="project-title">{p.title}</div>
                  <div className="project-ep">Ep. {p.episode} • {p.series}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={`project-status status-${p.status}`}>
                      {p.status === 'in_progress' ? 'In corso' : p.status === 'translation_done' ? 'Da checkare' : 'Pronto per encoding'}
                    </span>
                    <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); if(confirm('Eliminare il progetto?')) deleteProject(p.id); }}>✕</button>
                  </div>
                  <div className="project-team">
                    {(p.team || []).map(uid => {
                      const u = users.find(u => u.id === uid);
                      return u ? <span key={uid} className="team-tag">{u.name}</span> : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'users' && (
          <>
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="page-title">Utenti</div>
                <div className="page-subtitle">{users.length} membri del team</div>
              </div>
              <button className="btn btn-grad" onClick={() => setShowNewUser(true)}>+ Nuovo utente</button>
            </div>
            <div className="card">
              <table className="table">
                <thead>
                  <tr><th>Nome</th><th>Email</th><th>Ruolo</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td style={{ color: 'var(--text2)' }}>{u.email}</td>
                      <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showNewProject && <NewProjectModal users={users} onClose={() => setShowNewProject(false)} />}
      {showNewUser && <NewUserModal onClose={() => { setShowNewUser(false); refreshUsers(); }} />}
    </div>
  );
}

function NewProjectModal({ users, onClose }) {
  const [form, setForm] = useState({ title: '', series: '', episode: '', videoUrl: '', assUrl: '', team: [] });
  const [loading, setLoading] = useState(false);

  const toggleTeam = (uid) => {
    setForm(f => ({ ...f, team: f.team.includes(uid) ? f.team.filter(x => x !== uid) : [...f.team, uid] }));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.episode) return;
    setLoading(true);
    await createProject(form);
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Nuovo Progetto</div>
        <div className="form-row"><label className="label">Titolo drama</label><input className="input-field" placeholder="es. Naeil's Cantabile" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Nome serie (breve)</label><input className="input-field" placeholder="es. Cantabile" value={form.series} onChange={e => setForm(f => ({ ...f, series: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Episodio</label><input className="input-field" type="number" placeholder="es. 9" value={form.episode} onChange={e => setForm(f => ({ ...f, episode: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Link video raw</label><input className="input-field" placeholder="https://..." value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Link file .ass (o carica su GitHub e incolla il link raw)</label><input className="input-field" placeholder="https://raw.githubusercontent.com/..." value={form.assUrl} onChange={e => setForm(f => ({ ...f, assUrl: e.target.value }))} /></div>
        <div className="form-row">
          <label className="label">Team assegnato</label>
          <div className="checkbox-group">
            {users.filter(u => u.role !== 'admin' || true).map(u => (
              <label key={u.id} className={`checkbox-item ${form.team.includes(u.id) ? 'checked' : ''}`}>
                <input type="checkbox" checked={form.team.includes(u.id)} onChange={() => toggleTeam(u.id)} />
                {u.name}
              </label>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annulla</button>
          <button className="btn btn-grad" onClick={handleSubmit} disabled={loading}>{loading ? 'Creazione...' : 'Crea progetto'}</button>
        </div>
      </div>
    </div>
  );
}

function NewUserModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.password) return;
    setLoading(true); setError('');
    try {
      const cred = await createUser(form.email, form.password);
      await saveUserProfile(cred.user.uid, { name: form.name, email: form.email, role: form.role });
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Nuovo Utente</div>
        <div className="form-row"><label className="label">Nome</label><input className="input-field" placeholder="Nome Cognome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Email</label><input className="input-field" type="email" placeholder="email@esempio.it" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Password</label><input className="input-field" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
        <div className="form-row">
          <label className="label">Ruolo</label>
          <select className="input-field" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annulla</button>
          <button className="btn btn-grad" onClick={handleSubmit} disabled={loading}>{loading ? 'Creazione...' : 'Crea utente'}</button>
        </div>
      </div>
    </div>
  );
}
