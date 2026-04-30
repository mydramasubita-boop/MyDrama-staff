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
  const [editTiming, setEditTiming] = useState({});
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const videoRef = useRef(null);
  const activeSegRef = useRef(null);
  const segmentEndRef = useRef(null);

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

  useEffect(() => {
    if (episode.status === 'pending') updateEpisode(episode.id, { status: 'translating' });
  }, []);

  // Sincronizza sottotitoli al video durante riproduzione libera (non interferisce con il click)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || segments.length === 0) return;
    const onTimeUpdate = () => {
      if (video.paused) return;
      const ct = video.currentTime;
      // Cerca il segmento corrispondente al tempo corrente
      let found = false;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const start = seg.startSec;
        const end = timeToSec(translations[seg.id]?.timingEnd || seg.end);
        if (ct >= start && ct <= end) {
          const t = translations[seg.id];
          setCurrentSubtitle(t?.translated || '');
          setActiveIdx(i);
          found = true;
          break;
        }
      }
      if (!found) setCurrentSubtitle('');
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [segments, translations]);

  const goToSegment = (idx) => {
    if (idx < 0 || idx >= segments.length) return;
    setActiveIdx(idx);
    setEditTiming({});
    const seg = segments[idx];
    const t = translations[seg?.id];
    // Aggiorna subito il sub visibile
    setCurrentSubtitle(t?.translated || '');
    if (!videoRef.current || !seg) return;
    if (segmentEndRef.current) clearInterval(segmentEndRef.current);
    // Posiziona il video senza farlo partire automaticamente
    videoRef.current.currentTime = seg.startSec;
    // Fai partire e ferma alla fine del segmento
    videoRef.current.play().then(() => {
      segmentEndRef.current = setInterval(() => {
        if (videoRef.current && videoRef.current.currentTime >= timeToSec(translations[seg.id]?.timingEnd || seg.end)) {
          videoRef.current.pause();
          // Ripristina il sub del segmento dopo la pausa
          const tr = translations[seg.id];
          setCurrentSubtitle(tr?.translated || '');
          clearInterval(segmentEndRef.current);
        }
      }, 50);
    }).catch(() => {});
    setTimeout(() => activeSegRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const handleTranslationChange = (val) => {
    const seg = segments[activeIdx];
    if (!seg) return;
    setCurrentSubtitle(val); // aggiorna subito il sub a video mentre scrivi
    saveSegment(episode.id, seg.id, { original: seg.original, translated: val, translatedBy: auth.currentUser?.uid });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); goToSegment(activeIdx + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); goToSegment(activeIdx - 1); }
  };

  const saveTimingEdit = (seg) => {
    const t = editTiming;
    if (!t.start && !t.end) return;
    saveSegment(episode.id, seg.id, {
      original: seg.original,
      translated: translations[seg.id]?.translated || '',
      timingStart: t.start || seg.start,
      timingEnd: t.end || seg.end,
      translatedBy: auth.currentUser?.uid,
    });
    setEditTiming({});
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
        to_email: toEmail, to_name: toName, from_name: profile.name,
        project_title: series.title, episode: episode.number, app_url: APP_URL,
      }, EMAILJS_PUBLIC_KEY);
      await updateEpisode(episode.id, { status: isChecker ? 'translation_done' : 'check_done' });
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
      const t = translations[seg.id];
      const translated = t?.translated || '';
      const startSRT = (t?.timingStart || seg.start).replace('.', ',');
      const endSRT = (t?.timingEnd || seg.end || '').replace('.', ',');
      srt += `${i + 1}\n${startSRT} --> ${endSRT}\n${translated}\n\n`;
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
        <div style={{ position: 'relative', height: '55%', background: '#000' }}>
          {episode.videoUrl ? (
            <video ref={videoRef} src={episode.videoUrl} controls style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>Nessun video collegato</div>
          )}
          {currentSubtitle ? (
            <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', padding: '0 16px' }}>
              <div style={{ display: 'inline-block', background: 'rgba(0,0,0,0.78)', color: 'white', fontSize: 16, fontWeight: 'bold', padding: '6px 14px', borderRadius: 6, textShadow: '1px 1px 2px #000', maxWidth: '90%', lineHeight: 1.4 }}>
                {currentSubtitle}
              </div>
            </div>
          ) : null}
        </div>
        <div className="editor-player-info">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, marginBottom: 4 }}>{series.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>Episodio {episode.number}{episode.title ? ` — ${episode.title}` : ''}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>{completedCount}/{segments.length} tradotti ({progress}%)</div>
          <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--primary), var(--secondary))', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
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
              <div key={seg.id} ref={isActive ? activeSegRef : null} className={`segment-card ${isActive ? 'active' : ''}`} onClick={() => goToSegment(idx)}>
                <div className="segment-time">{t?.timingStart || seg.start} → {t?.timingEnd || seg.end}</div>
                <div className="segment-original">{seg.original}</div>
                {isActive ? (
                  <div>
                    <textarea
                      className="segment-input"
                      value={t?.translated || ''}
                      onChange={e => handleTranslationChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onClick={e => e.stopPropagation()}
                      placeholder="Scrivi la traduzione italiana..."
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--text2)', minWidth: 24 }}>IN</span>
                      <input
                        className="segment-input"
                        style={{ minHeight: 'auto', padding: '4px 8px', fontSize: 12, fontFamily: 'monospace', flex: 1 }}
                        value={editTiming.start !== undefined ? editTiming.start : (t?.timingStart || seg.start)}
                        onChange={e => setEditTiming(p => ({ ...p, start: e.target.value }))}
                      />
                      <span style={{ fontSize: 10, color: 'var(--text2)', minWidth: 28 }}>OUT</span>
                      <input
                        className="segment-input"
                        style={{ minHeight: 'auto', padding: '4px 8px', fontSize: 12, fontFamily: 'monospace', flex: 1 }}
                        value={editTiming.end !== undefined ? editTiming.end : (t?.timingEnd || seg.end)}
                        onChange={e => setEditTiming(p => ({ ...p, end: e.target.value }))}
                      />
                      <button className="btn btn-sm btn-outline" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => saveTimingEdit(seg)}>💾</button>
                    </div>
                  </div>
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
