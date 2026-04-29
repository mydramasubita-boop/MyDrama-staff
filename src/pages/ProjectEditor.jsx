import React, { useState, useEffect, useRef } from 'react';
import { saveSegment, getSegments, updateEpisode, getAllUsers } from '../firebase.js';
import { auth } from '../firebase.js';
import emailjs from 'emailjs-com';

const EMAILJS_SERVICE = 'service_4l933ap';
const EMAILJS_PUBLIC_KEY = 'j2smuu518um43TmFj';
const TEMPLATE_CHECKER = 'template_f0d6bhd';
const TEMPLATE_ENCODING = 'template_enf305b';
const APP_URL = 'https://mydramasubita-boop.github.io/MyDrama-staff/';

function parseASS(text) {
  const segments = [];
  const lines = text.split('\n');
  let inEvents = false, format = [];
  for (const line of lines) {
    if (line.trim() === '[Events]') { inEvents = true; continue; }
    if (inEvents && line.startsWith('Format:')) {
      format = line.replace('Format:', '').split(',').map(s => s.trim()); continue;
    }
    if (inEvents && line.startsWith('Dialogue:')) {
      const vals = line.replace('Dialogue:', '').split(',');
      const obj = {};
      format.forEach((k, i) => { obj[k] = (vals[i] || '').trim(); });
      const txt = (obj.Text || '').replace(/\{[^}]*\}/g, '').replace(/\\N/g, ' ').trim();
      if (txt) segments.push({ id: `${obj.Start}_${obj.End}_${segments.length}`, start: obj.Start, end: obj.End, original: txt, startSec: timeToSec(obj.Start) });
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
    const start = times[0]?.trim();
    const end = times[1]?.trim();
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

export default function ProjectEditor({ series, episode, profile, onBack }) {
  const [segments, setSegments] = useState([]);
  const [translations, setTranslations] = useState({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [users, setUsers] = useState([]);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendType, setSendType] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');
  const videoRef = useRef(null);
  const activeSegRef = useRef(null);

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
    const unsub = getSegments(series.id, episode.id, setTranslations);
    return unsub;
  }, [series.id, episode.id]);

  useEffect(() => { getAllUsers().then(setUsers); }, []);

  useEffect(() => {
    if (episode.status === 'pending') updateEpisode(series.id, episode.id, { status: 'translating' });
  }, []);

  const handleSegmentClick = (idx) => {
    setActiveIdx(idx);
    if (videoRef.current && segments[idx]) videoRef.current.currentTime = segments[idx].startSec;
  };

  const handleTranslationChange = (val) => {
    const seg = segments[activeIdx];
    if (!seg) return;
    saveSegment(series.id, episode.id, seg.id, { original: seg.original, translated: val, translatedBy: auth.currentUser?.uid });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = activeIdx + 1;
      if (next < segments.length) {
        setActiveIdx(next);
        if (videoRef.current) videoRef.current.currentTime = segments[next].startSec;
        setTimeout(() => activeSegRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      }
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = activeIdx - 1;
      if (prev >= 0) {
        setActiveIdx(prev);
        if (videoRef.current) videoRef.current.currentTime = segments[prev].startSec;
        setTimeout(() => activeSegRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      }
    }
  };

  const sendNotification = async () => {
    const recipient = users.find(u => u.id === sendTo);
    if (!recipient && sendType === 'checker') return;
    setSending(true); setSendResult('');
    try {
      const isChecker = sendType === 'checker';
      const templateId = isChecker ? TEMPLATE_CHECKER : TEMPLATE_ENCODING;
      const toEmail = isChecker ? recipient.email : auth.currentUser?.email;
      const toName = isChecker ? recipient.name : 'Admin';
      await emailjs.send(EMAILJS_SERVICE, templateId, {
        to_email: toEmail,
        to_name: toName,
        from_name: profile.name,
        project_title: series.title,
        episode: episode.number,
        app_url: APP_URL,
      }, EMAILJS_PUBLIC_KEY);
      await updateEpisode(series.id, episode.id, { status: isChecker ? 'translation_done' : 'check_done' });
      setSendResult('✅ Notifica inviata!');
      setTimeout(() => { setShowSendModal(false); setSendResult(''); }, 1500);
    } catch (e) {
      setSendResult('❌ Errore: ' + (e.text || e.message));
    }
    setSending(false);
  };

  const exportSRT = () => {
    let srt = '';
    segments.forEach((seg, i) => {
      const t = translations[seg.id]?.translated || '';
      const startSRT = seg.start.replace('.', ',');
      const endSRT = (seg.end || '').replace('.', ',');
      srt += `${i + 1}\n${startSRT} --> ${endSRT}\n${t}\n\n`;
    });
    const blob = new Blob([srt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${series.title}_ep${episode.number}_IT.srt`; a.click();
  };

  const completedCount = segments.filter(s => translations[s.id]?.translated?.trim()).length;
  const progress = segments.length > 0 ? Math.round((completedCount / segments.length) * 100) : 0;

  return (
    <div className="editor-layout">
      <div className="editor-player">
        {episode.videoUrl ? (
          <video ref={videoRef} src={episode.videoUrl} controls style={{ width: '100%', height: '55%', background: '#000', display: 'block' }} />
        ) : (
          <div style={{ height: '55%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>Nessun video collegato</div>
        )}
        <div className="editor-player-info">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, marginBottom: 4 }}>{series.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>Episodio {episode.number}{episode.title ? ` — ${episode.title}` : ''}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>{completedCount}/{segments.length} tradotti ({progress}%)</div>
          <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--primary), var(--secondary))', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          {segments[activeIdx] && (
            <div style={{ marginTop: 14, padding: 12, background: 'var(--bg3)', borderRadius: 8 }}>
              <div style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 11, marginBottom: 4 }}>{segments[activeIdx].start} → {segments[activeIdx].end}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{segments[activeIdx].original}</div>
              {translations[segments[activeIdx].id]?.translated && (
                <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 6 }}>🇮🇹 {translations[segments[activeIdx].id].translated}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="editor-segments">
        <div className="editor-header">
          <button className="btn btn-sm btn-outline" onClick={onBack}>← Torna ai progetti</button>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Invio/↓ = successivo • ↑ = precedente</div>
        </div>

        <div className="segments-list">
          {segments.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
              {episode.assUrl ? 'Caricamento file in corso...' : 'Nessun file .ass/.srt collegato.'}
            </div>
          )}
          {segments.map((seg, idx) => {
            const t = translations[seg.id];
            const isActive = idx === activeIdx;
            return (
              <div key={seg.id} ref={isActive ? activeSegRef : null} className={`segment-card ${isActive ? 'active' : ''}`} onClick={() => handleSegmentClick(idx)}>
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
                  t?.translated
                    ? <div className="segment-translated">🇮🇹 {t.translated}</div>
                    : <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Non tradotto</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="editor-actions">
          <button className="btn btn-sm btn-outline" onClick={() => { setSendType('checker'); setSendTo(''); setShowSendModal(true); }}>
            ✉️ Traduzione completata → Invia al checker
          </button>
          <button className="btn btn-sm btn-success" onClick={() => { setSendType('encoding'); setShowSendModal(true); }}>
            ✅ Check completato → Invia per encoding
          </button>
          {segments.length > 0 && (
            <button className="btn btn-sm btn-outline" onClick={exportSRT}>⬇️ Esporta .srt</button>
          )}
        </div>
      </div>

      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {sendType === 'checker' ? '✉️ Invia al checker' : '✅ Invia per encoding'}
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 20 }}>
              {sendType === 'checker'
                ? `La traduzione di ${series.title} Ep.${episode.number} verrà segnalata come completata.`
                : `Il check di ${series.title} Ep.${episode.number} verrà segnalato come completato.`}
            </p>
            {sendType === 'checker' && (
              <div className="form-row">
                <label className="label">Seleziona checker</label>
                <select className="input-field" value={sendTo} onChange={e => setSendTo(e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  {users.filter(u => u.id !== auth.currentUser?.uid).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
            {sendResult && <div style={{ marginTop: 12, textAlign: 'center', fontSize: 14 }}>{sendResult}</div>}
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowSendModal(false)}>Annulla</button>
              <button className="btn btn-grad" onClick={sendNotification} disabled={sending || (sendType === 'checker' && !sendTo)}>
                {sending ? 'Invio...' : 'Invia notifica'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
