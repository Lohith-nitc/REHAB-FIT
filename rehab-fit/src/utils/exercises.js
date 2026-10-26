/**
 * REHAB-FIT Exercise Analyzers — 25 exercises
 *
 * Each analyzer class implements:
 *   analyze(landmarks, angles) → ExerciseResult
 *   reset()
 *
 * ExerciseResult shape:
 *   { reps, holdMs, state, feedback[], highlightIndices[], angleLabel, canCount }
 *
 * Hold-based exercises (plank, single-leg balance, bird-dog, dead bug) return
 * holdMs instead of incrementing reps. The UI reads whichever is non-zero.
 *
 * DISCLAIMER: All thresholds are derived from general biomechanical literature
 * and are suitable for general fitness guidance only. They are not diagnostic.
 */

import { LANDMARKS, isVisible, angleBetweenPoints } from './geometry.js';

const L = LANDMARKS;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function avg(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined);
  if (!valid.length) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

function makeResult(overrides = {}) {
  return {
    reps: 0,
    holdMs: 0,
    state: 'waiting',
    feedback: [],
    highlightIndices: [],
    angleLabel: null,
    canCount: false,
    ...overrides,
  };
}

// ─── 1. Squat ─────────────────────────────────────────────────────────────────

export class SquatAnalyzer {
  constructor(t = {}) {
    this.t = { kneeDownAngle: t.kneeDownAngle ?? 100, kneeUpAngle: t.kneeUpAngle ?? 160 };
    this.reset();
  }
  reset() { this.reps = 0; this.state = 'up'; this.lastFeedbackRep = -1; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_HIP,L.LEFT_KNEE,L.LEFT_ANKLE,L.RIGHT_HIP,L.RIGHT_KNEE,L.RIGHT_ANKLE] });
    const lv = isVisible(landmarks[L.LEFT_KNEE]) && isVisible(landmarks[L.LEFT_HIP]) && isVisible(landmarks[L.LEFT_ANKLE]);
    const rv = isVisible(landmarks[L.RIGHT_KNEE]) && isVisible(landmarks[L.RIGHT_HIP]) && isVisible(landmarks[L.RIGHT_ANKLE]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show full body — hips, knees, and ankles needed.' }); return r; }
    r.canCount = true;
    const kneeAng = avg([angles.leftKnee, angles.rightKnee]);
    if (kneeAng === null) return r;
    r.angleLabel = `Knee: ${Math.round(kneeAng)}°`;
    if (this.state === 'up' && kneeAng < this.t.kneeDownAngle) this.state = 'down';
    else if (this.state === 'down' && kneeAng > this.t.kneeUpAngle) { this.state = 'up'; this.reps++; }
    r.reps = this.reps; r.state = this.state;
    if (this.reps !== this.lastFeedbackRep) {
      if (this.state === 'down' && kneeAng > 120) r.feedback.push({ type:'info', message:`Knee angle ${Math.round(kneeAng)}° — aim for ~90° for full depth.` });
      const lk = landmarks[L.LEFT_KNEE], lh = landmarks[L.LEFT_HIP], la = landmarks[L.LEFT_ANKLE];
      if (lk && lh && la && isVisible(lk) && isVisible(lh) && isVisible(la) && this.state === 'down') {
        const d1 = lk.x - lh.x, d2 = la.x - lk.x;
        if (Math.abs(d1) > 0.06 && Math.sign(d1) !== Math.sign(d2))
          r.feedback.push({ type:'warning', message:'Left knee tracking inward — push it over your second toe.' });
      }
      this.lastFeedbackRep = this.reps;
    }
    return r;
  }
}

// ─── 2. Lunge ─────────────────────────────────────────────────────────────────

export class LungeAnalyzer {
  constructor(t = {}) {
    this.t = { kneeDownAngle: t.kneeDownAngle ?? 100, kneeUpAngle: t.kneeUpAngle ?? 165 };
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'up'; this.rightState = 'up'; this.leftReps = 0; this.rightReps = 0; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_HIP,L.LEFT_KNEE,L.LEFT_ANKLE,L.RIGHT_HIP,L.RIGHT_KNEE,L.RIGHT_ANKLE] });
    const lv = isVisible(landmarks[L.LEFT_KNEE]) && isVisible(landmarks[L.LEFT_HIP]);
    const rv = isVisible(landmarks[L.RIGHT_KNEE]) && isVisible(landmarks[L.RIGHT_HIP]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show hips and knees in frame for lunge detection.' }); return r; }
    r.canCount = true;
    const labels = [];
    if (lv && angles.leftKnee !== null) {
      const a = angles.leftKnee; labels.push(`L:${a}°`);
      if (this.leftState === 'up' && a < this.t.kneeDownAngle) this.leftState = 'down';
      else if (this.leftState === 'down' && a > this.t.kneeUpAngle) { this.leftState = 'up'; this.leftReps++; }
    }
    if (rv && angles.rightKnee !== null) {
      const a = angles.rightKnee; labels.push(`R:${a}°`);
      if (this.rightState === 'up' && a < this.t.kneeDownAngle) this.rightState = 'down';
      else if (this.rightState === 'down' && a > this.t.kneeUpAngle) { this.rightState = 'up'; this.rightReps++; }
    }
    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`; r.angleLabel = labels.join(' | ');
    return r;
  }
}

// ─── 3. Calf Raise ────────────────────────────────────────────────────────────

export class CalfRaiseAnalyzer {
  constructor(t = {}) {
    this.t = { riseThreshold: t.riseThreshold ?? 0.03, dropThreshold: t.dropThreshold ?? 0.01 };
    this.reset();
  }
  reset() { this.reps = 0; this.state = 'down'; this.baseAnkleY = null; this.peakY = null; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_ANKLE,L.RIGHT_ANKLE,L.LEFT_HEEL,L.RIGHT_HEEL,L.LEFT_FOOT_INDEX,L.RIGHT_FOOT_INDEX] });
    const lAnkle = landmarks[L.LEFT_ANKLE], rAnkle = landmarks[L.RIGHT_ANKLE];
    if (!isVisible(lAnkle) && !isVisible(rAnkle)) { r.feedback.push({ type:'info', message:'Show ankles and feet — stand facing or side-on to camera.' }); return r; }
    r.canCount = true;
    const ankles = [lAnkle, rAnkle].filter(a => isVisible(a));
    const currentY = avg(ankles.map(a => a.y)); // lower Y = higher in frame = raised heel
    if (this.baseAnkleY === null) { this.baseAnkleY = currentY; return r; }
    const rise = this.baseAnkleY - currentY; // positive = heel raised
    r.angleLabel = `Rise: ${(rise * 100).toFixed(1)}%`;
    if (this.state === 'down' && rise > this.t.riseThreshold) this.state = 'up';
    else if (this.state === 'up' && rise < this.t.dropThreshold) { this.state = 'down'; this.reps++; }
    r.reps = this.reps; r.state = this.state;
    const ankleAng = avg([angles.leftAnkle, angles.rightAnkle]);
    if (ankleAng) r.angleLabel = `Ankle: ${Math.round(ankleAng)}°`;
    return r;
  }
}

// ─── 4. Standing Leg Raise ────────────────────────────────────────────────────

export class StandingLegRaiseAnalyzer {
  constructor(t = {}) {
    this.t = { hipUpAngle: t.hipUpAngle ?? 145, hipDownAngle: t.hipDownAngle ?? 165 };
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'down'; this.rightState = 'down'; this.leftReps = 0; this.rightReps = 0; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_HIP,L.LEFT_KNEE,L.RIGHT_HIP,L.RIGHT_KNEE,L.LEFT_SHOULDER,L.RIGHT_SHOULDER] });
    const lv = isVisible(landmarks[L.LEFT_HIP]) && isVisible(landmarks[L.LEFT_KNEE]);
    const rv = isVisible(landmarks[L.RIGHT_HIP]) && isVisible(landmarks[L.RIGHT_KNEE]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show hips and knees for leg raise tracking.' }); return r; }
    r.canCount = true;
    const labels = [];
    if (lv && angles.leftHip !== null) {
      const a = angles.leftHip; labels.push(`L Hip:${a}°`);
      if (this.leftState === 'down' && a < this.t.hipUpAngle) this.leftState = 'up';
      else if (this.leftState === 'up' && a > this.t.hipDownAngle) { this.leftState = 'down'; this.leftReps++; }
    }
    if (rv && angles.rightHip !== null) {
      const a = angles.rightHip; labels.push(`R Hip:${a}°`);
      if (this.rightState === 'down' && a < this.t.hipUpAngle) this.rightState = 'up';
      else if (this.rightState === 'up' && a > this.t.hipDownAngle) { this.rightState = 'down'; this.rightReps++; }
    }
    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`; r.angleLabel = labels.join(' | ');
    return r;
  }
}

