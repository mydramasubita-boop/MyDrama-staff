import React, { useState, useEffect, useRef } from 'react';
import { saveSegment, getSegments, updateEpisode, getAllUsers } from './firebase.js';
import { auth } from './firebase.js';
import emailjs from 'emailjs-com';

const EMAILJS_SERVICE = 'service_4l933ap';
const EMAILJS_PUBKEY = 'j2smuu518um43TmFj';
const TEMPLATE_CHECKER = 'template_f0d6bhd';
const TEMPLATE_ENCODING = 'template_enf305b';
const APP_URL = 'https://mydramasubita-boop.github.io/MyDrama-staff/';

function parseASS(text) {
  const segments = [];
  const lines = text.split('\n');
  let inEvents = false, format = [];
  for (const line of lines) {
    if (line.trim() === '[Events]') { inEvents = true; continue; }
    if (inEvents && line.startsWith('Format:')) { format = line.replace('Format:', '').split(',').map(s => s.trim()); continue; }
    if (inEvents && line.startsWith('Dialogue:')) {
      const vals = line.replace('Dialogue:', '').split(',');
      const obj = {};
      format.forEach((k, i) => { obj[k] = (vals[i] || '').trim(); });
      const txt = (obj.Text || '').replace(/\{[^}]*\}/g, '').replace(/\\N/g, ' ').trim();
      if (txt) segments.push({ id: `${obj.Start}_${obj.End}`, start: obj.Start, end: obj.End, original: txt, startSec: timeToSec(obj.Start) });
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
    const txt = lines.slice(2).join(' ').replace(/<[^>]*>/g, '').trim();
    if (txt && start) segments.push({ id: `seg_${segments.length}`, start, end, original: txt, startSec: timeToSec(start) });
  }
  return segments;
}

function timeToSec(t) {
  if (!t) return 0;
  const parts = t.replace(',', '.').split(':');
  if (parts.length === 3) return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  return 0;
}

