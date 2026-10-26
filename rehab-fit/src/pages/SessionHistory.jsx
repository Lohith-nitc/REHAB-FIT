import React, { useState, useEffect } from 'react';
import { loadSessions, clearSessions, formatDate, formatDuration, getTotals } from '../utils/storage.js';
import { EXERCISE_CONFIGS } from '../utils/exercises.js';
import './SessionHistory.css';

const ANGLE_NAMES = {
  leftElbow: 'L Elbow', rightElbow: 'R Elbow',
  leftShoulder: 'L Shoulder', rightShoulder: 'R Shoulder',
  leftHip: 'L Hip', rightHip: 'R Hip',
  leftKnee: 'L Knee', rightKnee: 'R Knee',
};

export default function SessionHistory({ onNavigate, highlightSession }) {
  const [sessions, setSessions] = useState([]);
  const [expanded, setExpanded] = useState(highlightSession?.id || null);
  const [totals, setTotals] = useState({ totalSessions: 0, totalReps: 0, totalDurationSec: 0 });

  useEffect(() => {
    const s = loadSessions();
    setSessions(s);
    setTotals(getTotals());
  }, []);

  const handleClear = () => {
    if (window.confirm('Delete all session history? This cannot be undone.')) {
      clearSessions();
      setSessions([]);
      setTotals({ totalSessions: 0, totalReps: 0, totalDurationSec: 0 });
    }
  };

  return (
    <div className="page">
      <div className="page-header" style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem'}}>
        <div>
          <h1>Session History</h1>
          <p>All recorded exercise sessions from this device.</p>
        </div>
        <div style={{display:'flex', gap:'0.75rem', alignItems:'flex-start'}}>
          <button className="btn btn-primary" onClick={() => onNavigate('dashboard')}>
            New Session
          </button>
          {sessions.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleClear}>
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="stat-grid" style={{marginBottom:'2rem'}}>
        <div className="stat-card">
          <div className="stat-label">Sessions completed</div>
          <div className="stat-value teal">{totals.totalSessions}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total repetitions</div>
          <div className="stat-value">{totals.totalReps.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total active time</div>
          <div className="stat-value">{formatDuration(totals.totalDurationSec)}</div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No sessions recorded yet. Complete a live session to see it here.</p>
          <button className="btn btn-primary" style={{marginTop:'1rem'}} onClick={() => onNavigate('live')}>
            Start First Session
          </button>
        </div>
      ) : (
        <div className="history-list">
          {sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              isExpanded={expanded === session.id}
              isHighlighted={highlightSession?.id === session.id}
              onToggle={() => setExpanded(expanded === session.id ? null : session.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, isExpanded, isHighlighted, onToggle }) {
  const config = EXERCISE_CONFIGS[session.exerciseId];
  const hasAngles = session.angleStats && Object.keys(session.angleStats).length > 0;
  const hasFeedback = session.feedbackEvents && session.feedbackEvents.length > 0;

  return (
    <div className={`history-card${isHighlighted ? ' highlighted' : ''}`}>
      <button className="history-card-header" onClick={onToggle}>
        <span className="history-icon">{config?.icon || '🏃'}</span>
        <div className="history-meta">
          <div className="history-name">{session.exerciseName}</div>
          <div className="history-date">{formatDate(session.startTime)}</div>
        </div>
        <div className="history-stats">
          <div className="history-stat">
            <span className="history-stat-value">{session.reps}</span>
            <span className="history-stat-label">reps</span>
          </div>
          <div className="history-stat">
            <span className="history-stat-value">{formatDuration(session.durationSec)}</span>
            <span className="history-stat-label">duration</span>
          </div>
        </div>
        <div className="expand-icon" style={{transform: isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </button>

      {isExpanded && (
        <div className="history-detail">
          <div className="divider" style={{margin:'0 0 1rem'}} />

          {isHighlighted && (
            <div className="badge badge-ready" style={{marginBottom:'1rem'}}>
              <div className="badge-dot" />
              Most recent session
            </div>
          )}

          <div className="detail-grid">
            <div>
              <div className="detail-label">Exercise</div>
              <div className="detail-value">{session.exerciseName}</div>
            </div>
            <div>
              <div className="detail-label">Started</div>
              <div className="detail-value">{formatDate(session.startTime)}</div>
            </div>
            <div>
              <div className="detail-label">Duration</div>
              <div className="detail-value">{formatDuration(session.durationSec)}</div>
            </div>
            <div>
              <div className="detail-label">Repetitions</div>
              <div className="detail-value teal">{session.reps}</div>
            </div>
          </div>

          {/* Angle stats */}
          {hasAngles && (
            <div style={{marginTop:'1.25rem'}}>
              <h4 style={{marginBottom:'0.75rem', color:'var(--text-secondary)', fontWeight:600}}>Joint Angle Range</h4>
              <div className="angle-stat-grid">
                {Object.entries(session.angleStats).map(([key, stat]) => (
                  <div key={key} className="angle-stat-card">
                    <div className="angle-stat-name">{ANGLE_NAMES[key] || key}</div>
                    <div className="angle-stat-row">
                      <span className="angle-stat-label">Min</span>
                      <span className="angle-stat-val">{stat.min}°</span>
                    </div>
                    <div className="angle-stat-row">
                      <span className="angle-stat-label">Max</span>
                      <span className="angle-stat-val">{stat.max}°</span>
                    </div>
                    <div className="angle-stat-row">
                      <span className="angle-stat-label">Avg</span>
                      <span className="angle-stat-val teal">{stat.avg}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback events */}
          {hasFeedback && (
            <div style={{marginTop:'1.25rem'}}>
              <h4 style={{marginBottom:'0.75rem', color:'var(--text-secondary)', fontWeight:600}}>
                Form Feedback ({session.feedbackEvents.length} events)
              </h4>
              <div className="feedback-list">
                {session.feedbackEvents.slice(0, 5).map((f, i) => (
                  <div key={i} className={`feedback-item ${f.type || 'info'}`}>
                    <span className="feedback-icon">
                      {f.type === 'warning' ? '⚠' : 'ℹ'}
                    </span>
                    <span>{f.message}</span>
                  </div>
                ))}
                {session.feedbackEvents.length > 5 && (
                  <div className="text-muted" style={{fontSize:'0.8rem', paddingLeft:'0.5rem'}}>
                    +{session.feedbackEvents.length - 5} more events
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="disclaimer" style={{marginTop:'1.25rem'}}>
            Measurements are based on 2D pose landmarks. They reflect observed motion patterns and are not diagnostic measurements.
          </div>
        </div>
      )}
    </div>
  );
}