// ─── 5. Seated Knee Extension ─────────────────────────────────────────────────

export class SeatedKneeExtensionAnalyzer {
  constructor(t = {}) {
    this.t = { extendedAngle: t.extendedAngle ?? 155, bentAngle: t.bentAngle ?? 100 };
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'bent'; this.rightState = 'bent'; this.leftReps = 0; this.rightReps = 0; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_HIP,L.LEFT_KNEE,L.LEFT_ANKLE,L.RIGHT_HIP,L.RIGHT_KNEE,L.RIGHT_ANKLE] });
    const lv = isVisible(landmarks[L.LEFT_KNEE]) && isVisible(landmarks[L.LEFT_ANKLE]);
    const rv = isVisible(landmarks[L.RIGHT_KNEE]) && isVisible(landmarks[L.RIGHT_ANKLE]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show knees and ankles — seat side-on to camera works best.' }); return r; }
    r.canCount = true;
    const labels = [];
    if (lv && angles.leftKnee !== null) {
      const a = angles.leftKnee; labels.push(`L:${a}°`);
      if (this.leftState === 'bent' && a > this.t.extendedAngle) this.leftState = 'extended';
      else if (this.leftState === 'extended' && a < this.t.bentAngle) { this.leftState = 'bent'; this.leftReps++; }
    }
    if (rv && angles.rightKnee !== null) {
      const a = angles.rightKnee; labels.push(`R:${a}°`);
      if (this.rightState === 'bent' && a > this.t.extendedAngle) this.rightState = 'extended';
      else if (this.rightState === 'extended' && a < this.t.bentAngle) { this.rightState = 'bent'; this.rightReps++; }
    }
    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`; r.angleLabel = labels.join(' | ');
    if (this.reps > 0 && this.reps % 5 === 0)
      r.feedback.push({ type:'good', message:'Good progress! Keep the movement slow and controlled.' });
    return r;
  }
}

// ─── 6. Hip Abduction ─────────────────────────────────────────────────────────

export class HipAbductionAnalyzer {
  constructor(t = {}) {
    // Tracks lateral distance between knees relative to hips
    this.t = { abductThreshold: t.abductThreshold ?? 0.08, returnThreshold: t.returnThreshold ?? 0.03 };
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'in'; this.rightState = 'in'; this.leftReps = 0; this.rightReps = 0; this.baseWidth = null; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_HIP,L.LEFT_KNEE,L.RIGHT_HIP,L.RIGHT_KNEE] });
    const lh = landmarks[L.LEFT_HIP], rh = landmarks[L.RIGHT_HIP];
    const lk = landmarks[L.LEFT_KNEE], rk = landmarks[L.RIGHT_KNEE];
    if (!isVisible(lh) || !isVisible(rh)) { r.feedback.push({ type:'info', message:'Show both hips and knees for hip abduction tracking.' }); return r; }
    r.canCount = true;
    const hipWidth = Math.abs(rh.x - lh.x);
    if (this.baseWidth === null) this.baseWidth = hipWidth;
    if (isVisible(lk)) {
      const leftOut = lh.x - lk.x; // positive = leg moved left (outward for left leg)
      if (this.leftState === 'in' && leftOut > this.t.abductThreshold) this.leftState = 'out';
      else if (this.leftState === 'out' && leftOut < this.t.returnThreshold) { this.leftState = 'in'; this.leftReps++; }
    }
    if (isVisible(rk)) {
      const rightOut = rk.x - rh.x;
      if (this.rightState === 'in' && rightOut > this.t.abductThreshold) this.rightState = 'out';
      else if (this.rightState === 'out' && rightOut < this.t.returnThreshold) { this.rightState = 'in'; this.rightReps++; }
    }
    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`;
    r.angleLabel = `L Hip:${angles.leftHip ?? '—'}° R Hip:${angles.rightHip ?? '—'}°`;
    return r;
  }
}

// ─── 7. Glute Bridge ─────────────────────────────────────────────────────────

export class GluteBridgeAnalyzer {
  constructor(t = {}) {
    this.t = { bridgeHipAngle: t.bridgeHipAngle ?? 150, downHipAngle: t.downHipAngle ?? 120 };
    this.reset();
  }
  reset() { this.reps = 0; this.state = 'down'; this.lastFeedbackRep = -1; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_HIP,L.LEFT_KNEE,L.RIGHT_SHOULDER,L.RIGHT_HIP,L.RIGHT_KNEE] });
    const lv = isVisible(landmarks[L.LEFT_HIP]) && isVisible(landmarks[L.LEFT_KNEE]) && isVisible(landmarks[L.LEFT_SHOULDER]);
    const rv = isVisible(landmarks[L.RIGHT_HIP]) && isVisible(landmarks[L.RIGHT_KNEE]) && isVisible(landmarks[L.RIGHT_SHOULDER]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Lie on back, side-on to camera. Show shoulders, hips, and knees.' }); return r; }
    r.canCount = true;
    const hipAng = avg([angles.leftHip, angles.rightHip]);
    if (hipAng === null) return r;
    r.angleLabel = `Hip: ${Math.round(hipAng)}°`;
    if (this.state === 'down' && hipAng > this.t.bridgeHipAngle) this.state = 'up';
    else if (this.state === 'up' && hipAng < this.t.downHipAngle) { this.state = 'down'; this.reps++; }
    r.reps = this.reps; r.state = this.state;
    if (this.reps !== this.lastFeedbackRep && this.state === 'up') {
      r.feedback.push({ type:'good', message:'Bridge up — squeeze glutes at the top and hold briefly.' });
      this.lastFeedbackRep = this.reps;
    }
    return r;
  }
}

// ─── 8. Sit-to-Stand ─────────────────────────────────────────────────────────

export class SitToStandAnalyzer {
  constructor(t = {}) {
    this.t = { sitAngle: t.sitAngle ?? 95, standAngle: t.standAngle ?? 160 };
    this.reset();
  }
  reset() { this.reps = 0; this.state = 'sitting'; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_HIP,L.LEFT_KNEE,L.LEFT_ANKLE,L.RIGHT_HIP,L.RIGHT_KNEE,L.RIGHT_ANKLE] });
    const lv = isVisible(landmarks[L.LEFT_HIP]) && isVisible(landmarks[L.LEFT_KNEE]) && isVisible(landmarks[L.LEFT_ANKLE]);
    const rv = isVisible(landmarks[L.RIGHT_HIP]) && isVisible(landmarks[L.RIGHT_KNEE]) && isVisible(landmarks[L.RIGHT_ANKLE]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Position side-on — full legs need to be visible.' }); return r; }
    r.canCount = true;
    const kneeAng = avg([angles.leftKnee, angles.rightKnee]);
    if (kneeAng === null) return r;
    r.angleLabel = `Knee: ${Math.round(kneeAng)}°`;
    if (this.state === 'sitting' && kneeAng > this.t.standAngle) this.state = 'standing';
    else if (this.state === 'standing' && kneeAng < this.t.sitAngle) { this.state = 'sitting'; this.reps++; }
    r.reps = this.reps; r.state = this.state;
    if (this.state === 'standing')
      r.feedback.push({ type:'good', message:'Standing — pause fully upright before sitting back down.' });
    return r;
  }
}

