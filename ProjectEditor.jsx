import React, { useState, useEffect, useRef } from 'react';
import { saveSegment, getSegments, updateProject, getAllUsers } from '../firebase.js';
import { auth } from '../firebase.js';

// Parsa file .ass e restituisce array di segmenti
function parseASS(text) {
  const segments = [];
  const lines = text.split('\n');
  let inEvents = false;
  let format = [];

  for (const line of lines) {
    if (line.trim() === '[Events]') { inEvents = true; continue; }
    if (inEvents && line.startsWith('Format:')) {
      format = line.replace('Format:', '').split(',').map(s => s.trim());
      continue;
    }
    if (inEvents && line.startsWith('Dialogue:')) {
      const vals = line.replace('Dialogue:', '').split(',');
      const obj = {};
      format.forEach((k, i) => { obj[k] = (vals[i] || '').trim(); });
      // Rimuovi tag ASS dal testo
      const text = (obj.Text || '').replace(/\{[^}]*\}/g, '').replace(/\\N/g, ' ').trim();
      if (text) {
        segments.push({
          id: `${obj.Start}_${obj.End}`,
          start: obj.Start,
          end: obj.End,
          original: text,
          startSec: timeToSec(obj.Start),
        });
      }
    }
  }
  return segments;
}

function parseSRT(text) {
  const segments = [];
  const blocks = text.trim().split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const times = lines[1].split(' --> ');
    const start = times[0]?.trim().replace(',', '.');
    const end = times[1]?.trim().replace(',', '.');
    const textContent = lines.slice(2).join(' ').replace(/<[^>]*>/g, '').trim();
    if (textContent && start) {
      segments.push({ id: `seg_${segments.length}`, start, end, original: textContent, startSec: timeToSec(start) });
    }
  }
  return segments;
}

function timeToSec(t) {
  if (!t) return 0;
  const parts = t.replace(',', '.').split(':');
  if (parts.length === 3) return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  return 0;
}

