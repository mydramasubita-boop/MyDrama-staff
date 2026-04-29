import React, { useState, useEffect } from 'react';
import { auth, logoutUser, getAllUsers, createUser, saveUserProfile, createSeries, getSeries, updateSeries, deleteSeries, addEpisode, getEpisodes, updateEpisode, deleteEpisode } from '../firebase.js';

export default function AdminDashboard({ profile, onOpenEpisode }) {
  const [tab, setTab] = useState('projects');
  const [series, setSeries] = useState([]);
  const [users, setUsers] = useState([]);
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);
  const [expandedSeries, setExpandedSeries] = useState({});

  useEffect(() => {
    const unsub = getSeries(setSeries);
    getAllUsers().then(setUsers);
    return unsub;
  }, []);

  const toggleExpand = (id) => setExpandedSeries(p => ({ ...p, [id]: !p[id] }));

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
                <div className="page-subtitle">{series.length} serie/film</div>
              </div>
              <button className="btn btn-grad" onClick={() => setShowNewSeries(true)}>+ Nuova serie</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {series.map(s => (
                <SeriesCard
                  key={s.id}
                  series={s}
                  users={users}
                  expanded={expandedSeries[s.id]}
                  onToggle={() => toggleExpand(s.id)}
                  onOpenEpisode={onOpenEpisode}
                  onDelete={() => { if(confirm('Eliminare la serie?')) deleteSeries(s.id); }}
                  onUpdate={(data) => updateSeries(s.id, data)}
                />
              ))}
            </div>
          </>
        )}

        {tab === 'users' && (
          <>
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="page-title">Utenti</div>
                <div className="page-subtitle">{users.length} membri</div>
              </div>
              <button className="btn btn-grad" onClick={() => setShowNewUser(true)}>+ Nuovo utente</button>
            </div>
            <div className="card">
              <table className="table">
                <thead><tr><th>Nome</th><th>Email</th><th>Ruolo</th></tr></thead>
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

      {showNewSeries && <NewSeriesModal users={users} onClose={() => setShowNewSeries(false)} />}
      {showNewUser && <NewUserModal onClose={() => { setShowNewUser(false); getAllUsers().then(setUsers); }} />}
    </div>
  );
}

function SeriesCard({ series, users, expanded, onToggle, onOpenEpisode, onDelete, onUpdate }) {
  const [episodes, setEpisodes] = useState([]);
  const [showAddEp, setShowAddEp] = useState(false);
  const [showEditSeries, setShowEditSeries] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const unsub = getEpisodes(series.id, setEpisodes);
    return unsub;
  }, [expanded, series.id]);

  const statusLabel = (s) => ({ pending: 'In attesa', in_progress: 'In corso', translation_done: 'Da checkare', check_done: 'Pronto' })[s] || s;
  const statusClass = (s) => ({ pending: 'status-pending', in_progress: 'status-in_progress', translation_done: 'status-translation_done', check_done: 'status-check_done' })[s] || '';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{series.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
            {series.type === 'film' ? '🎬 Film' : `📺 Serie • ${series.episodeCount || 0} ep`}
            {' · '}
            {(series.team || []).map(uid => users.find(u => u.id === uid)?.name).filter(Boolean).join(', ')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); setShowEditSeries(true); }}>✏️ Modifica</button>
          <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); onDelete(); }}>✕</button>
          <span style={{ color: 'var(--text2)', fontSize: 18 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Episodi</div>
            <button className="btn btn-sm btn-grad" onClick={() => setShowAddEp(true)}>+ Aggiungi episodio</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {episodes.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 13 }}>Nessun episodio aggiunto.</div>}
            {episodes.map(ep => (
              <EpisodeRow key={ep.id} ep={ep} users={users} onOpen={() => onOpenEpisode(ep, series)} />
            ))}
          </div>
        </div>
      )}

      {showAddEp && <AddEpisodeModal seriesId={series.id} onClose={() => setShowAddEp(false)} />}
      {showEditSeries && <EditSeriesModal series={series} users={users} onUpdate={onUpdate} onClose={() => setShowEditSeries(false)} />}
    </div>
  );
}

function EpisodeRow({ ep, users, onOpen }) {
  const [showEdit, setShowEdit] = useState(false);
  const statusLabel = (s) => ({ pending: 'In attesa', in_progress: 'In corso', translation_done: 'Da checkare', check_done: 'Pronto' })[s] || s;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ flex: 1, cursor: 'pointer' }} onClick={onOpen}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Ep. {ep.number} — {ep.title}</div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
          {ep.videoUrl ? '🎬 Video ok' : '⚠️ No video'} · {ep.assUrl ? '📝 ASS ok' : '⚠️ No ASS'}
        </div>
      </div>
      <span className={`project-status status-${ep.status}`}>{statusLabel(ep.status)}</span>
      <button className="btn btn-sm btn-outline" onClick={() => setShowEdit(true)}>✏️</button>
      <button className="btn btn-sm btn-danger" onClick={() => { if(confirm('Eliminare?')) deleteEpisode(ep.id); }}>✕</button>
      {showEdit && <EditEpisodeModal ep={ep} onClose={() => setShowEdit(false)} />}
    </div>
  );
}