// ─── 9. Bicep Curl ────────────────────────────────────────────────────────────

export class BicepCurlAnalyzer {
  constructor(t = {}) {
    this.t = { elbowDownAngle: t.elbowDownAngle ?? 160, elbowUpAngle: t.elbowUpAngle ?? 50 };
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'down'; this.rightState = 'down'; this.leftReps = 0; this.rightReps = 0; this.lastFeedbackRep = -1; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_ELBOW,L.LEFT_WRIST,L.RIGHT_SHOULDER,L.RIGHT_ELBOW,L.RIGHT_WRIST] });
    const lv = isVisible(landmarks[L.LEFT_SHOULDER]) && isVisible(landmarks[L.LEFT_ELBOW]) && isVisible(landmarks[L.LEFT_WRIST]);
    const rv = isVisible(landmarks[L.RIGHT_SHOULDER]) && isVisible(landmarks[L.RIGHT_ELBOW]) && isVisible(landmarks[L.RIGHT_WRIST]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show both arms from shoulder to wrist.' }); return r; }
    r.canCount = true;
    const labels = [];
    if (lv && angles.leftElbow !== null) {
      const a = angles.leftElbow; labels.push(`L:${a}°`);
      if (this.leftState === 'down' && a < this.t.elbowUpAngle) this.leftState = 'up';
      else if (this.leftState === 'up' && a > this.t.elbowDownAngle) { this.leftState = 'down'; this.leftReps++; }
    }
    if (rv && angles.rightElbow !== null) {
      const a = angles.rightElbow; labels.push(`R:${a}°`);
      if (this.rightState === 'down' && a < this.t.elbowUpAngle) this.rightState = 'up';
      else if (this.rightState === 'up' && a > this.t.elbowDownAngle) { this.rightState = 'down'; this.rightReps++; }
    }
    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`; r.angleLabel = labels.join(' | ');
    if (this.reps !== this.lastFeedbackRep) {
      if (angles.leftShoulder !== null && angles.leftShoulder > 30) r.feedback.push({ type:'warning', message:'Left shoulder swinging — keep upper arm still.' });
      if (angles.rightShoulder !== null && angles.rightShoulder > 30) r.feedback.push({ type:'warning', message:'Right shoulder swinging — keep upper arm still.' });
      this.lastFeedbackRep = this.reps;
    }
    return r;
  }
}

// ─── 10. Push-up ─────────────────────────────────────────────────────────────

export class PushUpAnalyzer {
  constructor(t = {}) {
    this.t = { elbowDownAngle: t.elbowDownAngle ?? 90, elbowUpAngle: t.elbowUpAngle ?? 155 };
    this.reset();
  }
  reset() { this.reps = 0; this.state = 'up'; this.lastFeedbackRep = -1; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_ELBOW,L.LEFT_WRIST,L.RIGHT_SHOULDER,L.RIGHT_ELBOW,L.RIGHT_WRIST,L.LEFT_HIP,L.RIGHT_HIP] });
    const lv = isVisible(landmarks[L.LEFT_SHOULDER]) && isVisible(landmarks[L.LEFT_ELBOW]) && isVisible(landmarks[L.LEFT_WRIST]);
    const rv = isVisible(landmarks[L.RIGHT_SHOULDER]) && isVisible(landmarks[L.RIGHT_ELBOW]) && isVisible(landmarks[L.RIGHT_WRIST]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Position so shoulders, elbows, and wrists are all visible.' }); return r; }
    r.canCount = true;
    const elbowAng = avg([angles.leftElbow, angles.rightElbow]);
    if (elbowAng === null) return r;
    r.angleLabel = `Elbow: ${Math.round(elbowAng)}°`;
    if (this.state === 'up' && elbowAng < this.t.elbowDownAngle) this.state = 'down';
    else if (this.state === 'down' && elbowAng > this.t.elbowUpAngle) { this.state = 'up'; this.reps++; }
    r.reps = this.reps; r.state = this.state;
    if (this.reps !== this.lastFeedbackRep) {
      const ls = landmarks[L.LEFT_SHOULDER], lh = landmarks[L.LEFT_HIP], la = landmarks[L.LEFT_ANKLE];
      if (ls && lh && la && isVisible(ls) && isVisible(lh) && isVisible(la)) {
        const expected = ls.y + (la.y - ls.y) * 0.5;
        if (lh.y > expected + 0.06) r.feedback.push({ type:'warning', message:'Hips sagging — brace your core.' });
        else if (lh.y < expected - 0.06) r.feedback.push({ type:'warning', message:'Hips too high — keep a straight plank line.' });
      }
      this.lastFeedbackRep = this.reps;
    }
    return r;
  }
}

// ─── 11. Wall Push-up ────────────────────────────────────────────────────────

export class WallPushUpAnalyzer {
  constructor(t = {}) {
    this.t = { elbowBentAngle: t.elbowBentAngle ?? 100, elbowExtAngle: t.elbowExtAngle ?? 160 };
    this.reset();
  }
  reset() { this.reps = 0; this.state = 'extended'; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_ELBOW,L.LEFT_WRIST,L.RIGHT_SHOULDER,L.RIGHT_ELBOW,L.RIGHT_WRIST] });
    const lv = isVisible(landmarks[L.LEFT_SHOULDER]) && isVisible(landmarks[L.LEFT_ELBOW]);
    const rv = isVisible(landmarks[L.RIGHT_SHOULDER]) && isVisible(landmarks[L.RIGHT_ELBOW]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show shoulders and elbows from the side or front.' }); return r; }
    r.canCount = true;
    const elbowAng = avg([angles.leftElbow, angles.rightElbow]);
    if (elbowAng === null) return r;
    r.angleLabel = `Elbow: ${Math.round(elbowAng)}°`;
    if (this.state === 'extended' && elbowAng < this.t.elbowBentAngle) this.state = 'bent';
    else if (this.state === 'bent' && elbowAng > this.t.elbowExtAngle) { this.state = 'extended'; this.reps++; }
    r.reps = this.reps; r.state = this.state;
    if (this.state === 'bent') r.feedback.push({ type:'good', message:'Good bend — now push back to start position.' });
    return r;
  }
}

// ─── 12. Shoulder Lateral Raise ───────────────────────────────────────────────

export class ShoulderLateralRaiseAnalyzer {
  constructor(t = {}) {
    this.t = { raiseAngle: t.raiseAngle ?? 70, downAngle: t.downAngle ?? 30 };
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'down'; this.rightState = 'down'; this.leftReps = 0; this.rightReps = 0; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_ELBOW,L.RIGHT_SHOULDER,L.RIGHT_ELBOW] });
    const lv = isVisible(landmarks[L.LEFT_SHOULDER]) && isVisible(landmarks[L.LEFT_ELBOW]);
    const rv = isVisible(landmarks[L.RIGHT_SHOULDER]) && isVisible(landmarks[L.RIGHT_ELBOW]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show shoulders and elbows — face the camera.' }); return r; }
    r.canCount = true;
    const labels = [];
    // Use shoulder angle (elbow-shoulder-hip) as proxy for arm elevation
    if (lv && angles.leftShoulder !== null) {
      const a = angles.leftShoulder; labels.push(`L:${a}°`);
      if (this.leftState === 'down' && a > this.t.raiseAngle) this.leftState = 'up';
      else if (this.leftState === 'up' && a < this.t.downAngle) { this.leftState = 'down'; this.leftReps++; }
    }
    if (rv && angles.rightShoulder !== null) {
      const a = angles.rightShoulder; labels.push(`R:${a}°`);
      if (this.rightState === 'down' && a > this.t.raiseAngle) this.rightState = 'up';
      else if (this.rightState === 'up' && a < this.t.downAngle) { this.rightState = 'down'; this.rightReps++; }
    }
    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`; r.angleLabel = labels.join(' | ');
    if (this.leftState === 'up' || this.rightState === 'up')
      r.feedback.push({ type:'info', message:'Keep a slight elbow bend and raise to shoulder height only.' });
    return r;
  }
}

