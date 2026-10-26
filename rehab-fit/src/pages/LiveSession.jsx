import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCamera } from '../hooks/useCamera.js';
import { calculateJointAngles, drawPoseOnCanvas } from '../utils/geometry.js';
import { EXERCISE_CONFIGS, EXERCISE_CATEGORIES, createExerciseAnalyzer } from '../utils/exercises.js';
import { createSession, finalizeSession, saveSession, formatDuration } from '../utils/storage.js';
import './LiveSession.css';

const ANGLE_NAMES = {
  leftElbow: 'L Elbow', rightElbow: 'R Elbow',
  leftShoulder: 'L Shoulder', rightShoulder: 'R Shoulder',
  leftHip: 'L Hip', rightHip: 'R Hip',
  leftKnee: 'L Knee', rightKnee: 'R Knee',
};

export default function LiveSession({ onNavigate, poseDetector, exerciseId, onSessionEnd }) {
  const { videoRef, isActive, error: cameraError, startCamera, stopCamera, switchCamera, facingMode, availableCameras } = useCamera();
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const analyzerRef = useRef(null);
  const sessionRef = useRef(null);
  const startTimeRef = useRef(null);
  const feedbackHistoryRef = useRef([]);
  const angleHistoryRef = useRef({});
  const lastTimestampRef = useRef(0);

  const [phase, setPhase] = useState('idle'); // idle | active | finished
  const [reps, setReps] = useState(0);
  const [holdMs, setHoldMs] = useState(0);
  const [exerciseState, setExerciseState] = useState('—');
  const [feedback, setFeedback] = useState([]);
  const [angles, setAngles] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [detectionStatus, setDetectionStatus] = useState('no-person');
  const [currentAngleLabel, setCurrentAngleLabel] = useState(null);

  const exerciseConfig = EXERCISE_CONFIGS[exerciseId] || EXERCISE_CONFIGS.squat;

  // Timer
  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Detection loop
  const runLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || phase !== 'active') return;

    const ctx = canvas.getContext('2d');
    const now = performance.now();

    // Throttle to ~30fps
    if (now - lastTimestampRef.current < 30) {
      rafRef.current = requestAnimationFrame(runLoop);
      return;
    }
    lastTimestampRef.current = now;

    const w = video.videoWidth || canvas.width;
    const h = video.videoHeight || canvas.height;
    canvas.width = w;
    canvas.height = h;

    // Draw mirrored video frame
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -w, 0, w, h);
    ctx.restore();

    if (!poseDetector.isReady) {
      rafRef.current = requestAnimationFrame(runLoop);
      return;
    }

    const landmarks = poseDetector.detectFromVideo(video, now);

    if (landmarks && landmarks.length >= 33) {
      setDetectionStatus('tracking');
      const computedAngles = calculateJointAngles(landmarks);
      setAngles(computedAngles);

      // Track angle history for stats
      Object.entries(computedAngles).forEach(([key, val]) => {
        if (val !== null) {
          if (!angleHistoryRef.current[key]) angleHistoryRef.current[key] = [];
          angleHistoryRef.current[key].push(val);
        }
      });

      // Run exercise analysis
      if (analyzerRef.current) {
        const result = analyzerRef.current.analyze(landmarks, computedAngles);
        setReps(result.reps);
        setHoldMs(result.holdMs || 0);
        setExerciseState(result.state);
        setCurrentAngleLabel(result.angleLabel);

        if (result.feedback && result.feedback.length > 0) {
          setFeedback(result.feedback.slice(-3));
          feedbackHistoryRef.current.push(...result.feedback);
        }
      }

      // Draw skeleton with exercise-specific landmark highlights
      drawPoseOnCanvas(ctx, landmarks, w, h, {
        highlightIndices: analyzerRef.current?.highlightIndices ||
          (EXERCISE_CONFIGS[exerciseId]?.highlightIndices || []),
      });
    } else {
      setDetectionStatus('no-person');
    }

    rafRef.current = requestAnimationFrame(runLoop);
  }, [phase, poseDetector, exerciseId, videoRef]);

  useEffect(() => {
    if (phase === 'active') {
      rafRef.current = requestAnimationFrame(runLoop);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, runLoop]);

  const handleStart = async () => {
    const ok = await startCamera(facingMode);
    if (!ok) return;

    analyzerRef.current = createExerciseAnalyzer(exerciseId);
    sessionRef.current = createSession(exerciseId, exerciseConfig.name);
    startTimeRef.current = Date.now();
    feedbackHistoryRef.current = [];
    angleHistoryRef.current = {};
    setReps(0);
    setHoldMs(0);
    setFeedback([]);
    setAngles({});
    setElapsed(0);
    setPhase('active');
  };

  const handleStop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stopCamera();

    const durationSec = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    const finalReps = analyzerRef.current?.reps || 0;

    // Compute angle stats
    const angleStats = {};
    Object.entries(angleHistoryRef.current).forEach(([key, vals]) => {
      if (vals.length > 0) {
        angleStats[key] = {
          min: Math.min(...vals),
          max: Math.max(...vals),
          avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
          samples: vals.length,
        };
      }
    });

    const session = finalizeSession(
      sessionRef.current,
      finalReps,
      durationSec,
      feedbackHistoryRef.current.slice(0, 20),
      angleStats,
    );

    saveSession(session);
    setPhase('finished');

    if (onSessionEnd) onSessionEnd(session);
  }, [stopCamera, onSessionEnd]);

  return (
    <div className="page live-page">
      <div className="live-header">
        <div>
          <h1>{exerciseConfig.icon} {exerciseConfig.name}</h1>
          <p>{exerciseConfig.instructions}</p>
        </div>
        <div className="live-header-actions">
          {phase === 'idle' && (
            <button className="btn btn-primary btn-lg" onClick={handleStart} disabled={poseDetector.isLoading}>
              {poseDetector.isLoading ? 'Loading model…' : 'Start Camera'}
            </button>
          )}
          {phase === 'active' && (
            <button className="btn btn-danger" onClick={handleStop}>
              End Session
            </button>
          )}
          {phase === 'finished' && (
            <>
              <button className="btn btn-secondary" onClick={() => { setPhase('idle'); }}>
                New Session
              </button>
              <button className="btn btn-primary" onClick={() => onNavigate('history')}>
                View Summary
              </button>
            </>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('dashboard')}>
            ← Back
          </button>
        </div>
      </div>

      <div className="live-layout">
        {/* Video panel */}
        <div className="video-panel">
          <div className="video-container" aria-label="Camera feed with pose overlay">
            <video
              ref={videoRef}
              className="live-video"
              autoPlay
              playsInline
              muted
              style={{ display: phase === 'active' ? 'block' : 'none' }}
            />
            <canvas
              ref={canvasRef}
              className="pose-canvas"
              style={{ display: phase === 'active' ? 'block' : 'none' }}
            />

            {phase === 'idle' && (
              <div className="video-placeholder">
                {cameraError === 'HTTPS_REQUIRED' ? (
                  <div className="https-error-panel">
                    <div className="https-error-icon">🔒</div>
                    <div className="https-error-title">HTTPS required for camera access</div>
                    <div className="https-error-body">
                      You're visiting over plain HTTP (<code>{window.location.host}</code>).
                      Browsers block camera access on non-secure LAN connections.
                    </div>
                    <div className="https-fix-steps">
                      <div className="https-fix-option">
                        <span className="fix-badge">Option 1 — Recommended</span>
                        <strong>Restart with HTTPS (self-signed cert)</strong>
                        <p>Stop the server, then run:</p>
                        <code className="fix-code">npm run dev</code>
                        <p>Open <strong>https://</strong>{window.location.hostname}:5173 and click <em>"Advanced → Proceed"</em> to accept the self-signed certificate.</p>
                      </div>
                      <div className="https-fix-option">
                        <span className="fix-badge">Option 2 — localhost only</span>
                        <strong>Use localhost on the same machine</strong>
                        <p>Open <code>http://localhost:5173</code> in the browser on your laptop. Camera works on localhost without HTTPS.</p>
                      </div>
                      <div className="https-fix-option">
                        <span className="fix-badge">Option 3 — Chrome flag (temporary)</span>
                        <strong>Whitelist your LAN IP in Chrome</strong>
                        <p>Go to <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>, add <code>http://{window.location.host}</code>, relaunch Chrome.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="placeholder-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    </div>
                    <div className="placeholder-text">Camera will start when you begin your session</div>
                    {cameraError && (
                      <div className="feedback-item warning" style={{marginTop: '1rem', maxWidth: '36ch'}}>
                        <span className="feedback-icon">⚠</span>
                        {cameraError}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {phase === 'active' && detectionStatus === 'no-person' && (
              <div className="detection-overlay">
                <div className="detection-message">
                  <span>🔍</span>
                  <span>Step into frame — full body should be visible</span>
                </div>
              </div>
            )}

            {/* HUD overlays */}
            {phase === 'active' && (
              <div className="hud">
                <div className="hud-top">
                  <div className={`hud-status ${detectionStatus}`}>
                    <span className="hud-dot" />
                    {detectionStatus === 'tracking' ? 'Tracking' : 'Searching…'}
                  </div>
                  <div className="hud-timer">{formatDuration(elapsed)}</div>
                </div>
                <div className="hud-bottom">
                  {currentAngleLabel && (
                    <div className="hud-angle">{currentAngleLabel}</div>
                  )}
                  <div className="hud-state">{exerciseState}</div>
                </div>
              </div>
            )}
          </div>

          {/* Camera controls */}
          {phase === 'active' && (
            <div className="camera-controls">
              {availableCameras.length > 1 && (
                <button className="btn btn-secondary btn-sm" onClick={switchCamera}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                  Flip camera
                </button>
              )}
              <div className="badge badge-ready" style={{marginLeft:'auto'}}>
                <div className="badge-dot" />
                {facingMode === 'user' ? 'Front camera' : 'Rear camera'}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="live-sidebar">
          {/* Rep / Hold counter */}
          <div className="card rep-card">
            {exerciseConfig.isHold ? (
              <>
                <div className="rep-label">Hold Time</div>
                <div className="rep-count hold">{(holdMs / 1000).toFixed(1)}<span className="rep-unit">s</span></div>
              </>
            ) : (
              <>
                <div className="rep-label">Repetitions</div>
                <div className="rep-count">{reps}</div>
              </>
            )}
            <div className="rep-state">
              {phase === 'active' ? `State: ${exerciseState}` : phase === 'idle' ? 'Ready to start' : 'Session ended'}
            </div>
          </div>

          {/* Pose status */}
          {poseDetector.isLoading && (
            <div className="card card-sm">
              <div className="loading-inline">
                <div className="spinner" style={{width:20,height:20,borderWidth:2}} />
                <span>Loading pose model…</span>
              </div>
            </div>
          )}
          {poseDetector.error && (
            <div className="feedback-item warning">
              <span className="feedback-icon">⚠</span>
              <span>Pose model unavailable. Rep counting requires browser camera support. {poseDetector.error}</span>
            </div>
          )}

          {/* Live feedback */}
          {phase === 'active' && (
            <div className="card card-sm">
              <h3 style={{marginBottom:'0.75rem', fontSize:'0.875rem', color:'var(--text-secondary)', fontWeight:600}}>Form Feedback</h3>
              {feedback.length === 0 ? (
                <div className="feedback-item info">
                  <span className="feedback-icon">ℹ</span>
                  <span>Perform the exercise to receive feedback.</span>
                </div>
              ) : (
                <div className="feedback-list">
                  {feedback.map((f, i) => (
                    <div key={i} className={`feedback-item ${f.type}`}>
                      <span className="feedback-icon">
                        {f.type === 'warning' ? '⚠' : f.type === 'good' ? '✓' : 'ℹ'}
                      </span>
                      <span>{f.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Joint angles */}
          {phase === 'active' && Object.keys(angles).length > 0 && (
            <div className="card card-sm">
              <h3 style={{marginBottom:'0.75rem', fontSize:'0.875rem', color:'var(--text-secondary)', fontWeight:600}}>Joint Angles</h3>
              <div className="angle-grid">
                {Object.entries(ANGLE_NAMES).map(([key, label]) => {
                  const val = angles[key];
                  return (
                    <div key={key} className="angle-item">
                      <div className="angle-name">{label}</div>
                      <div className={`angle-value ${val === null || val === undefined ? 'null' : ''}`}>
                        {val !== null && val !== undefined ? `${val}°` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Instructions when idle */}
          {phase === 'idle' && (
            <div className="card card-sm instructions-card">
              <h3 style={{marginBottom:'0.75rem'}}>Exercise Guide</h3>

              {exerciseConfig.targetJoints && (
                <div style={{marginBottom:'0.75rem'}}>
                  <div style={{fontSize:'0.6875rem',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.3rem'}}>Target joints</div>
                  <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>
                    {exerciseConfig.targetJoints.map(j => (
                      <span key={j} style={{fontSize:'0.75rem',padding:'0.15rem 0.5rem',background:'var(--teal-subtle)',color:'var(--teal)',borderRadius:'100px',border:'1px solid var(--border-strong)'}}>{j}</span>
                    ))}
                  </div>
                </div>
              )}

              {exerciseConfig.cameraGuidance && (
                <div className="feedback-item info" style={{marginBottom:'0.75rem'}}>
                  <span className="feedback-icon">📷</span>
                  <span><strong>Camera:</strong> {exerciseConfig.cameraGuidance}</span>
                </div>
              )}

              <ol className="instructions-list">
                <li>Click <strong>Start Camera</strong> and allow camera access.</li>
                <li style={{color:'var(--teal)'}}>{exerciseConfig.instructions}</li>
                <li>The system tracks your joints and {exerciseConfig.isHold ? 'measures hold duration' : 'counts reps'} automatically.</li>
                <li>Click <strong>End Session</strong> to save your results.</li>
              </ol>
              <div className="disclaimer">
                <strong>Note:</strong> This tool provides general fitness guidance only. Angle thresholds are estimates. Consult a physiotherapist for medical exercise advice.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
