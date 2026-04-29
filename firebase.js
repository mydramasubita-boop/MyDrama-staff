import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
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

// ── PROJECTS ──────────────────────────────────────────────────────────
export const createProject = (data) => {
  const ref = doc(collection(db, 'projects'));
  return setDoc(ref, { ...data, id: ref.id, createdAt: Date.now(), status: 'in_progress' });
};
export const getProjects = (callback) => {
  return onSnapshot(collection(db, 'projects'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};
export const updateProject = (id, data) => updateDoc(doc(db, 'projects', id), data);
export const deleteProject = (id) => deleteDoc(doc(db, 'projects', id));

// ── TRANSLATIONS ──────────────────────────────────────────────────────
export const saveSegment = (projectId, segmentId, data) =>
  setDoc(doc(db, 'translations', `${projectId}_${segmentId}`), { ...data, projectId, segmentId, updatedAt: Date.now() }, { merge: true });

export const getSegments = (projectId, callback) => {
  const q = query(collection(db, 'translations'), where('projectId', '==', projectId));
  return onSnapshot(q, snap => {
    const segs = {};
    snap.docs.forEach(d => { segs[d.data().segmentId] = d.data(); });
    callback(segs);
  });
};
