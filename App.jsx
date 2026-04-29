import React, { useState, useEffect } from 'react';
import { auth, getUserProfile } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';
import ProjectEditor from './pages/ProjectEditor.jsx';
import './styles.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const p = await getUserProfile(u.uid);
        setUser(u); setProfile(p);
      } else {
        setUser(null); setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">MyDrama <span>Staff</span></div>
      <div className="spinner" />
    </div>
  );

  if (!user) return <Login onLogin={(u, p) => { setUser(u); setProfile(p); }} />;

  if (currentProject) return (
    <ProjectEditor
      project={currentProject}
      profile={profile}
      onBack={() => setCurrentProject(null)}
    />
  );

  if (profile?.role === 'admin') return (
    <AdminDashboard
      profile={profile}
      onOpenProject={setCurrentProject}
    />
  );

  return (
    <StaffDashboard
      profile={profile}
      onOpenProject={setCurrentProject}
    />
  );
}
