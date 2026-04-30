import { initializeApp, getApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDweWOyZa3PWeSjf2LOXcLLAmkkQuDNmRE",
  authDomain: "mydrama-staff.firebaseapp.com",
  projectId: "mydrama-staff",
  storageBucket: "mydrama-staff.firebasestorage.app",
  messagingSenderId: "963783457730",
  appId: "1:963783457730:web:f7a17362f3826b14cbf45b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ── AUTH ─────────────────────────────────────────────────────────────
export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logoutUser = () => signOut(auth);

// Crea utente usando seconda istanza Firebase — non tocca la sessione admin
export const createUser = async (email, password) => {
  let secondApp;
  try { secondApp = getApp('secondary'); }
  catch { secondApp = initializeApp(firebaseConfig, 'secondary'); }
  const secondAuth = getAuth(secondApp);
  const cred = await createUserWithEmailAndPassword(secondAuth, email, password);
  const uid = cred.user.uid;
  await secondAuth.signOut();
  return { uid };
};

// ── USERS ─────────────────────────────────────────────────────────────
export const saveUserProfile = (uid, data) => setDoc(doc(db, 'users', uid), data, { merge: true });
export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
};
export const getAllUsers = async () => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ── SERIES ────────────────────────────────────────────────────────────
export const createSeries = async (data) => {
  const ref = await addDoc(collection(db, 'series'), { ...data, createdAt: Date.now() });
  return ref.id;
};
export const getSeries = (callback) => onSnapshot(collection(db, 'series'), snap => {
  callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});
export const updateSeries = (id, data) => updateDoc(doc(db, 'series', id), data);
export const deleteSeries = (id) => deleteDoc(doc(db, 'series', id));

// ── EPISODES ─────────────────────────────────────────────────────────
export const addEpisode = async (seriesId, data) => {
  const ref = await addDoc(collection(db, 'episodes'), { ...data, seriesId, status: 'pending', createdAt: Date.now() });
  return ref.id;
};
export const getEpisodes = (seriesId, callback) => {
  const q = query(collection(db, 'episodes'), where('seriesId', '==', seriesId));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.number - b.number)));
};
export const updateEpisode = (seriesIdOrEpId, epIdOrData, data) => {
  const epId = data ? epIdOrData : seriesIdOrEpId;
  const epData = data ? data : epIdOrData;
  return updateDoc(doc(db, 'episodes', epId), epData);
};
export const deleteEpisode = (seriesIdOrEpId, epId) => {
  const id = epId || seriesIdOrEpId;
  return deleteDoc(doc(db, 'episodes', id));
};

// ── TRANSLATIONS ──────────────────────────────────────────────────────
export const saveSegment = (seriesIdOrEpId, epIdOrSegId, segIdOrData, dataOrUndef) => {
  let epId, segId, data;
  if (dataOrUndef !== undefined) {
    epId = epIdOrSegId; segId = segIdOrData; data = dataOrUndef;
  } else {
    epId = seriesIdOrEpId; segId = epIdOrSegId; data = segIdOrData;
  }
  return setDoc(doc(db, 'translations', `${epId}_${segId}`), { ...data, episodeId: epId, segmentId: segId, updatedAt: Date.now() }, { merge: true });
};

export const getSegments = (seriesIdOrEpId, epIdOrCallback, callbackOrUndef) => {
  const epId = callbackOrUndef ? epIdOrCallback : seriesIdOrEpId;
  const callback = callbackOrUndef || epIdOrCallback;
  const q = query(collection(db, 'translations'), where('episodeId', '==', epId));
  return onSnapshot(q, snap => {
    const segs = {};
    snap.docs.forEach(d => { segs[d.data().segmentId] = d.data(); });
    callback(segs);
  });
};
