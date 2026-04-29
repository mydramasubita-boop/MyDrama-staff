import { initializeApp } from 'firebase/app';
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
export const createUser = (email, password) => createUserWithEmailAndPassword(auth, email, password);

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
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.number - b.number)));
};
export const getAllEpisodes = (callback) => onSnapshot(collection(db, 'episodes'), snap => {
  callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});
export const updateEpisode = (id, data) => updateDoc(doc(db, 'episodes', id), data);
export const deleteEpisode = (id) => deleteDoc(doc(db, 'episodes', id));

// ── TRANSLATIONS ──────────────────────────────────────────────────────
export const saveSegment = (episodeId, segmentId, data) =>
  setDoc(doc(db, 'translations', `${episodeId}_${segmentId}`), { ...data, episodeId, segmentId, updatedAt: Date.now() }, { merge: true });
export const getSegments = (episodeId, callback) => {
  const q = query(collection(db, 'translations'), where('episodeId', '==', episodeId));
  return onSnapshot(q, snap => {
    const segs = {};
    snap.docs.forEach(d => { segs[d.data().segmentId] = d.data(); });
    callback(segs);
  });
};