export default function ProjectEditor({ episode, series, profile, onBack }) {
  const [segments, setSegments] = useState([]);
  const [translations, setTranslations] = useState({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [users, setUsers] = useState([]);
  const [showCheckerModal, setShowCheckerModal] = useState(false);
  const [showEncodingModal, setShowEncodingModal] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendSuccess, setSendSuccess] = useState('');
  const videoRef = useRef(null);

  useEffect(() => {
    if (!episode.assUrl) return;
    fetch(episode.assUrl)
      .then(r => r.text())
      .then(text => {
        const segs = episode.assUrl.toLowerCase().includes('.ass') ? parseASS(text) : parseSRT(text);
        setSegments(segs);
      })
      .catch(() => setSegments([]));
  }, [episode.assUrl]);

  useEffect(() => {
    const unsub = getSegments(episode.id, setTranslations);
    return unsub;
  }, [episode.id]);

  useEffect(() => { getAllUsers().then(setUsers); }, []);

  const activeSegment = segments[activeIdx];

  const seekTo = (seg) => { if (videoRef.current && seg) videoRef.current.currentTime = seg.startSec; };

  const handleSegmentClick = (idx) => { setActiveIdx(idx); seekTo(segments[idx]); };

  const handleTranslationChange = (val) => {
    if (!activeSegment) return;
    saveSegment(episode.id, activeSegment.id, { original: activeSegment.original, translated: val, translatedBy: auth.currentUser?.uid });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) { if (activeIdx > 0) { setActiveIdx(i => i - 1); seekTo(segments[activeIdx - 1]); } }
      else { if (activeIdx < segments.length - 1) { setActiveIdx(i => i + 1); seekTo(segments[activeIdx + 1]); } }
    }
  };

  const sendEmail = async (templateId, toUser, onSuccess) => {
    setSendLoading(true);
    try {
      await emailjs.send(EMAILJS_SERVICE, templateId, {
        to_name: toUser.name,
        to_email: toUser.email,
        from_name: profile.name,
        project_title: series.title,
        episode: `${episode.number} — ${episode.title}`,
        app_url: APP_URL,
      }, EMAILJS_PUBKEY);
      if (templateId === TEMPLATE_CHECKER) await updateEpisode(episode.id, { status: 'translation_done' });
      else await updateEpisode(episode.id, { status: 'check_done' });
      setSendSuccess('Email inviata!');
      setTimeout(() => setSendSuccess(''), 3000);
      onSuccess();
    } catch (e) { alert('Errore invio email: ' + e.message); }
    setSendLoading(false);
  };

  const completedCount = segments.filter(s => translations[s.id]?.translated?.trim()).length;
  const progress = segments.length > 0 ? Math.round((completedCount / segments.length) * 100) : 0;

  return (
    <div className="editor-layout">
      {/* Player */}
      <div className="editor-player">
        <video ref={videoRef} src={episode.videoUrl} controls style={{ width: '100%', height: '55%', background: '#000', display: 'block' }} />
        <div className="editor-player-info">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, marginBottom: 4 }}>{series.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Ep. {episode.number} — {episode.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>{completedCount}/{segments.length} tradotti ({progress}%)</div>
          <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, marginBottom: 12 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--primary), var(--secondary))', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          {activeSegment && (
            <div style={{ padding: 12, background: 'var(--bg3)', borderRadius: 8, fontSize: 13 }}>
              <div style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 11, marginBottom: 4 }}>{activeSegment.start} → {activeSegment.end}</div>
              <div style={{ color: 'var(--text2)', lineHeight: 1.5 }}>{activeSegment.original}</div>
              {translations[activeSegment.id]?.translated && (
                <div style={{ color: 'var(--text)', marginTop: 6, lineHeight: 1.5 }}>🇮🇹 {translations[activeSegment.id].translated}</div>
              )}
            </div>
          )}
          {sendSuccess && <div style={{ marginTop: 12, padding: 10, background: 'rgba(0,229,160,0.15)', border: '1px solid var(--success)', borderRadius: 8, color: 'var(--success)', fontSize: 13 }}>✅ {sendSuccess}</div>}
        </div>
      </div>

      {/* Segmenti */}
      <div className="editor-segments">
        <div className="editor-header">
          <button className="btn btn-sm btn-outline" onClick={onBack}>← Torna ai progetti</button>
          <div style={{ color: 'var(--text2)', fontSize: 11 }}>Tab = avanti · Shift+Tab = indietro</div>
        </div>

        <div className="segments-list">
          {segments.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
              {episode.assUrl ? 'Caricamento file subtitoli...' : '⚠️ Nessun file .ass/.srt collegato.'}
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
                    placeholder="Scrivi la traduzione in italiano..."
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  t?.translated
                    ? <div className="segment-translated">🇮🇹 {t.translated}</div>
                    : <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>Non tradotto</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="editor-actions">
          <button className="btn btn-sm btn-outline" onClick={() => setShowCheckerModal(true)}>
            ✉️ Traduzione completata → invia al checker
          </button>
          <button className="btn btn-sm btn-success" onClick={() => setShowEncodingModal(true)}>
            ✅ Check completato → invia per encoding
          </button>
          {segments.length > 0 && (
            <button className="btn btn-sm btn-outline" onClick={() => {
              let srt = '';
              segments.forEach((seg, i) => {
                const t = translations[seg.id]?.translated || seg.original;
                srt += `${i + 1}\n${seg.start.replace('.', ',')} --> ${seg.end.replace('.', ',')}\n${t}\n\n`;
              });
              const blob = new Blob([srt], { type: 'text/plain' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `${series.title}_ep${episode.number}_IT.srt`;
              a.click();
            }}>⬇️ Esporta .srt</button>
          )}
        </div>
      </div>

      {showCheckerModal && (
        <SendModal
          title="✉️ Invia al checker"
          users={users.filter(u => u.id !== auth.currentUser?.uid)}
          loading={sendLoading}
          onSend={(user) => sendEmail(TEMPLATE_CHECKER, user, () => setShowCheckerModal(false))}
          onClose={() => setShowCheckerModal(false)}
        />
      )}

      {showEncodingModal && (
        <SendModal
          title="✅ Invia per encoding"
          users={users.filter(u => u.id !== auth.currentUser?.uid)}
          loading={sendLoading}
          onSend={(user) => sendEmail(TEMPLATE_ENCODING, user, () => setShowEncodingModal(false))}
          onClose={() => setShowEncodingModal(false)}
        />
      )}
    </div>
  );
}

function SendModal({ title, users, loading, onSend, onClose }) {
  const [selectedId, setSelectedId] = useState('');
  const selected = users.find(u => u.id === selectedId);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="form-row">
          <label className="label">Seleziona destinatario</label>
          <select className="input-field" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">-- Seleziona --</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annulla</button>
          <button className="btn btn-grad" onClick={() => selected && onSend(selected)} disabled={!selectedId || loading}>
            {loading ? 'Invio...' : 'Invia email'}
          </button>
        </div>
      </div>
    </div>
  );
}