// ─── 13. Overhead Arm Raise ───────────────────────────────────────────────────

export class OverheadArmRaiseAnalyzer {
  constructor(t = {}) {
    this.t = { overheadAngle: t.overheadAngle ?? 155, downAngle: t.downAngle ?? 60 };
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'down'; this.rightState = 'down'; this.leftReps = 0; this.rightReps = 0; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_ELBOW,L.LEFT_WRIST,L.RIGHT_SHOULDER,L.RIGHT_ELBOW,L.RIGHT_WRIST] });
    const lv = isVisible(landmarks[L.LEFT_SHOULDER]) && isVisible(landmarks[L.LEFT_ELBOW]);
    const rv = isVisible(landmarks[L.RIGHT_SHOULDER]) && isVisible(landmarks[L.RIGHT_ELBOW]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show shoulders and arms fully — step back from camera.' }); return r; }
    r.canCount = true;
    const labels = [];
    if (lv && angles.leftShoulder !== null) {
      const a = angles.leftShoulder; labels.push(`L:${a}°`);
      if (this.leftState === 'down' && a > this.t.overheadAngle) this.leftState = 'up';
      else if (this.leftState === 'up' && a < this.t.downAngle) { this.leftState = 'down'; this.leftReps++; }
    }
    if (rv && angles.rightShoulder !== null) {
      const a = angles.rightShoulder; labels.push(`R:${a}°`);
      if (this.rightState === 'down' && a > this.t.overheadAngle) this.rightState = 'up';
      else if (this.rightState === 'up' && a < this.t.downAngle) { this.rightState = 'down'; this.rightReps++; }
    }
    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`; r.angleLabel = labels.join(' | ');
    return r;
  }
}

// ─── 14. Shoulder Press ───────────────────────────────────────────────────────

export class ShoulderPressAnalyzer {
  constructor(t = {}) {
    this.t = { pressedAngle: t.pressedAngle ?? 160, downAngle: t.downAngle ?? 90 };
    this.reset();
  }
  reset() { this.reps = 0; this.state = 'down'; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_ELBOW,L.LEFT_WRIST,L.RIGHT_SHOULDER,L.RIGHT_ELBOW,L.RIGHT_WRIST] });
    const lv = isVisible(landmarks[L.LEFT_SHOULDER]) && isVisible(landmarks[L.LEFT_ELBOW]) && isVisible(landmarks[L.LEFT_WRIST]);
    const rv = isVisible(landmarks[L.RIGHT_SHOULDER]) && isVisible(landmarks[L.RIGHT_ELBOW]) && isVisible(landmarks[L.RIGHT_WRIST]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show shoulders, elbows, and wrists for press tracking.' }); return r; }
    r.canCount = true;
    const elbowAng = avg([angles.leftElbow, angles.rightElbow]);
    if (elbowAng === null) return r;
    r.angleLabel = `Elbow: ${Math.round(elbowAng)}°`;
    if (this.state === 'down' && elbowAng > this.t.pressedAngle) this.state = 'up';
    else if (this.state === 'up' && elbowAng < this.t.downAngle) { this.state = 'down'; this.reps++; }
    r.reps = this.reps; r.state = this.state;
    if (this.state === 'up') r.feedback.push({ type:'good', message:'Arms extended — lower slowly to ~90° elbow angle.' });
    return r;
  }
}

// ─── 15. Triceps Extension ───────────────────────────────────────────────────

export class TricepsExtensionAnalyzer {
  constructor(t = {}) {
    this.t = { extendedAngle: t.extendedAngle ?? 155, bentAngle: t.bentAngle ?? 75 };
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'bent'; this.rightState = 'bent'; this.leftReps = 0; this.rightReps = 0; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_ELBOW,L.LEFT_WRIST,L.RIGHT_SHOULDER,L.RIGHT_ELBOW,L.RIGHT_WRIST] });
    const lv = isVisible(landmarks[L.LEFT_SHOULDER]) && isVisible(landmarks[L.LEFT_ELBOW]) && isVisible(landmarks[L.LEFT_WRIST]);
    const rv = isVisible(landmarks[L.RIGHT_SHOULDER]) && isVisible(landmarks[L.RIGHT_ELBOW]) && isVisible(landmarks[L.RIGHT_WRIST]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show elbows and wrists — side or front camera works.' }); return r; }
    r.canCount = true;
    const labels = [];
    if (lv && angles.leftElbow !== null) {
      const a = angles.leftElbow; labels.push(`L:${a}°`);
      if (this.leftState === 'bent' && a > this.t.extendedAngle) this.leftState = 'extended';
      else if (this.leftState === 'extended' && a < this.t.bentAngle) { this.leftState = 'bent'; this.leftReps++; }
    }
    if (rv && angles.rightElbow !== null) {
      const a = angles.rightElbow; labels.push(`R:${a}°`);
      if (this.rightState === 'bent' && a > this.t.extendedAngle) this.rightState = 'extended';
      else if (this.rightState === 'extended' && a < this.t.bentAngle) { this.rightState = 'bent'; this.rightReps++; }
    }
    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`; r.angleLabel = labels.join(' | ');
    return r;
  }
}

// ─── 16. Chest Press ─────────────────────────────────────────────────────────

export class ChestPressAnalyzer {
  constructor(t = {}) {
    this.t = {
      pressedAngle: t.pressedAngle ?? 160,  // arms extended (elbows nearly straight)
      downAngle:    t.downAngle    ?? 80,   // elbows bent at bottom of press
    };
    this.reset();
  }
  reset() { this.reps = 0; this.state = 'down'; this.lastFeedbackRep = -1; }

  analyze(landmarks, angles) {
    const r = makeResult({
      highlightIndices: [L.LEFT_SHOULDER, L.LEFT_ELBOW, L.LEFT_WRIST,
                         L.RIGHT_SHOULDER, L.RIGHT_ELBOW, L.RIGHT_WRIST],
    });
    const lv = isVisible(landmarks[L.LEFT_SHOULDER]) &&
               isVisible(landmarks[L.LEFT_ELBOW]) &&
               isVisible(landmarks[L.LEFT_WRIST]);
    const rv = isVisible(landmarks[L.RIGHT_SHOULDER]) &&
               isVisible(landmarks[L.RIGHT_ELBOW]) &&
               isVisible(landmarks[L.RIGHT_WRIST]);
    if (!lv && !rv) {
      r.feedback.push({ type:'info', message:'Show shoulders, elbows, and wrists — lie back with camera overhead or side-on.' });
      return r;
    }
    r.canCount = true;

    const elbowAng = avg([angles.leftElbow, angles.rightElbow]);
    if (elbowAng === null) return r;
    r.angleLabel = `Elbow: ${Math.round(elbowAng)}°`;

    // State machine: start at 'down' (elbows bent), extend up, return down = 1 rep
    if (this.state === 'down' && elbowAng > this.t.pressedAngle) {
      this.state = 'up';
    } else if (this.state === 'up' && elbowAng < this.t.downAngle) {
      this.state = 'down';
      this.reps++;
    }
    r.reps = this.reps;
    r.state = this.state;

    // Asymmetry check runs every frame so it catches mid-rep imbalances
    const la = angles.leftElbow, ra = angles.rightElbow;
    if (la !== null && ra !== null && Math.abs(la - ra) > 20) {
      r.feedback.push({
        type: 'warning',
        message: `Arms uneven (L:${la}° R:${ra}°) — press both sides equally.`,
      });
    }
    // Rep-gated positional cues
    if (this.reps !== this.lastFeedbackRep) {
      if (this.state === 'up') {
        r.feedback.push({ type: 'good', message: 'Arms extended — lower slowly to feel the chest stretch.' });
      }
      this.lastFeedbackRep = this.reps;
    }
    return r;
  }
}

