import React, { useState, useRef, useCallback } from 'react';
import { calculateJointAngles, drawPoseOnCanvas } from '../utils/geometry.js';
import './ImageAnalysis.css';

const ANGLE_DISPLAY = {
  leftElbow: 'L Elbow', rightElbow: 'R Elbow',
  leftShoulder: 'L Shoulder', rightShoulder: 'R Shoulder',
  leftHip: 'L Hip', rightHip: 'R Hip',
  leftKnee: 'L Knee', rightKnee: 'R Knee',
};

export default function ImageAnalysis({ onNavigate, poseDetector }) {
  const [mode, setMode] = useState('image'); // 'image' | 'video'
  const [status, setStatus] = useState('idle'); // idle | processing | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [angles, setAngles] = useState({});
  const [landmarkCount, setLandmarkCount] = useState(0);
  const [videoFrames, setVideoFrames] = useState([]);

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const processImage = useCallback(async (file) => {
    if (!poseDetector.isReady) {
      setErrorMsg('Pose detection is not ready. Wait for the model to load or check for errors.');
      setStatus('error');
      return;
    }

    setStatus('processing');
    setAngles({});
    setLandmarkCount(0);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;

    img.onload = async () => {
      // Draw image to canvas
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      try {
        const landmarks = await poseDetector.detectFromImage(img);

        if (!landmarks || landmarks.length === 0) {
          setStatus('done');
          setErrorMsg('No person detected in this image. Try a photo with a clearly visible full-body pose.');
          URL.revokeObjectURL(url);
          return;
        }

        const visibleCount = landmarks.filter(lm => !lm.visibility || lm.visibility >= 0.5).length;
        setLandmarkCount(visibleCount);

        const computedAngles = calculateJointAngles(landmarks);
        setAngles(computedAngles);

        drawPoseOnCanvas(ctx, landmarks, canvas.width, canvas.height, { mirrorX: false });
        setStatus('done');
        setErrorMsg('');
      } catch (err) {
        setErrorMsg(`Analysis failed: ${err.message}`);
        setStatus('error');
      }

      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      setErrorMsg('Could not load the image. Try a different file.');
      setStatus('error');
      URL.revokeObjectURL(url);
    };
  }, [poseDetector]);

  const processVideo = useCallback(async (file) => {
    if (!poseDetector.isReady) {
      setErrorMsg('Pose detection is not ready.');
      setStatus('error');
      return;
    }

    setStatus('processing');
    setVideoFrames([]);
    setAngles({});
    setErrorMsg('');

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const sampleCount = Math.min(8, Math.floor(duration));
      const interval = duration / Math.max(sampleCount, 1);

      const frames = [];
      const canvas = canvasRef.current;
      if (!canvas) return;

      for (let i = 0; i < sampleCount; i++) {
        const t = i * interval + interval / 2;
        await seekVideo(video, t);

        const w = video.videoWidth;
        const h = video.videoHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        try {
          const landmarks = await poseDetector.detectFromImage(video);
          if (landmarks && landmarks.length > 0) {
            const computedAngles = calculateJointAngles(landmarks);
            drawPoseOnCanvas(ctx, landmarks, w, h, { mirrorX: false });
            const thumb = canvas.toDataURL('image/jpeg', 0.6);
            frames.push({ time: t, angles: computedAngles, thumb, detected: true });
          } else {
            const thumb = canvas.toDataURL('image/jpeg', 0.6);
            frames.push({ time: t, angles: {}, thumb, detected: false });
          }
        } catch {
          const thumb = canvas.toDataURL('image/jpeg', 0.6);
          frames.push({ time: t, angles: {}, thumb, detected: false });
        }

        setVideoFrames([...frames]);
      }

      // Show last analyzed frame on main canvas
      if (frames.length > 0) {
        const lastGood = frames.slice().reverse().find(f => f.detected);
        if (lastGood) {
          const img = new Image();
          img.onload = () => {
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = lastGood.thumb;
        }
      }

      // Aggregate angles across frames
      const allAngles = {};
      frames.filter(f => f.detected).forEach(f => {
        Object.entries(f.angles).forEach(([k, v]) => {
          if (v !== null) {
            if (!allAngles[k]) allAngles[k] = [];
            allAngles[k].push(v);
          }
        });
      });
      const avgAngles = {};
      Object.entries(allAngles).forEach(([k, vals]) => {
        avgAngles[k] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
      });
      setAngles(avgAngles);
      setStatus('done');
      URL.revokeObjectURL(url);
    };

    video.onerror = () => {
      setErrorMsg('Could not load the video. Try MP4 format.');
      setStatus('error');
      URL.revokeObjectURL(url);
    };
  }, [poseDetector]);

  function seekVideo(video, time) {
    return new Promise((resolve) => {
      video.currentTime = time;
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
      video.addEventListener('seeked', onSeeked);
    });
  }

  const handleFileChange = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'image') processImage(file);
    else processVideo(file);
  };

  const validAngles = Object.entries(angles).filter(([, v]) => v !== null && v !== undefined);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Image &amp; Video Analysis</h1>
        <p>Upload a photo or video to detect body landmarks and calculate joint angles.</p>
      </div>

      {/* Mode switch */}
      <div className="mode-tabs">
        <button
          className={`mode-tab${mode === 'image' ? ' active' : ''}`}
          onClick={() => setMode('image')}
        >
          📷 Image
        </button>
        <button
          className={`mode-tab${mode === 'video' ? ' active' : ''}`}
          onClick={() => setMode('video')}
        >
          🎥 Video
        </button>
      </div>

      {!poseDetector.isReady && !poseDetector.isLoading && (
        <div className="feedback-item warning" style={{marginBottom: '1rem'}}>
          <span className="feedback-icon">⚠</span>
          Pose detection unavailable — analysis requires a supported browser with camera permissions previously granted.
        </div>
      )}

      {poseDetector.isLoading && (
        <div className="card card-sm" style={{marginBottom:'1rem'}}>
          <div className="loading-inline">
            <div className="spinner" style={{width:20,height:20,borderWidth:2}} />
            <span>Loading pose model…</span>
          </div>
        </div>
      )}

      <div className="analysis-layout">
        {/* Upload area */}
        <div className="upload-section">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFileChange(e, 'image')}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFileChange(e, 'video')}
          />

          {mode === 'image' && (
            <div
              className="drop-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f?.type.startsWith('image/')) processImage(f);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <div className="drop-icon">🖼️</div>
              <div className="drop-title">Drop an image here</div>
              <div className="drop-sub">or click to browse — JPG, PNG, WebP</div>
              <button className="btn btn-primary" style={{marginTop:'0.75rem', pointerEvents:'none'}}>
                Choose Image
              </button>
            </div>
          )}

          {mode === 'video' && (
            <div className="drop-zone" onClick={() => videoInputRef.current?.click()} role="button" tabIndex={0}>
              <div className="drop-icon">🎬</div>
              <div className="drop-title">Upload a video for analysis</div>
              <div className="drop-sub">MP4, MOV, WebM — up to 8 frames sampled</div>
              <button className="btn btn-primary" style={{marginTop:'0.75rem', pointerEvents:'none'}}>
                Choose Video
              </button>
            </div>
          )}

          {status === 'processing' && (
            <div className="loading-state" style={{padding:'2rem'}}>
              <div className="spinner" />
              <p>Analyzing {mode === 'video' ? 'video frames' : 'image'}…</p>
            </div>
          )}

          {status === 'error' && errorMsg && (
            <div className="feedback-item warning" style={{marginTop:'1rem'}}>
              <span className="feedback-icon">⚠</span>
              {errorMsg}
            </div>
          )}

          {status === 'done' && !errorMsg && (
            <>
              <div className="analysis-summary">
                <div className="summary-row">
                  <span>Landmarks detected</span>
                  <strong>{landmarkCount > 0 ? `${landmarkCount} / 33` : '—'}</strong>
                </div>
                <div className="summary-row">
                  <span>Angles calculated</span>
                  <strong>{validAngles.length}</strong>
                </div>
              </div>

              {validAngles.length > 0 && (
                <div className="card card-sm" style={{marginTop: '1rem'}}>
                  <h3 style={{marginBottom:'0.75rem', fontSize:'0.875rem', color:'var(--text-secondary)'}}>
                    {mode === 'video' ? 'Average' : 'Detected'} Joint Angles
                  </h3>
                  <div className="angle-grid">
                    {Object.entries(ANGLE_DISPLAY).map(([key, label]) => {
                      const val = angles[key];
                      return (
                        <div key={key} className="angle-item">
                          <div className="angle-name">{label}</div>
                          <div className={`angle-value ${!val ? 'null' : ''}`}>
                            {val ? `${val}°` : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {status === 'done' && errorMsg && (
                <div className="feedback-item info" style={{marginTop:'1rem'}}>
                  <span className="feedback-icon">ℹ</span>
                  {errorMsg}
                </div>
              )}
            </>
          )}
        </div>

        {/* Canvas / result */}
        <div className="result-section">
          <canvas
            ref={canvasRef}
            className="analysis-canvas"
            style={{ display: status === 'done' && !errorMsg ? 'block' : 'none' }}
          />

          {status !== 'done' && (
            <div className="canvas-placeholder">
              <div style={{opacity:0.3, fontSize:'3rem'}}>🦴</div>
              <p>Pose overlay will appear here after analysis</p>
            </div>
          )}

          {/* Video frame strip */}
          {mode === 'video' && videoFrames.length > 0 && (
            <div className="frame-strip">
              <div className="frame-strip-label">Analyzed frames</div>
              <div className="frames">
                {videoFrames.map((f, i) => (
                  <div key={i} className={`frame-thumb${f.detected ? ' detected' : ''}`}>
                    <img src={f.thumb} alt={`Frame at ${f.time.toFixed(1)}s`} />
                    <div className="frame-time">{f.time.toFixed(1)}s</div>
                    {f.detected && <div className="frame-badge">✓</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