function AddEpisodeModal({ seriesId, onClose }) {
  const [form, setForm] = useState({ number: '', title: '', videoUrl: '', assUrl: '' });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    if (!form.number) return;
    setLoading(true);
    await addEpisode(seriesId, { ...form, number: parseInt(form.number) });
    setLoading(false); onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Aggiungi episodio</div>
        <div className="form-row"><label className="label">Numero episodio</label><input className="input-field" type="number" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="es. 1" /></div>
        <div className="form-row"><label className="label">Titolo episodio</label><input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="es. Episodio 1" /></div>
        <div className="form-row"><label className="label">Link video raw</label><input className="input-field" value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="https://..." /></div>
        <div className="form-row"><label className="label">Link file .ass/.srt</label><input className="input-field" value={form.assUrl} onChange={e => setForm(f => ({ ...f, assUrl: e.target.value }))} placeholder="https://raw.githubusercontent.com/..." /></div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annulla</button>
          <button className="btn btn-grad" onClick={handleSubmit} disabled={loading}>{loading ? 'Salvataggio...' : 'Aggiungi'}</button>
        </div>
      </div>
    </div>
  );
}

function EditEpisodeModal({ ep, onClose }) {
  const [form, setForm] = useState({ title: ep.title || '', videoUrl: ep.videoUrl || '', assUrl: ep.assUrl || '' });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    await updateEpisode(ep.id, form);
    setLoading(false); onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Modifica Ep. {ep.number}</div>
        <div className="form-row"><label className="label">Titolo</label><input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Link video raw</label><input className="input-field" value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Link file .ass/.srt</label><input className="input-field" value={form.assUrl} onChange={e => setForm(f => ({ ...f, assUrl: e.target.value }))} /></div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annulla</button>
          <button className="btn btn-grad" onClick={handleSubmit} disabled={loading}>{loading ? 'Salvataggio...' : 'Salva'}</button>
        </div>
      </div>
    </div>
  );
}

function EditSeriesModal({ series, users, onUpdate, onClose }) {
  const [form, setForm] = useState({ title: series.title || '', type: series.type || 'series', team: series.team || [] });
  const toggleTeam = (uid) => setForm(f => ({ ...f, team: f.team.includes(uid) ? f.team.filter(x => x !== uid) : [...f.team, uid] }));
  const handleSubmit = async () => { await onUpdate(form); onClose(); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Modifica serie</div>
        <div className="form-row"><label className="label">Titolo</label><input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div className="form-row">
          <label className="label">Tipo</label>
          <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="series">Serie TV</option>
            <option value="film">Film</option>
          </select>
        </div>
        <div className="form-row">
          <label className="label">Team</label>
          <div className="checkbox-group">
            {users.map(u => (
              <label key={u.id} className={`checkbox-item ${form.team.includes(u.id) ? 'checked' : ''}`}>
                <input type="checkbox" checked={form.team.includes(u.id)} onChange={() => toggleTeam(u.id)} />
                {u.name}
              </label>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annulla</button>
          <button className="btn btn-grad" onClick={handleSubmit}>Salva</button>
        </div>
      </div>
    </div>
  );
}

function NewSeriesModal({ users, onClose }) {
  const [form, setForm] = useState({ title: '', type: 'series', team: [] });
  const [loading, setLoading] = useState(false);
  const toggleTeam = (uid) => setForm(f => ({ ...f, team: f.team.includes(uid) ? f.team.filter(x => x !== uid) : [...f.team, uid] }));
  const handleSubmit = async () => {
    if (!form.title) return;
    setLoading(true);
    await createSeries(form);
    setLoading(false); onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Nuova serie / Film</div>
        <div className="form-row"><label className="label">Titolo</label><input className="input-field" placeholder="es. Hidden Love" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div className="form-row">
          <label className="label">Tipo</label>
          <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="series">Serie TV</option>
            <option value="film">Film</option>
          </select>
        </div>
        <div className="form-row">
          <label className="label">Team assegnato</label>
          <div className="checkbox-group">
            {users.map(u => (
              <label key={u.id} className={`checkbox-item ${form.team.includes(u.id) ? 'checked' : ''}`}>
                <input type="checkbox" checked={form.team.includes(u.id)} onChange={() => toggleTeam(u.id)} />
                {u.name}
              </label>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annulla</button>
          <button className="btn btn-grad" onClick={handleSubmit} disabled={loading}>{loading ? 'Creazione...' : 'Crea'}</button>
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
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Nuovo utente</div>
        <div className="form-row"><label className="label">Nome</label><input className="input-field" placeholder="Nome Cognome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Email</label><input className="input-field" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Password</label><input className="input-field" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
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