// ─── 17. Step-back Lunge ─────────────────────────────────────────────────────

export class StepBackLungeAnalyzer {
  constructor(t = {}) {
    this.t = { kneeDownAngle: t.kneeDownAngle ?? 105, kneeUpAngle: t.kneeUpAngle ?? 165 };
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'up'; this.rightState = 'up'; this.leftReps = 0; this.rightReps = 0; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_HIP,L.LEFT_KNEE,L.LEFT_ANKLE,L.RIGHT_HIP,L.RIGHT_KNEE,L.RIGHT_ANKLE] });
    const lv = isVisible(landmarks[L.LEFT_KNEE]) && isVisible(landmarks[L.LEFT_HIP]);
    const rv = isVisible(landmarks[L.RIGHT_KNEE]) && isVisible(landmarks[L.RIGHT_HIP]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show hips and knees — side view works best for step-back lunges.' }); return r; }
    r.canCount = true;
    const labels = [];
    if (lv && angles.leftKnee !== null) {
      const a = angles.leftKnee; labels.push(`L:${a}°`);
      if (this.leftState === 'up' && a < this.t.kneeDownAngle) this.leftState = 'down';
      else if (this.leftState === 'down' && a > this.t.kneeUpAngle) { this.leftState = 'up'; this.leftReps++; }
    }
    if (rv && angles.rightKnee !== null) {
      const a = angles.rightKnee; labels.push(`R:${a}°`);
      if (this.rightState === 'up' && a < this.t.kneeDownAngle) this.rightState = 'down';
      else if (this.rightState === 'down' && a > this.t.kneeUpAngle) { this.rightState = 'up'; this.rightReps++; }
    }
    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`; r.angleLabel = labels.join(' | ');
    if (this.leftState === 'down' || this.rightState === 'down')
      r.feedback.push({ type:'info', message:'Front knee over ankle — keep torso upright.' });
    return r;
  }
}

// ─── 18. High Knee Raises ────────────────────────────────────────────────────

export class HighKneeRaiseAnalyzer {
  constructor(t = {}) {
    this.t = { kneeHighAngle: t.kneeHighAngle ?? 95, kneeDownAngle: t.kneeDownAngle ?? 155 };
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'down'; this.rightState = 'down'; this.leftReps = 0; this.rightReps = 0; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_HIP,L.LEFT_KNEE,L.RIGHT_HIP,L.RIGHT_KNEE] });
    const lv = isVisible(landmarks[L.LEFT_HIP]) && isVisible(landmarks[L.LEFT_KNEE]);
    const rv = isVisible(landmarks[L.RIGHT_HIP]) && isVisible(landmarks[L.RIGHT_KNEE]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show hips and knees — face the camera.' }); return r; }
    r.canCount = true;
    const labels = [];
    if (lv && angles.leftHip !== null) {
      const a = angles.leftHip; labels.push(`L:${a}°`);
      if (this.leftState === 'down' && a < this.t.kneeHighAngle) this.leftState = 'up';
      else if (this.leftState === 'up' && a > this.t.kneeDownAngle) { this.leftState = 'down'; this.leftReps++; }
    }
    if (rv && angles.rightHip !== null) {
      const a = angles.rightHip; labels.push(`R:${a}°`);
      if (this.rightState === 'down' && a < this.t.kneeHighAngle) this.rightState = 'up';
      else if (this.rightState === 'up' && a > this.t.kneeDownAngle) { this.rightState = 'down'; this.rightReps++; }
    }
    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`; r.angleLabel = labels.join(' ');
    if (this.leftState === 'up' || this.rightState === 'up')
      r.feedback.push({ type:'good', message:'Drive that knee up to hip height for full range.' });
    return r;
  }
}

// ─── 19. Standing Hip Extension ───────────────────────────────────────────────

