import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { EXERCISE_CONFIGS, EXERCISE_CATEGORIES } from '../utils/exercises.js';
import { getTotals, loadSessions, formatDate, formatDuration } from '../utils/storage.js';

const ALL_EXERCISES = Object.values(EXERCISE_CONFIGS);

export default function Dashboard({ onNavigate, poseDetector }) {
  const [selectedExercise, setSelectedExercise] = useState('squat');
  const [totals, setTotals] = useState({ totalSessions: 0, totalReps: 0, totalDurationSec: 0 });
  const [recentSessions, setRecentSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    setTotals(getTotals());
    setRecentSessions(loadSessions().slice(0, 5));
  }, []);

  const { isLoading, error, isReady } = poseDetector;
  const poseStatus = isLoading ? 'loading' : error ? 'error' : isReady ? 'ready' : 'unknown';

  const filtered = ALL_EXERCISES.filter(ex => {
    const matchCat = activeCategory === 'all' || ex.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || ex.name.toLowerCase().includes(q) ||
      ex.description.toLowerCase().includes(q) ||
      ex.targetJoints?.some(j => j.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const selectedConfig = EXERCISE_CONFIGS[selectedExercise];

  return (
    <div className="page">
      {/* Hero */}
      <div className="dashboard-hero">
        <div className="hero-text">
          <div className="hero-eyebrow">AI-Assisted Physiotherapy</div>
          <h1>Train smarter.<br />Move better.</h1>
          <p>25 exercises with real-time pose analysis, joint-angle tracking, and form feedback — running in your browser.</p>
          <div className="hero-status">
            {poseStatus === 'loading' && <div className="badge badge-loading"><div className="badge-dot" style={{ animation: 'pulse 1.5s infinite' }} />Loading pose model…</div>}
            {poseStatus === 'ready' && <div className="badge badge-ready"><div className="badge-dot" />Pose detection ready</div>}
            {poseStatus === 'error' && <div className="badge badge-error"><div className="badge-dot" />Pose detection unavailable</div>}
          </div>
          {poseStatus === 'error' && (
            <div className="error-box" style={{ marginTop: '1rem' }}>
              <strong>Detection issue:</strong> {poseDetector.error}
              <br /><small>Camera preview will still work; angle calculations require a supported browser.</small>
            </div>
          )}
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" onClick={() => onNavigate('live', { exercise: selectedExercise })}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
            Start Live Session
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => onNavigate('image')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            Analyze Image / Video
          </button>
        </div>
      </div>

      <div className="divider" />

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card"><div className="stat-label">Sessions</div><div className="stat-value teal">{totals.totalSessions}</div></div>
        <div className="stat-card"><div className="stat-label">Total reps</div><div className="stat-value">{totals.totalReps.toLocaleString()}</div></div>
        <div className="stat-card"><div className="stat-label">Active time</div><div className="stat-value">{formatDuration(totals.totalDurationSec)}</div></div>
        <div className="stat-card"><div className="stat-label">Exercises</div><div className="stat-value">25</div></div>
      </div>

      {/* Exercise library + recent sessions */}
      <div className="dashboard-main">
        {/* Library */}
        <div className="library-panel">
          <div className="library-header">
            <h2>Exercise Library</h2>
            <span className="library-count">{filtered.length} exercises</span>
          </div>

          {/* Search */}
          <div className="search-bar">
            <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              className="search-input"
              type="text"
              placeholder="Search exercises, joints…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>}
          </div>

          {/* Category tabs */}
          <div className="category-tabs">
            <button className={`cat-tab${activeCategory === 'all' ? ' active' : ''}`} onClick={() => setActiveCategory('all')}>All</button>
            {Object.entries(EXERCISE_CATEGORIES).map(([id, cat]) => (
              <button key={id} className={`cat-tab${activeCategory === id ? ' active' : ''}`} style={activeCategory === id ? { '--cat-color': cat.color } : {}} onClick={() => setActiveCategory(id)}>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Exercise list */}
          <div className="exercise-list">
            {filtered.length === 0 && (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-icon">🔍</div>
                <p>No exercises match "{searchQuery}"</p>
              </div>
            )}
            {filtered.map(ex => (
              <button
                key={ex.id}
                className={`exercise-list-item${selectedExercise === ex.id ? ' selected' : ''}`}
                onClick={() => setSelectedExercise(ex.id)}
              >
                <span className="ex-icon">{ex.icon}</span>
                <div className="ex-info">
                  <div className="ex-name">{ex.name}</div>
                  <div className="ex-meta">
                    <span className="ex-cat-badge" style={{ '--cat-color': EXERCISE_CATEGORIES[ex.category]?.color }}>
                      {EXERCISE_CATEGORIES[ex.category]?.label}
                    </span>
                    {ex.isHold && <span className="ex-hold-badge">Hold</span>}
                  </div>
                </div>
                {selectedExercise === ex.id && (
                  <svg className="ex-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right panel: detail + recent */}
        <div className="right-panel">
          {/* Exercise detail card */}
          {selectedConfig && (
            <div className="exercise-detail-card">
              <div className="detail-top">
                <span className="detail-icon">{selectedConfig.icon}</span>
                <div>
                  <div className="detail-name">{selectedConfig.name}</div>
                  <span className="ex-cat-badge" style={{ '--cat-color': EXERCISE_CATEGORIES[selectedConfig.category]?.color }}>
                    {EXERCISE_CATEGORIES[selectedConfig.category]?.label}
                  </span>
                  {selectedConfig.isHold && <span className="ex-hold-badge" style={{ marginLeft: '0.4rem' }}>Hold-based</span>}
                </div>
              </div>

              <p style={{ fontSize: '0.9rem', marginBottom: '0.875rem' }}>{selectedConfig.description}</p>

              <div className="detail-row">
                <span className="detail-key">Instructions</span>
                <span className="detail-val">{selectedConfig.instructions}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Camera position</span>
                <span className="detail-val">{selectedConfig.cameraGuidance}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Target joints</span>
                <span className="detail-val">{selectedConfig.targetJoints?.join(', ')}</span>
              </div>

              <button
                className="btn btn-primary"
                style={{ marginTop: '1rem', width: '100%' }}
                onClick={() => onNavigate('live', { exercise: selectedConfig.id })}
              >
                Start {selectedConfig.name}
              </button>
            </div>
          )}

          {/* Recent sessions */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
              <h3>Recent sessions</h3>
              {recentSessions.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('history')}>View all</button>}
            </div>
            {recentSessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>No sessions yet. Start your first session above.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentSessions.map(s => (
                  <div key={s.id} className="session-row">
                    <span className="session-exercise-icon">{EXERCISE_CONFIGS[s.exerciseId]?.icon || '🏃'}</span>
                    <div className="session-row-info">
                      <div className="session-row-name">{s.exerciseName}</div>
                      <div className="session-row-meta">{formatDate(s.startTime)}</div>
                    </div>
                    <div className="session-row-stats">
                      <span>{s.reps} {EXERCISE_CONFIGS[s.exerciseId]?.isHold ? 'hold' : 'reps'}</span>
                      <span className="text-muted">{formatDuration(s.durationSec)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
