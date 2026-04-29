import React, { useState, useEffect } from 'react';
import { auth, getUserProfile } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';

// Percorsi aggiornati verso la sottocartella /src/pages/
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';
import ProjectEditor from './pages/ProjectEditor.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [currentSeries, setCurrentSeries] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const p = await getUserProfile(u.uid);
        setUser(u); 
        setProfile(p);
      } else { 
        setUser(null); 
        setProfile(null); 
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

  if (currentEpisode) return (
    <ProjectEditor
      episode={currentEpisode}
      series={currentSeries}
      profile={profile}
      onBack={() => { setCurrentEpisode(null); setCurrentSeries(null); }}
    />
  );

  if (profile?.role === 'admin') return (
    <AdminDashboard 
      profile={profile} 
      onOpenEpisode={(ep, ser) => { setCurrentEpisode(ep); setCurrentSeries(ser); }} 
    />
  );

  return (
    <StaffDashboard 
      profile={profile} 
      onOpenEpisode={(ep, ser) => { setCurrentEpisode(ep); setCurrentSeries(ser); }} 
    />
  );
}