export class StandingHipExtensionAnalyzer {
  constructor(t = {}) {
    this.t = { extendedAngle: t.extendedAngle ?? 195, neutralAngle: t.neutralAngle ?? 175 };
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'neutral'; this.rightState = 'neutral'; this.leftReps = 0; this.rightReps = 0; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_HIP,L.LEFT_KNEE,L.RIGHT_HIP,L.RIGHT_KNEE,L.LEFT_SHOULDER,L.RIGHT_SHOULDER] });
    const lv = isVisible(landmarks[L.LEFT_HIP]) && isVisible(landmarks[L.LEFT_KNEE]);
    const rv = isVisible(landmarks[L.RIGHT_HIP]) && isVisible(landmarks[L.RIGHT_KNEE]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Stand side-on — hip and knee must be visible.' }); return r; }
    r.canCount = true;
    const labels = [];
    // Hip extension: leg moves behind body → hip angle increases past 180°
    if (lv && angles.leftHip !== null) {
      const a = angles.leftHip; labels.push(`L:${a}°`);
      if (this.leftState === 'neutral' && a > this.t.extendedAngle) this.leftState = 'extended';
      else if (this.leftState === 'extended' && a < this.t.neutralAngle) { this.leftState = 'neutral'; this.leftReps++; }
    }
    if (rv && angles.rightHip !== null) {
      const a = angles.rightHip; labels.push(`R:${a}°`);
      if (this.rightState === 'neutral' && a > this.t.extendedAngle) this.rightState = 'extended';
      else if (this.rightState === 'extended' && a < this.t.neutralAngle) { this.rightState = 'neutral'; this.rightReps++; }
    }
    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`; r.angleLabel = labels.join(' | ');
    r.feedback.push({ type:'info', message:'Keep torso upright — only move the leg, not your hips.' });
    return r;
  }
}

// ─── 20. Single-leg Balance (hold) ────────────────────────────────────────────

export class SingleLegBalanceAnalyzer {
  constructor(t = {}) {
    this.t = {
      liftThreshold: t.liftThreshold ?? 0.05,   // foot Y difference to detect lifted leg
      minHoldMs: t.minHoldMs ?? 500,
    };
    this.reset();
  }
  reset() { this.holdMs = 0; this.state = 'both-feet'; this._holdStart = null; this._activeSide = null; }

  analyze(landmarks, _angles) {
    const r = makeResult({ holdMs: this.holdMs, highlightIndices: [L.LEFT_HIP,L.LEFT_KNEE,L.LEFT_ANKLE,L.RIGHT_HIP,L.RIGHT_KNEE,L.RIGHT_ANKLE] });
    const lAnkle = landmarks[L.LEFT_ANKLE], rAnkle = landmarks[L.RIGHT_ANKLE];
    const lHip = landmarks[L.LEFT_HIP], rHip = landmarks[L.RIGHT_HIP];
    if (!isVisible(lAnkle) && !isVisible(rAnkle)) { r.feedback.push({ type:'info', message:'Show full legs — ankles and hips must be visible.' }); return r; }
    r.canCount = true;
    const liftDiff = isVisible(lAnkle) && isVisible(rAnkle) ? lAnkle.y - rAnkle.y : 0;
    const isBalancing = Math.abs(liftDiff) > this.t.liftThreshold;
    if (isBalancing) {
      const side = liftDiff < 0 ? 'left' : 'right'; // smaller Y = higher in frame = lifted
      if (this._activeSide !== side) { this._holdStart = Date.now(); this._activeSide = side; }
      const held = Date.now() - (this._holdStart || Date.now());
      this.holdMs = held;
      this.state = `balancing-${side}`;
      r.holdMs = this.holdMs;
      r.state = this.state;
      r.angleLabel = `Hold: ${(held / 1000).toFixed(1)}s`;
      r.feedback.push({ type:'good', message:`Balancing on ${side} leg — focus on a fixed point ahead.` });
    } else {
      this._holdStart = null; this._activeSide = null; this.state = 'both-feet';
      r.state = 'both-feet';
      r.feedback.push({ type:'info', message:'Lift one foot to begin balance hold.' });
    }
    return r;
  }
}

// ─── 21. Plank Hold ───────────────────────────────────────────────────────────

export class PlankHoldAnalyzer {
  constructor(t = {}) {
    this.t = {
      minHipAlignmentDiff: t.minHipAlignmentDiff ?? 0.08, // max deviation from shoulder-ankle line
    };
    this.reset();
  }
  reset() { this.holdMs = 0; this.state = 'not-in-plank'; this._holdStart = null; }

  analyze(landmarks, angles) {
    const r = makeResult({ holdMs: this.holdMs, highlightIndices: [L.LEFT_SHOULDER,L.LEFT_HIP,L.LEFT_ANKLE,L.RIGHT_SHOULDER,L.RIGHT_HIP,L.RIGHT_ANKLE] });
    const ls = landmarks[L.LEFT_SHOULDER], lh = landmarks[L.LEFT_HIP], la = landmarks[L.LEFT_ANKLE];
    const rs = landmarks[L.RIGHT_SHOULDER], rh = landmarks[L.RIGHT_HIP], ra = landmarks[L.RIGHT_ANKLE];
    if (!isVisible(ls) || !isVisible(lh)) { r.feedback.push({ type:'info', message:'Position side-on to camera — shoulder, hip, and ankle must all be visible.' }); return r; }
    r.canCount = true;

    // Check plank: shoulders, hips, ankles roughly collinear horizontally
    const shoulderY = avg([ls?.y, rs?.y].filter(Boolean));
    const hipY = avg([lh?.y, rh?.y].filter(Boolean));
    const ankleY = isVisible(la) || isVisible(ra) ? avg([la?.y, ra?.y].filter(v => v !== null && v !== undefined)) : null;

    if (shoulderY !== null && hipY !== null) {
      const expectedHipY = ankleY !== null ? shoulderY + (ankleY - shoulderY) * 0.45 : shoulderY + 0.1;
      const deviation = Math.abs(hipY - expectedHipY);
      const inPlank = deviation < this.t.minHipAlignmentDiff;

      if (inPlank) {
        if (!this._holdStart) this._holdStart = Date.now();
        this.holdMs = Date.now() - this._holdStart;
        this.state = 'holding';
        r.holdMs = this.holdMs; r.state = 'holding';
        r.angleLabel = `Hold: ${(this.holdMs / 1000).toFixed(1)}s`;
        r.feedback.push({ type:'good', message:'Good plank position — breathe steadily and hold.' });
      } else {
        this._holdStart = null; this.state = 'not-in-plank';
        if (hipY > expectedHipY + 0.04) r.feedback.push({ type:'warning', message:'Hips sagging — brace core and raise hips.' });
        else r.feedback.push({ type:'warning', message:'Hips too high — lower to a straight line.' });
      }
    }
    return r;
  }
}

// ─── 22. Bird-Dog ────────────────────────────────────────────────────────────

export class BirdDogAnalyzer {
  constructor(t = {}) {
    this.t = { armUpAngle: t.armUpAngle ?? 150, legUpAngle: t.legUpAngle ?? 155, downAngle: t.downAngle ?? 100 };
    this.reset();
  }
  reset() { this.reps = 0; this.state = 'neutral'; this._repArmed = false; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_ELBOW,L.LEFT_HIP,L.LEFT_KNEE,L.RIGHT_SHOULDER,L.RIGHT_ELBOW,L.RIGHT_HIP,L.RIGHT_KNEE] });
    const lv = isVisible(landmarks[L.LEFT_SHOULDER]) && isVisible(landmarks[L.LEFT_HIP]) && isVisible(landmarks[L.LEFT_KNEE]);
    if (!lv) { r.feedback.push({ type:'info', message:'Position on hands and knees, side-on to camera.' }); return r; }
    r.canCount = true;

    // Detect arm-raise (shoulder angle) AND leg-raise (hip angle) simultaneously
    const armUp = angles.rightShoulder !== null && angles.rightShoulder > this.t.armUpAngle;
    const legUp = angles.leftHip !== null && angles.leftHip > this.t.legUpAngle;
    const extended = armUp && legUp;

    if (extended && !this._repArmed) { this._repArmed = true; this.state = 'extended'; }
    else if (!extended && this._repArmed) { this._repArmed = false; this.state = 'neutral'; this.reps++; }

    r.reps = this.reps; r.state = this.state;
    r.angleLabel = `Arm: ${angles.rightShoulder ?? '—'}° Leg: ${angles.leftHip ?? '—'}°`;
    if (extended) r.feedback.push({ type:'good', message:'Extended — keep spine neutral and hold 2–3 seconds.' });
    else r.feedback.push({ type:'info', message:'Extend opposite arm and leg simultaneously.' });
    return r;
  }
}

// ─── 23. Standing Side Bend ───────────────────────────────────────────────────

export class StandingSideBendAnalyzer {
  constructor(t = {}) {
    this.t = { bendThreshold: t.bendThreshold ?? 0.06 }; // shoulder-hip lateral offset (normalized)
    this.reset();
  }
  reset() { this.reps = 0; this.leftState = 'neutral'; this.rightState = 'neutral'; this.leftReps = 0; this.rightReps = 0; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_HIP,L.RIGHT_SHOULDER,L.RIGHT_HIP] });
    const ls = landmarks[L.LEFT_SHOULDER], rs = landmarks[L.RIGHT_SHOULDER];
    const lh = landmarks[L.LEFT_HIP], rh = landmarks[L.RIGHT_HIP];
    if (!isVisible(ls) || !isVisible(rs) || !isVisible(lh) || !isVisible(rh)) {
      r.feedback.push({ type:'info', message:'Show shoulders and hips — face or side-on to camera.' }); return r;
    }
    r.canCount = true;
    const midShoulderX = (ls.x + rs.x) / 2;
    const midHipX = (lh.x + rh.x) / 2;
    const lateralOffset = midShoulderX - midHipX; // positive = leaning right, negative = leaning left
    r.angleLabel = `Lean: ${(lateralOffset * 100).toFixed(1)}%`;

    if (this.leftState === 'neutral' && lateralOffset < -this.t.bendThreshold) this.leftState = 'bent';
    else if (this.leftState === 'bent' && lateralOffset > -this.t.bendThreshold * 0.3) { this.leftState = 'neutral'; this.leftReps++; }
    if (this.rightState === 'neutral' && lateralOffset > this.t.bendThreshold) this.rightState = 'bent';
    else if (this.rightState === 'bent' && lateralOffset < this.t.bendThreshold * 0.3) { this.rightState = 'neutral'; this.rightReps++; }

    this.reps = this.leftReps + this.rightReps;
    r.reps = this.reps; r.state = `L:${this.leftState} R:${this.rightState}`;
    if (this.leftState === 'bent' || this.rightState === 'bent')
      r.feedback.push({ type:'info', message:'Slide your hand down your thigh — keep hips still.' });
    return r;
  }
}

// ─── 24. Dead Bug ─────────────────────────────────────────────────────────────

export class DeadBugAnalyzer {
  constructor(t = {}) {
    this.t = { armExtAngle: t.armExtAngle ?? 150, legExtAngle: t.legExtAngle ?? 155, returnAngle: t.returnAngle ?? 100 };
    this.reset();
  }
  reset() { this.reps = 0; this.state = 'neutral'; this._repArmed = false; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_ELBOW,L.LEFT_HIP,L.LEFT_KNEE,L.RIGHT_SHOULDER,L.RIGHT_ELBOW,L.RIGHT_HIP,L.RIGHT_KNEE] });
    const lv = isVisible(landmarks[L.LEFT_SHOULDER]) && isVisible(landmarks[L.LEFT_HIP]);
    if (!lv) { r.feedback.push({ type:'info', message:'Lie on back — position camera overhead or to the side.' }); return r; }
    r.canCount = true;

    // Detect one arm + opposite leg extending
    const rightArmOut = angles.rightShoulder !== null && angles.rightShoulder > this.t.armExtAngle;
    const leftLegOut = angles.leftHip !== null && angles.leftHip > this.t.legExtAngle;
    const extended = rightArmOut && leftLegOut;

    if (extended && !this._repArmed) { this._repArmed = true; this.state = 'extended'; }
    else if (!extended && this._repArmed) { this._repArmed = false; this.state = 'neutral'; this.reps++; }

    r.reps = this.reps; r.state = this.state;
    r.angleLabel = `Arm: ${angles.rightShoulder ?? '—'}° Leg: ${angles.leftHip ?? '—'}°`;
    if (extended) r.feedback.push({ type:'good', message:'Good extension — keep lower back pressed to floor.' });
    else r.feedback.push({ type:'info', message:'Extend right arm and left leg together, then return.' });
    return r;
  }
}

// ─── 25. Jumping Jacks ───────────────────────────────────────────────────────

export class JumpingJackAnalyzer {
  constructor(t = {}) {
    this.t = { armsUpAngle: t.armsUpAngle ?? 100, armsDownAngle: t.armsDownAngle ?? 35 };
    this.reset();
  }
  reset() { this.reps = 0; this.state = 'closed'; }

  analyze(landmarks, angles) {
    const r = makeResult({ highlightIndices: [L.LEFT_SHOULDER,L.LEFT_ELBOW,L.RIGHT_SHOULDER,L.RIGHT_ELBOW,L.LEFT_HIP,L.RIGHT_HIP,L.LEFT_ANKLE,L.RIGHT_ANKLE] });
    const lv = isVisible(landmarks[L.LEFT_SHOULDER]) && isVisible(landmarks[L.LEFT_ELBOW]);
    const rv = isVisible(landmarks[L.RIGHT_SHOULDER]) && isVisible(landmarks[L.RIGHT_ELBOW]);
    if (!lv && !rv) { r.feedback.push({ type:'info', message:'Show full body — step back from camera.' }); return r; }
    r.canCount = true;

    const shoulderAng = avg([angles.leftShoulder, angles.rightShoulder]);
    if (shoulderAng === null) return r;
    r.angleLabel = `Arms: ${Math.round(shoulderAng)}°`;

    // Arms open = shoulder angle high (elbows out)
    if (this.state === 'closed' && shoulderAng > this.t.armsUpAngle) this.state = 'open';
    else if (this.state === 'open' && shoulderAng < this.t.armsDownAngle) { this.state = 'closed'; this.reps++; }

    r.reps = this.reps; r.state = this.state;
    return r;
  }
}

// ─── Exercise Config Registry ─────────────────────────────────────────────────

export const EXERCISE_CONFIGS = {
  // ── Lower body ──
  squat: {
    id: 'squat', name: 'Squat', category: 'lower',
    description: 'Compound lower-body movement targeting quads, glutes, and hamstrings.',
    instructions: 'Stand feet shoulder-width. Lower hips until knees ~90°, then return.',
    cameraGuidance: 'Face the camera or stand at 45°. Full body (head to feet) must be visible.',
    targetJoints: ['Knees', 'Hips', 'Ankles'], icon: '🦵', isHold: false,
    createAnalyzer: (t) => new SquatAnalyzer(t),
  },
  lunge: {
    id: 'lunge', name: 'Lunge', category: 'lower',
    description: 'Unilateral lower-body exercise for quad, glute, and hip-flexor strength.',
    instructions: 'Step forward, lower back knee toward floor, return. Alternate legs.',
    cameraGuidance: 'Side view recommended. Show full legs.',
    targetJoints: ['Knees', 'Hips'], icon: '🏃', isHold: false,
    createAnalyzer: (t) => new LungeAnalyzer(t),
  },
  calfRaise: {
    id: 'calfRaise', name: 'Calf Raise', category: 'lower',
    description: 'Isolation exercise for the gastrocnemius and soleus muscles.',
    instructions: 'Stand on flat surface. Rise onto toes, lower slowly.',
    cameraGuidance: 'Side view is most accurate. Feet and ankles must be visible.',
    targetJoints: ['Ankles'], icon: '🦶', isHold: false,
    createAnalyzer: (t) => new CalfRaiseAnalyzer(t),
  },
  standingLegRaise: {
    id: 'standingLegRaise', name: 'Standing Leg Raise', category: 'lower',
    description: 'Hip flexor and core exercise performed standing.',
    instructions: 'Stand tall. Lift one leg forward to hip height, lower slowly.',
    cameraGuidance: 'Side view. Show hips and full legs.',
    targetJoints: ['Hips', 'Knees'], icon: '🦿', isHold: false,
    createAnalyzer: (t) => new StandingLegRaiseAnalyzer(t),
  },
  seatedKneeExtension: {
    id: 'seatedKneeExtension', name: 'Seated Knee Extension', category: 'lower',
    description: 'Quad isolation exercise, common in physiotherapy for knee rehab.',
    instructions: 'Sit on chair. Extend one knee straight, hold 1–2s, lower.',
    cameraGuidance: 'Side view. Chair and full leg length must be visible.',
    targetJoints: ['Knees'], icon: '🪑', isHold: false,
    createAnalyzer: (t) => new SeatedKneeExtensionAnalyzer(t),
  },
  hipAbduction: {
    id: 'hipAbduction', name: 'Hip Abduction', category: 'lower',
    description: 'Targets hip abductors (glute medius) for hip and knee stability.',
    instructions: 'Stand. Move one leg out to the side, return. Use a wall for balance.',
    cameraGuidance: 'Face the camera. Hips and knees must be visible.',
    targetJoints: ['Hips'], icon: '⬅️', isHold: false,
    createAnalyzer: (t) => new HipAbductionAnalyzer(t),
  },
  gluteBridge: {
    id: 'gluteBridge', name: 'Glute Bridge', category: 'lower',
    description: 'Glute and hamstring strengthening performed lying on back.',
    instructions: 'Lie on back, knees bent. Drive hips up, squeeze glutes, lower.',
    cameraGuidance: 'Side view. Shoulders, hips, and knees visible.',
    targetJoints: ['Hips', 'Knees'], icon: '🛏️', isHold: false,
    createAnalyzer: (t) => new GluteBridgeAnalyzer(t),
  },
  sitToStand: {
    id: 'sitToStand', name: 'Sit-to-Stand', category: 'lower',
    description: 'Functional movement testing and building lower-limb strength.',
    instructions: 'From seated, stand fully upright, then slowly sit back down.',
    cameraGuidance: 'Side view with chair. Full legs visible.',
    targetJoints: ['Knees', 'Hips'], icon: '🪑', isHold: false,
    createAnalyzer: (t) => new SitToStandAnalyzer(t),
  },
  // ── Upper body ──
  bicepCurl: {
    id: 'bicepCurl', name: 'Bicep Curl', category: 'upper',
    description: 'Biceps brachii isolation exercise.',
    instructions: 'Hold weights, arms extended. Curl to shoulders, lower slowly.',
    cameraGuidance: 'Face camera. Both arms shoulder-to-wrist visible.',
    targetJoints: ['Elbows', 'Shoulders'], icon: '💪', isHold: false,
    createAnalyzer: (t) => new BicepCurlAnalyzer(t),
  },
  pushup: {
    id: 'pushup', name: 'Push-up', category: 'upper',
    description: 'Chest, shoulder, and triceps compound exercise.',
    instructions: 'Start in plank. Lower chest, push back up.',
    cameraGuidance: 'Side view. Shoulders, elbows, wrists, and hips visible.',
    targetJoints: ['Elbows', 'Shoulders'], icon: '🤸', isHold: false,
    createAnalyzer: (t) => new PushUpAnalyzer(t),
  },
  wallPushUp: {
    id: 'wallPushUp', name: 'Wall Push-up', category: 'upper',
    description: 'Low-intensity push-up variation for beginners or upper-limb rehab.',
    instructions: 'Stand arm\'s-length from wall. Bend elbows to touch wall, push back.',
    cameraGuidance: 'Side view. Shoulders and elbows visible.',
    targetJoints: ['Elbows', 'Shoulders'], icon: '🧱', isHold: false,
    createAnalyzer: (t) => new WallPushUpAnalyzer(t),
  },
  shoulderLateralRaise: {
    id: 'shoulderLateralRaise', name: 'Shoulder Lateral Raise', category: 'upper',
    description: 'Deltoid (middle head) isolation for shoulder width and stability.',
    instructions: 'Hold weights at sides. Raise arms to shoulder height, lower.',
    cameraGuidance: 'Face camera. Both shoulders and elbows visible.',
    targetJoints: ['Shoulders'], icon: '🏋️', isHold: false,
    createAnalyzer: (t) => new ShoulderLateralRaiseAnalyzer(t),
  },
  overheadArmRaise: {
    id: 'overheadArmRaise', name: 'Overhead Arm Raise', category: 'upper',
    description: 'Shoulder flexion exercise for mobility and rotator cuff health.',
    instructions: 'Raise arms from sides up overhead, lower back to sides.',
    cameraGuidance: 'Face or side view. Full arm must be visible.',
    targetJoints: ['Shoulders', 'Elbows'], icon: '🙌', isHold: false,
    createAnalyzer: (t) => new OverheadArmRaiseAnalyzer(t),
  },
  shoulderPress: {
    id: 'shoulderPress', name: 'Shoulder Press', category: 'upper',
    description: 'Overhead pressing movement targeting deltoids and triceps.',
    instructions: 'Hold weights at shoulder height. Press overhead until arms extend, lower.',
    cameraGuidance: 'Face or 45° view. Shoulders to wrists must be visible.',
    targetJoints: ['Shoulders', 'Elbows'], icon: '🏅', isHold: false,
    createAnalyzer: (t) => new ShoulderPressAnalyzer(t),
  },
  tricepsExtension: {
    id: 'tricepsExtension', name: 'Triceps Extension', category: 'upper',
    description: 'Triceps brachii isolation exercise.',
    instructions: 'Hold weight overhead with both hands. Lower behind head, extend up.',
    cameraGuidance: 'Side or front view. Elbows and wrists visible.',
    targetJoints: ['Elbows'], icon: '💪', isHold: false,
    createAnalyzer: (t) => new TricepsExtensionAnalyzer(t),
  },
  chestPress: {
    id: 'chestPress', name: 'Chest Press', category: 'upper',
    description: 'Compound pushing movement targeting the pectorals, anterior deltoids, and triceps.',
    instructions: 'Lie on bench (or floor). Lower weights to chest with elbows bent ~90°, then press up until arms extend.',
    cameraGuidance: 'Camera positioned to the side or overhead. Shoulders, elbows, and wrists must all be visible.',
    targetJoints: ['Elbows', 'Shoulders'], icon: '🏋️', isHold: false,
    createAnalyzer: (t) => new ChestPressAnalyzer(t),
  },
  // ── Functional ──
  stepBackLunge: {
    id: 'stepBackLunge', name: 'Step-back Lunge', category: 'functional',
    description: 'Lower-body functional movement emphasising hip and glute activation.',
    instructions: 'Step one leg back into a lunge, return. Alternate sides.',
    cameraGuidance: 'Side view preferred. Full legs visible.',
    targetJoints: ['Knees', 'Hips'], icon: '↩️', isHold: false,
    createAnalyzer: (t) => new StepBackLungeAnalyzer(t),
  },
  highKneeRaises: {
    id: 'highKneeRaises', name: 'High Knee Raises', category: 'functional',
    description: 'Dynamic cardio drill improving hip flexor strength and coordination.',
    instructions: 'Drive alternate knees up to hip height quickly.',
    cameraGuidance: 'Face camera. Hips and knees must be visible.',
    targetJoints: ['Hips', 'Knees'], icon: '🏃', isHold: false,
    createAnalyzer: (t) => new HighKneeRaiseAnalyzer(t),
  },
  standingHipExtension: {
    id: 'standingHipExtension', name: 'Standing Hip Extension', category: 'functional',
    description: 'Glute activation and hip mobility exercise.',
    instructions: 'Stand tall. Extend one leg backward, return. Keep torso upright.',
    cameraGuidance: 'Side view. Hip and knee visible.',
    targetJoints: ['Hips'], icon: '🦵', isHold: false,
    createAnalyzer: (t) => new StandingHipExtensionAnalyzer(t),
  },
  singleLegBalance: {
    id: 'singleLegBalance', name: 'Single-leg Balance', category: 'functional',
    description: 'Proprioception and ankle stability exercise. Tracks hold duration.',
    instructions: 'Lift one foot. Balance as long as possible. Switch legs.',
    cameraGuidance: 'Face camera. Full legs and ankles visible.',
    targetJoints: ['Ankles', 'Hips'], icon: '🧘', isHold: true,
    createAnalyzer: (t) => new SingleLegBalanceAnalyzer(t),
  },
  // ── Core & stability ──
  plankHold: {
    id: 'plankHold', name: 'Plank Hold', category: 'core',
    description: 'Core endurance exercise. Measures hold duration, not reps.',
    instructions: 'Forearms or hands on floor. Keep body straight from head to heels.',
    cameraGuidance: 'Side view is essential. Shoulders, hips, and ankles visible.',
    targetJoints: ['Hips', 'Shoulders'], icon: '📐', isHold: true,
    createAnalyzer: (t) => new PlankHoldAnalyzer(t),
  },
  birdDog: {
    id: 'birdDog', name: 'Bird-Dog', category: 'core',
    description: 'Core stability and coordination exercise on all fours.',
    instructions: 'On hands and knees. Extend opposite arm and leg, return.',
    cameraGuidance: 'Side view. Full body from hands to feet visible.',
    targetJoints: ['Hips', 'Shoulders'], icon: '🐦', isHold: false,
    createAnalyzer: (t) => new BirdDogAnalyzer(t),
  },
  standingSideBend: {
    id: 'standingSideBend', name: 'Standing Side Bend', category: 'core',
    description: 'Lateral trunk flexion targeting obliques and improving spinal mobility.',
    instructions: 'Stand tall. Slide hand down thigh to side, return upright.',
    cameraGuidance: 'Face camera. Shoulders and hips visible.',
    targetJoints: ['Hips', 'Shoulders'], icon: '↔️', isHold: false,
    createAnalyzer: (t) => new StandingSideBendAnalyzer(t),
  },
  deadBug: {
    id: 'deadBug', name: 'Dead Bug', category: 'core',
    description: 'Deep core stabilisation exercise preventing lower-back arch.',
    instructions: 'Lie on back, arms up. Lower opposite arm and leg, return.',
    cameraGuidance: 'Side or overhead view. Arms and legs must be visible.',
    targetJoints: ['Hips', 'Shoulders'], icon: '🐛', isHold: false,
    createAnalyzer: (t) => new DeadBugAnalyzer(t),
  },
  jumpingJacks: {
    id: 'jumpingJacks', name: 'Jumping Jacks', category: 'functional',
    description: 'Full-body cardio exercise tracking arm opening/closing cycles.',
    instructions: 'Jump feet wide while raising arms overhead. Jump back. Repeat.',
    cameraGuidance: 'Face camera. Full body visible — step back from camera.',
    targetJoints: ['Shoulders', 'Hips', 'Ankles'], icon: '⭐', isHold: false,
    createAnalyzer: (t) => new JumpingJackAnalyzer(t),
  },
};

export const EXERCISE_CATEGORIES = {
  lower: { label: 'Lower Body', color: '#4d9de0' },
  upper: { label: 'Upper Body', color: '#00d4aa' },
  functional: { label: 'Functional', color: '#f4a261' },
  core: { label: 'Core & Stability', color: '#52b788' },
};

export function createExerciseAnalyzer(exerciseId, thresholds = {}) {
  const config = EXERCISE_CONFIGS[exerciseId];
  if (!config) throw new Error(`Unknown exercise: ${exerciseId}`);
  return config.createAnalyzer(thresholds);
}
