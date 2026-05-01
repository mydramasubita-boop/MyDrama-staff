import React, { useState, useEffect } from 'react';
import { logoutUser, getAllUsers, createUser, saveUserProfile, createSeries, getSeries, updateSeries, deleteSeries, addEpisode, getEpisodes, updateEpisode, deleteEpisode } from '../firebase.js';

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

  const toggleExpand = (id) => setExpandedSeries(prev => ({ ...prev, [id]: !prev[id] }));
  const refreshUsers = () => getAllUsers().then(setUsers);
  const totalEps = series.reduce((acc, s) => acc + (s.episodeCount || 0), 0);

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
                <div className="page-subtitle">{series.length} serie • {totalEps} episodi</div>
              </div>
              <button className="btn btn-grad" onClick={() => setShowNewSeries(true)}>+ Nuova serie</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {series.map(s => (
                <SeriesCard
                  key={s.id}
                  series={s}
                  users={users}
                  expanded={!!expandedSeries[s.id]}
                  onToggle={() => toggleExpand(s.id)}
                  onDelete={() => { if(confirm('Eliminare la serie?')) deleteSeries(s.id); }}
                  onOpenEpisode={onOpenEpisode}
                  onUpdate={(data) => updateSeries(s.id, data)}
                />
              ))}
              {series.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
                  Nessun progetto ancora. Clicca "+ Nuova serie" per iniziare.
                </div>
              )}
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
      {showNewUser && <NewUserModal onClose={() => { setShowNewUser(false); refreshUsers(); }} />}
    </div>
  );
}

function SeriesCard({ series, users, expanded, onToggle, onDelete, onOpenEpisode, onUpdate }) {
  const [episodes, setEpisodes] = useState([]);
  const [showAddEp, setShowAddEp] = useState(false);
  const [editEp, setEditEp] = useState(null);
  const [editSeries, setEditSeries] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const unsub = getEpisodes(series.id, (eps) => {
      setEpisodes(eps);
      updateSeries(series.id, { episodeCount: eps.length });
    });
    return unsub;
  }, [expanded, series.id]);

  const statusLabel = (s) => {
    if (s === 'pending') return { label: 'Da tradurre', cls: 'status-in_progress' };
    if (s === 'translating') return { label: 'In traduzione', cls: 'status-in_progress' };
    if (s === 'translation_done') return { label: 'Da checkare', cls: 'status-translation_done' };
    if (s === 'check_done') return { label: 'Pronto encoding', cls: 'status-check_done' };
    return { label: s, cls: '' };
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: expanded ? '1px solid var(--border)' : 'none' }} onClick={onToggle}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{series.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
            {series.isFilm ? 'Film' : `Serie • ${series.episodeCount || 0} episodi`}
            {' • '}
            {(series.team || []).map(uid => users.find(u => u.id === uid)?.name).filter(Boolean).join(', ')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); setEditSeries(true); }}>✏️</button>
          <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); onDelete(); }}>✕</button>
          <span style={{ color: 'var(--text2)', fontSize: 18 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '16px 24px' }}>
          <table className="table" style={{ marginBottom: 16 }}>
            <thead><tr><th>Ep.</th><th>Titolo</th><th>Stato</th><th>Azioni</th></tr></thead>
            <tbody>
              {episodes.map(ep => {
                const st = statusLabel(ep.status);
                return (
                  <tr key={ep.id}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{ep.number}</td>
                    <td>{ep.title || `Episodio ${ep.number}`}</td>
                    <td><span className={`project-status ${st.cls}`}>{st.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-grad" onClick={() => onOpenEpisode({ series, episode: ep })}>Apri</button>
                        <button className="btn btn-sm btn-outline" onClick={() => setEditEp(ep)}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => { if(confirm('Eliminare episodio?')) deleteEpisode(series.id, ep.id); }}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!series.isFilm && (
            <button className="btn btn-sm btn-outline" onClick={() => setShowAddEp(true)}>+ Aggiungi episodio</button>
          )}
        </div>
      )}

      {showAddEp && <EpisodeModal seriesId={series.id} onClose={() => setShowAddEp(false)} />}
      {editEp && <EpisodeModal seriesId={series.id} episode={editEp} onClose={() => setEditEp(null)} />}
      {editSeries && <EditSeriesModal series={series} users={users} onUpdate={onUpdate} onClose={() => setEditSeries(false)} />}
    </div>
  );
}