export default function ProjectEditor({ project, profile, onBack }) {
  const [segments, setSegments] = useState([]);
  const [translations, setTranslations] = useState({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [users, setUsers] = useState([]);
  const [sendTo, setSendTo] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendType, setSendType] = useState('');
  const videoRef = useRef(null);
  const isAdmin = profile.role === 'admin';

  // Carica file .ass o .srt
  useEffect(() => {
    if (!project.assUrl) return;
    fetch(project.assUrl)
      .then(r => r.text())
      .then(text => {
        const segs = project.assUrl.toLowerCase().includes('.ass') ? parseASS(text) : parseSRT(text);
        setSegments(segs);
      })
      .catch(() => setSegments([]));
  }, [project.assUrl]);

  // Ascolta traduzioni in tempo reale
  useEffect(() => {
    const unsub = getSegments(project.id, setTranslations);
    return unsub;
  }, [project.id]);

  // Carica utenti
  useEffect(() => { getAllUsers().then(setUsers); }, []);

  const activeSegment = segments[activeIdx];

  // Vai al punto del video
  const seekTo = (seg) => {
    if (videoRef.current && seg) videoRef.current.currentTime = seg.startSec;
  };

  const handleSegmentClick = (idx) => {
    setActiveIdx(idx);
    seekTo(segments[idx]);
  };

  const handleTranslationChange = (val) => {
    if (!activeSegment) return;
    saveSegment(project.id, activeSegment.id, {
      original: activeSegment.original,
      translated: val,
      translatedBy: auth.currentUser?.uid,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) { if (activeIdx > 0) { setActiveIdx(i => i - 1); seekTo(segments[activeIdx - 1]); } }
      else { if (activeIdx < segments.length - 1) { setActiveIdx(i => i + 1); seekTo(segments[activeIdx + 1]); } }
    }
  };

  const sendNotification = async () => {
    const recipient = users.find(u => u.id === sendTo);
    if (!recipient) return;
    const subject = sendType === 'checker'
      ? `[MyDrama Staff] Traduzione pronta per check: ${project.title} Ep.${project.episode}`
      : `[MyDrama Staff] Check completato - pronto per encoding: ${project.title} Ep.${project.episode}`;
    const body = sendType === 'checker'
      ? `La traduzione di ${project.title} Episodio ${project.episode} è stata completata. Puoi procedere con il check.`
      : `Il check di ${project.title} Episodio ${project.episode} è stato completato. Pronto per l'encoding.`;

    // Mailto fallback
    window.open(`mailto:${recipient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);

    // Aggiorna stato progetto
    if (sendType === 'checker') await updateProject(project.id, { status: 'translation_done' });
    else await updateProject(project.id, { status: 'check_done' });
    setShowSendModal(false);
  };

  const completedCount = segments.filter(s => translations[s.id]?.translated?.trim()).length;
  const progress = segments.length > 0 ? Math.round((completedCount / segments.length) * 100) : 0;

  return (
    <div className="editor-layout">
      {/* Player */}
      <div className="editor-player">
        <video ref={videoRef} src={project.videoUrl} controls style={{ width: '100%', height: '55%', background: '#000', display: 'block' }} />
        <div className="editor-player-info">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, marginBottom: 8 }}>{project.title} — Ep. {project.episode}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{completedCount}/{segments.length} segmenti tradotti ({progress}%)</div>
          <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--primary), var(--secondary))', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          {activeSegment && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg3)', borderRadius: 8, fontSize: 13 }}>
              <div style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 11, marginBottom: 4 }}>{activeSegment.start} → {activeSegment.end}</div>
              <div style={{ color: 'var(--text2)' }}>{activeSegment.original}</div>
              {translations[activeSegment.id]?.translated && (
                <div style={{ color: 'var(--text)', marginTop: 6 }}>🇮🇹 {translations[activeSegment.id].translated}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Segmenti */}
      <div className="editor-segments">
        <div className="editor-header">
          <div>
            <button className="btn btn-sm btn-outline" onClick={onBack}>← Torna ai progetti</button>
          </div>
          <div className="editor-title" style={{ color: 'var(--text2)', fontSize: 12 }}>
            Tab = segmento successivo • Shift+Tab = precedente
          </div>
        </div>

        <div className="segments-list">
          {segments.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
              {project.assUrl ? 'Caricamento file...' : 'Nessun file .ass/.srt collegato al progetto.'}
            </div>
          )}
          {segments.map((seg, idx) => {
            const t = translations[seg.id];
            const isActive = idx === activeIdx;
            return (
              <div key={seg.id} className={`segment-card ${isActive ? 'active' : ''}`} onClick={() => handleSegmentClick(idx)}>
                <div className="segment-time">{seg.start} → {seg.end}</div>
                <div className="segment-original">{seg.original}</div>
                {isActive ? (
                  <textarea
                    className="segment-input"
                    value={t?.translated || ''}
                    onChange={e => handleTranslationChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Scrivi la traduzione italiana..."
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  t?.translated ? <div className="segment-translated">🇮🇹 {t.translated}</div> : <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>Non tradotto</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="editor-actions">
          <button className="btn btn-sm btn-outline" onClick={() => { setSendType('checker'); setShowSendModal(true); }}>
            ✉️ Invia al checker
          </button>
          <button className="btn btn-sm btn-success" onClick={() => { setSendType('encoder'); setShowSendModal(true); }}>
            ✅ Pronto per encoding
          </button>
          {segments.length > 0 && (
            <button className="btn btn-sm btn-outline" onClick={() => {
              // Esporta .srt
              let srt = '';
              segments.forEach((seg, i) => {
                const t = translations[seg.id]?.translated || seg.original;
                const startSRT = seg.start.replace('.', ',');
                const endSRT = seg.end.replace('.', ',');
                srt += `${i + 1}\n${startSRT} --> ${endSRT}\n${t}\n\n`;
              });
              const blob = new Blob([srt], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `${project.title}_ep${project.episode}_IT.srt`; a.click();
            }}>⬇️ Esporta .srt</button>
          )}
        </div>
      </div>

      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{sendType === 'checker' ? '📨 Invia al checker' : '✅ Invia per encoding'}</div>
            <div className="form-row">
              <label className="label">Seleziona destinatario</label>
              <select className="input-field" value={sendTo} onChange={e => setSendTo(e.target.value)}>
                <option value="">-- Seleziona --</option>
                {users.filter(u => u.id !== auth.currentUser?.uid).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowSendModal(false)}>Annulla</button>
              <button className="btn btn-grad" onClick={sendNotification} disabled={!sendTo}>Invia notifica</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
