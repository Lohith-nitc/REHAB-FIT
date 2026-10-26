import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import LiveSession from './pages/LiveSession.jsx';
import ImageAnalysis from './pages/ImageAnalysis.jsx';
import SessionHistory from './pages/SessionHistory.jsx';
import Nav from './components/Nav.jsx';
import { usePoseDetector } from './hooks/usePoseDetector.js';
import './App.css';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [selectedExercise, setSelectedExercise] = useState('squat');
  const [lastSession, setLastSession] = useState(null);
  const poseDetector = usePoseDetector();

  const navigate = (dest, opts = {}) => {
    if (opts.exercise) setSelectedExercise(opts.exercise);
    setPage(dest);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      <Nav currentPage={page} onNavigate={navigate} />
      <main className="app-main">
        {page === 'dashboard' && (
          <Dashboard
            onNavigate={navigate}
            poseDetector={poseDetector}
            lastSession={lastSession}
          />
        )}
        {page === 'live' && (
          <LiveSession
            onNavigate={navigate}
            poseDetector={poseDetector}
            exerciseId={selectedExercise}
            onSessionEnd={(s) => { setLastSession(s); navigate('history'); }}
          />
        )}
        {page === 'image' && (
          <ImageAnalysis
            onNavigate={navigate}
            poseDetector={poseDetector}
          />
        )}
        {page === 'history' && (
          <SessionHistory
            onNavigate={navigate}
            highlightSession={lastSession}
          />
        )}
      </main>
    </div>
  );
}