function NewSeriesModal({ users, onClose }) {
  const [form, setForm] = useState({ title: '', isFilm: false, team: [] });
  const [epForm, setEpForm] = useState({ number: 1, title: '', videoUrl: '', assUrl: '' });
  const [loading, setLoading] = useState(false);

  const toggleTeam = (uid) => setForm(f => ({ ...f, team: f.team.includes(uid) ? f.team.filter(x => x !== uid) : [...f.team, uid] }));

  const handleSubmit = async () => {
    if (!form.title) return;
    setLoading(true);
    const sid = await createSeries({ ...form, episodeCount: form.isFilm ? 1 : 0 });
    if (form.isFilm) {
      await addEpisode(sid, { number: 1, title: form.title, videoUrl: epForm.videoUrl, assUrl: epForm.assUrl });
      await updateSeries(sid, { episodeCount: 1 });
    }
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Nuova Serie / Film</div>
        <div className="form-row">
          <label className="label">Titolo</label>
          <input className="input-field" placeholder="es. Hidden Love" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="form-row">
          <label className="checkbox-item" style={{ display: 'inline-flex' }}>
            <input type="checkbox" checked={form.isFilm} onChange={e => setForm(f => ({ ...f, isFilm: e.target.checked }))} />
            <span style={{ marginLeft: 8 }}>È un film (episodio singolo)</span>
          </label>
        </div>
        {form.isFilm && (
          <>
            <div className="form-row"><label className="label">Link video raw</label><input className="input-field" placeholder="https://..." value={epForm.videoUrl} onChange={e => setEpForm(f => ({ ...f, videoUrl: e.target.value }))} /></div>
            <div className="form-row"><label className="label">Link file .ass originale (da tradurre)</label><input className="input-field" placeholder="https://..." value={epForm.assUrl} onChange={e => setEpForm(f => ({ ...f, assUrl: e.target.value }))} /></div>
            <div className="form-row"><label className="label">Link file .ass italiano (già tradotto — opzionale)</label><input className="input-field" placeholder="https://..." value={epForm.assItUrl || ''} onChange={e => setEpForm(f => ({ ...f, assItUrl: e.target.value }))} /></div>
          </>
        )}
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

function EpisodeModal({ seriesId, episode, onClose }) {
  const [form, setForm] = useState({ number: episode?.number || '', title: episode?.title || '', videoUrl: episode?.videoUrl || '', assUrl: episode?.assUrl || '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    if (episode) await updateEpisode(seriesId, episode.id, form);
    else await addEpisode(seriesId, form);
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{episode ? 'Modifica episodio' : 'Nuovo episodio'}</div>
        <div className="form-row"><label className="label">Numero episodio</label><input className="input-field" type="number" value={form.number} onChange={e => setForm(f => ({ ...f, number: parseInt(e.target.value) || '' }))} /></div>
        <div className="form-row"><label className="label">Titolo episodio (opzionale)</label><input className="input-field" placeholder="es. Il primo incontro" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Link video raw</label><input className="input-field" placeholder="https://..." value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Link file .ass originale (da tradurre)</label><input className="input-field" placeholder="https://..." value={form.assUrl} onChange={e => setForm(f => ({ ...f, assUrl: e.target.value }))} /></div>
        <div className="form-row"><label className="label">Link file .ass italiano (già tradotto — opzionale, per check)</label><input className="input-field" placeholder="https://..." value={form.assItUrl || ''} onChange={e => setForm(f => ({ ...f, assItUrl: e.target.value }))} /></div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annulla</button>
          <button className="btn btn-grad" onClick={handleSubmit} disabled={loading}>{loading ? 'Salvataggio...' : 'Salva'}</button>
        </div>
      </div>
    </div>
  );
}

function EditSeriesModal({ series, users, onUpdate, onClose }) {
  const [form, setForm] = useState({ title: series.title, team: series.team || [] });
  const toggleTeam = (uid) => setForm(f => ({ ...f, team: f.team.includes(uid) ? f.team.filter(x => x !== uid) : [...f.team, uid] }));
  const handleSubmit = async () => { await onUpdate(form); onClose(); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Modifica serie</div>
        <div className="form-row"><label className="label">Titolo</label><input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
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
          <button className="btn btn-grad" onClick={handleSubmit}>Salva</button>
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
      const { uid } = await createUser(form.email, form.password);
      await saveUserProfile(uid, { name: form.name, email: form.email, role: form.role });
      onClose();
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Nuovo Utente</div>
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
