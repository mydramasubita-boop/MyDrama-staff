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
      const txt = (obj.Text || '').replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n').trim();
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
    const txt = lines.slice(2).join('\n').replace(/<[^>]*>/g, '').trim();
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

// Converte tag ASS in HTML per visualizzazione
function assToHtml(text) {
  if (!text) return '';
  return text
    .replace(/\{\\b1\}/g, '<b>').replace(/\{\\b0\}/g, '</b>')
    .replace(/\{\\i1\}/g, '<i>').replace(/\{\\i0\}/g, '</i>')
    .replace(/\{\\u1\}/g, '<u>').replace(/\{\\u0\}/g, '</u>')
    .replace(/\{\\s1\}/g, '<s>').replace(/\{\\s0\}/g, '</s>')
    .replace(/\\N/g, '<br>').replace(/\n/g, '<br>');
}

function SubText({ text }) {
  if (!text) return null;
  return <span dangerouslySetInnerHTML={{ __html: assToHtml(text) }} />;
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
  const [currentSubtitles, setCurrentSubtitles] = useState([]); // array per righe sovrapposte
  const [darkMode, setDarkMode] = useState(true);
  const [fontSize, setFontSize] = useState(14); // font size pannello traduzione
  const videoRef = useRef(null);
  const activeSegRef = useRef(null);
  const isFreePlaying = useRef(false);

  // Colori tema
  const theme = darkMode ? {
    bg: '#0f0f1a', card: '#1a1a2e', text: '#e8e8f0', text2: '#888899',
    border: 'rgba(255,20,147,0.2)', inputBg: '#0f0f1a', segBg: '#161625',
  } : {
    bg: '#f0f0f5', card: '#ffffff', text: '#1a1a2e', text2: '#555566',
    border: 'rgba(139,0,139,0.25)', inputBg: '#ffffff', segBg: '#f8f8fc',
  };

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => { isFreePlaying.current = true; };
    const onPause = () => { isFreePlaying.current = false; };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => { video.removeEventListener('play', onPlay); video.removeEventListener('pause', onPause); };
  }, []);

  // Sincronizza sub al video — supporta righe sovrapposte
  useEffect(() => {
    const video = videoRef.current;
    if (!video || segments.length === 0) return;
    const onTimeUpdate = () => {
      if (!isFreePlaying.current) return;
      const ct = video.currentTime;
      const active = segments.filter(seg => {
        const end = timeToSec(translations[seg.id]?.timingEnd || seg.end);
        return ct >= seg.startSec && ct <= end;
      });
      setCurrentSubtitles(active.map(seg => translations[seg.id]?.translated || '').filter(Boolean));
      if (active.length > 0) {
        const idx = segments.indexOf(active[active.length - 1]);
        setActiveIdx(idx);
      }
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [segments, translations]);

  const selectSegment = (idx) => {
    if (idx < 0 || idx >= segments.length) return;
    isFreePlaying.current = false;
    if (videoRef.current) videoRef.current.pause();
    setActiveIdx(idx);
    setEditTiming({});
    const seg = segments[idx];
    if (videoRef.current && seg) videoRef.current.currentTime = seg.startSec;
    const t = translations[seg?.id];
    setCurrentSubtitles(t?.translated ? [t.translated] : []);
    setTimeout(() => activeSegRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const handleTranslationChange = (val) => {
    const seg = segments[activeIdx];
    if (!seg) return;
    setCurrentSubtitles(val ? [val] : []);
    saveSegment(episode.id, seg.id, { original: seg.original, translated: val, translatedBy: auth.currentUser?.uid });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); selectSegment(activeIdx + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); selectSegment(activeIdx - 1); }
  };

  const saveTimingEdit = (seg) => {
    if (!editTiming.start && !editTiming.end) return;
    saveSegment(episode.id, seg.id, {
      original: seg.original,
      translated: translations[seg.id]?.translated || '',
      timingStart: editTiming.start || seg.start,
      timingEnd: editTiming.end || seg.end,
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
      await emailjs.send(EMAILJS_SERVICE, isChecker ? TEMPLATE_CHECKER : TEMPLATE_ENCODING, {
        to_email: isChecker ? recipient.email : auth.currentUser?.email,
        to_name: isChecker ? recipient.name : 'Admin',
        from_name: profile.name,
        project_title: series.title, episode: episode.number, app_url: APP_URL,
      }, EMAILJS_PUBLIC_KEY);
      await updateEpisode(episode.id, { status: isChecker ? 'translation_done' : 'check_done' });
      setSendResult('✅ Notifica inviata!');
      setTimeout(() => { setShowSendModal(false); setSendResult(''); }, 1500);
    } catch (e) { setSendResult('❌ Errore: ' + (e.text || e.message)); }
    setSending(false);
  };

  const exportSRT = () => {
    let srt = '';
    segments.forEach((seg, i) => {
      const t = translations[seg.id];
      const startSRT = (t?.timingStart || seg.start).replace('.', ',');
      const endSRT = (t?.timingEnd || seg.end || '').replace('.', ',');
      srt += `${i + 1}\n${startSRT} --> ${endSRT}\n${t?.translated || ''}\n\n`;
    });
    const blob = new Blob([srt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${series.title}_ep${episode.number}_IT.srt`;
    a.click();
  };

  const completedCount = segments.filter(s => translations[s.id]?.translated?.trim()).length;
  const progress = segments.length > 0 ? Math.round((completedCount / segments.length) * 100) : 0;

  return (
    <div className="editor-layout" style={{ background: theme.bg }}>
      {/* ── PLAYER ── */}
      <div className="editor-player" style={{ background: theme.bg }}>
        <div style={{ position: 'relative', height: '55%', background: '#000' }}>
          {episode.videoUrl ? (
            <video ref={videoRef} src={episode.videoUrl} controls style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Nessun video collegato</div>
          )}
          {/* Overlay sottotitoli — supporta righe sovrapposte */}
          {currentSubtitles.length > 0 && (
            <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', padding: '0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {currentSubtitles.map((sub, i) => (
                <div key={i} style={{ display: 'inline-block', background: 'rgba(0,0,0,0.78)', color: 'white', fontSize: 16, fontWeight: 'bold', padding: '4px 14px', borderRadius: 6, textShadow: '1px 1px 2px #000', maxWidth: '90%', lineHeight: 1.4 }}>
                  <SubText text={sub} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="editor-player-info" style={{ background: theme.card, borderTop: `1px solid ${theme.border}` }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, marginBottom: 4, color: theme.text }}>{series.title}</div>
          <div style={{ fontSize: 12, color: theme.text2, marginBottom: 12 }}>Episodio {episode.number}{episode.title ? ` — ${episode.title}` : ''}</div>
          <div style={{ fontSize: 12, color: theme.text2, marginBottom: 8 }}>{completedCount}/{segments.length} tradotti ({progress}%)</div>
          <div style={{ height: 4, background: darkMode ? 'var(--bg3)' : '#ddd', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--primary), var(--secondary))', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* ── SEGMENTI ── */}
      <div className="editor-segments" style={{ background: theme.bg, borderLeft: `1px solid ${theme.border}` }}>
        <div className="editor-header" style={{ background: theme.card, borderBottom: `1px solid ${theme.border}` }}>
          <button className="btn btn-sm btn-outline" onClick={onBack}>← Torna ai progetti</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Font size */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="btn btn-sm btn-outline" style={{ padding: '4px 10px', fontSize: 14 }} onClick={() => setFontSize(f => Math.max(10, f - 1))}>A−</button>
              <span style={{ fontSize: 11, color: theme.text2 }}>{fontSize}px</span>
              <button className="btn btn-sm btn-outline" style={{ padding: '4px 10px', fontSize: 14 }} onClick={() => setFontSize(f => Math.min(24, f + 1))}>A+</button>
            </div>
            {/* Dark/Light mode */}
            <button className="btn btn-sm btn-outline" onClick={() => setDarkMode(d => !d)} style={{ fontSize: 16 }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        <div className="segments-list" style={{ background: theme.bg }}>
          {segments.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: theme.text2 }}>
              {episode.assUrl ? 'Caricamento file in corso...' : 'Nessun file .ass/.srt collegato.'}
            </div>
          )}
          {segments.map((seg, idx) => {
            const t = translations[seg.id];
            const isActive = idx === activeIdx;
            return (
              <div key={seg.id} ref={isActive ? activeSegRef : null}
                style={{
                  background: isActive ? (darkMode ? 'rgba(255,20,147,0.07)' : 'rgba(139,0,139,0.06)') : theme.segBg,
                  border: `1px solid ${isActive ? 'var(--primary)' : theme.border}`,
                  borderRadius: 12, padding: 16, cursor: 'pointer', marginBottom: 8,
                }}
                onClick={() => selectSegment(idx)}>
                <div style={{ fontFamily: 'monospace', fontSize: fontSize - 2, color: 'var(--primary)', marginBottom: 8 }}>
                  {t?.timingStart || seg.start} → {t?.timingEnd || seg.end}
                </div>
                <div style={{ fontSize: fontSize, color: theme.text2, marginBottom: 10, lineHeight: 1.5 }}>
                  <SubText text={seg.original} />
                </div>
                {isActive ? (
                  <div>
                    <textarea
                      style={{ width: '100%', padding: '10px 12px', background: theme.inputBg, border: `1px solid var(--primary)`, borderRadius: 8, color: theme.text, fontFamily: 'var(--font-body)', fontSize: fontSize, outline: 'none', resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
                      value={t?.translated || ''}
                      onChange={e => handleTranslationChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onClick={e => e.stopPropagation()}
                      placeholder="Scrivi la traduzione italiana..."
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                      <span style={{ fontSize: 10, color: theme.text2, minWidth: 24 }}>IN</span>
                      <input style={{ flex: 1, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace', background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, outline: 'none' }}
                        value={editTiming.start !== undefined ? editTiming.start : (t?.timingStart || seg.start)}
                        onChange={e => setEditTiming(p => ({ ...p, start: e.target.value }))} />
                      <span style={{ fontSize: 10, color: theme.text2, minWidth: 28 }}>OUT</span>
                      <input style={{ flex: 1, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace', background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, outline: 'none' }}
                        value={editTiming.end !== undefined ? editTiming.end : (t?.timingEnd || seg.end)}
                        onChange={e => setEditTiming(p => ({ ...p, end: e.target.value }))} />
                      <button className="btn btn-sm btn-outline" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => saveTimingEdit(seg)}>💾</button>
                    </div>
                  </div>
                ) : (
                  t?.translated
                    ? <div style={{ fontSize: fontSize, color: theme.text, lineHeight: 1.5 }}>🇮🇹 <SubText text={t.translated} /></div>
                    : <div style={{ fontSize: fontSize - 2, color: 'rgba(128,128,128,0.4)', fontStyle: 'italic' }}>Non tradotto</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="editor-actions" style={{ background: theme.card, borderTop: `1px solid ${theme.border}` }}>
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
            <div className="modal-title">{sendType === 'checker' ? '✉️ Invia al checker' : '✅ Invia per encoding'}</div>
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
