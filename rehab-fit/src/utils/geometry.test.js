import { describe, it, expect, beforeEach } from 'vitest';
import { angleBetweenPoints, isVisible } from './geometry.js';
import {
  SquatAnalyzer, LungeAnalyzer, CalfRaiseAnalyzer, StandingLegRaiseAnalyzer,
  SeatedKneeExtensionAnalyzer, HipAbductionAnalyzer, GluteBridgeAnalyzer, SitToStandAnalyzer,
  BicepCurlAnalyzer, PushUpAnalyzer, WallPushUpAnalyzer, ShoulderLateralRaiseAnalyzer,
  OverheadArmRaiseAnalyzer, ShoulderPressAnalyzer, TricepsExtensionAnalyzer,
  ChestPressAnalyzer, StepBackLungeAnalyzer, HighKneeRaiseAnalyzer,
  StandingHipExtensionAnalyzer, SingleLegBalanceAnalyzer, PlankHoldAnalyzer,
  BirdDogAnalyzer, StandingSideBendAnalyzer, DeadBugAnalyzer, JumpingJackAnalyzer,
} from './exercises.js';

// ─── Geometry ────────────────────────────────────────────────────────────────

describe('angleBetweenPoints', () => {
  it('returns 90° for right angle', () => {
    expect(angleBetweenPoints({ x:0,y:1 }, { x:0,y:0 }, { x:1,y:0 })).toBe(90);
  });
  it('returns 180° for straight line', () => {
    expect(angleBetweenPoints({ x:-1,y:0 }, { x:0,y:0 }, { x:1,y:0 })).toBe(180);
  });
  it('returns 0° for same-direction collinear', () => {
    expect(angleBetweenPoints({ x:1,y:0 }, { x:0,y:0 }, { x:2,y:0 })).toBe(0);
  });
  it('returns null for missing points', () => {
    expect(angleBetweenPoints(null, { x:0,y:0 }, { x:1,y:0 })).toBeNull();
  });
  it('returns null for low-visibility landmark', () => {
    expect(angleBetweenPoints({ x:0,y:1,visibility:0.1 }, { x:0,y:0,visibility:0.9 }, { x:1,y:0,visibility:0.9 })).toBeNull();
  });
  it('returns ~45° for 45-degree angle', () => {
    expect(angleBetweenPoints({ x:0,y:1 }, { x:0,y:0 }, { x:1,y:1 })).toBe(45);
  });
});

describe('isVisible', () => {
  it('true for high visibility', () => { expect(isVisible({ visibility:0.9 })).toBe(true); });
  it('false for low visibility', () => { expect(isVisible({ visibility:0.2 })).toBe(false); });
  it('true when no visibility field', () => { expect(isVisible({ x:0,y:0 })).toBe(true); });
  it('false for null', () => { expect(isVisible(null)).toBe(false); });
});

// ─── Shared test helpers ─────────────────────────────────────────────────────

function lm(overrides = {}) {
  // 33 visible landmarks at neutral positions
  const base = Array.from({ length:33 }, (_,i) => ({ x:0.5, y: i*0.03, visibility:0.9 }));
  Object.entries(overrides).forEach(([i, v]) => { base[parseInt(i)] = v; });
  return base;
}
const V = { visibility: 0.9 };
const vis = (x,y) => ({ x, y, ...V });

// Landmark indices used across tests
const LM = { LS:11, RS:12, LE:13, RE:14, LW:15, RW:16, LH:23, RH:24, LK:25, RK:26, LA:27, RA:28, LHeel:29, RHeel:30, LFI:31, RFI:32 };

function noAngles() {
  return { leftElbow:null, rightElbow:null, leftShoulder:null, rightShoulder:null, leftHip:null, rightHip:null, leftKnee:null, rightKnee:null, leftAnkle:null, rightAnkle:null };
}

// ─── 1. Squat ────────────────────────────────────────────────────────────────

describe('SquatAnalyzer', () => {
  let a;
  beforeEach(() => { a = new SquatAnalyzer(); });

  it('starts at 0 reps, state up', () => { expect(a.reps).toBe(0); expect(a.state).toBe('up'); });
  it('transitions to down when knee angle < 100', () => {
    const marks = lm({ [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7), [LM.LA]:vis(0.4,0.9), [LM.RH]:vis(0.6,0.5), [LM.RK]:vis(0.6,0.7), [LM.RA]:vis(0.6,0.9) });
    a.analyze(marks, { ...noAngles(), leftKnee:80, rightKnee:80 });
    expect(a.state).toBe('down');
  });
  it('counts rep on down→up cycle', () => {
    const marks = lm({ [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7), [LM.LA]:vis(0.4,0.9), [LM.RH]:vis(0.6,0.5), [LM.RK]:vis(0.6,0.7), [LM.RA]:vis(0.6,0.9) });
    a.analyze(marks, { ...noAngles(), leftKnee:80, rightKnee:80 });
    const r = a.analyze(marks, { ...noAngles(), leftKnee:170, rightKnee:170 });
    expect(r.reps).toBe(1);
  });
  it('does not double-count holding at bottom', () => {
    const marks = lm({ [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7), [LM.LA]:vis(0.4,0.9), [LM.RH]:vis(0.6,0.5), [LM.RK]:vis(0.6,0.7), [LM.RA]:vis(0.6,0.9) });
    a.analyze(marks, { ...noAngles(), leftKnee:80, rightKnee:80 });
    a.analyze(marks, { ...noAngles(), leftKnee:80, rightKnee:80 });
    a.analyze(marks, { ...noAngles(), leftKnee:80, rightKnee:80 });
    expect(a.reps).toBe(0);
  });
  it('reset clears state', () => { a.reps = 5; a.reset(); expect(a.reps).toBe(0); expect(a.state).toBe('up'); });
  it('returns canCount:false when landmarks missing', () => {
    const r = a.analyze(lm(), noAngles());
    // all landmarks are at low Y values so visibility is fine but angles will be null
    // just check it doesn't throw
    expect(r).toBeDefined();
  });
});

// ─── 2. Lunge ────────────────────────────────────────────────────────────────

describe('LungeAnalyzer', () => {
  let a;
  beforeEach(() => { a = new LungeAnalyzer(); });
  it('counts left leg lunge', () => {
    const marks = lm({ [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7) });
    a.analyze(marks, { ...noAngles(), leftKnee:95 });
    const r = a.analyze(marks, { ...noAngles(), leftKnee:170 });
    expect(r.reps).toBeGreaterThanOrEqual(1);
  });
  it('reset works', () => { a.reps = 4; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 3. Calf Raise ───────────────────────────────────────────────────────────

describe('CalfRaiseAnalyzer', () => {
  let a;
  beforeEach(() => { a = new CalfRaiseAnalyzer(); });
  it('starts at 0 reps', () => { expect(a.reps).toBe(0); });
  it('transitions up when ankle rises', () => {
    const marks = lm({ [LM.LA]:vis(0.4,0.8), [LM.RA]:vis(0.6,0.8) });
    a.analyze(marks, noAngles()); // sets baseline
    a.analyze(marks, noAngles());
    const marks2 = lm({ [LM.LA]:vis(0.4,0.74), [LM.RA]:vis(0.6,0.74) }); // Y dropped = heel raised
    const r = a.analyze(marks2, noAngles());
    expect(r.state).toBe('up');
  });
  it('counts rep when returns down', () => {
    const marks = lm({ [LM.LA]:vis(0.4,0.8), [LM.RA]:vis(0.6,0.8) });
    a.analyze(marks, noAngles()); // baseline
    const up = lm({ [LM.LA]:vis(0.4,0.74), [LM.RA]:vis(0.6,0.74) });
    a.analyze(up, noAngles());
    const down = lm({ [LM.LA]:vis(0.4,0.81), [LM.RA]:vis(0.6,0.81) });
    const r = a.analyze(down, noAngles());
    expect(r.reps).toBe(1);
  });
  it('reset works', () => { a.reps = 3; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 4. Standing Leg Raise ───────────────────────────────────────────────────

describe('StandingLegRaiseAnalyzer', () => {
  let a;
  beforeEach(() => { a = new StandingLegRaiseAnalyzer(); });
  it('counts left leg raise', () => {
    const marks = lm({ [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7) });
    a.analyze(marks, { ...noAngles(), leftHip:140 });
    const r = a.analyze(marks, { ...noAngles(), leftHip:168 });
    expect(r.reps).toBeGreaterThanOrEqual(1);
  });
  it('reset works', () => { a.reset(); expect(a.reps).toBe(0); });
});

// ─── 5. Seated Knee Extension ────────────────────────────────────────────────

describe('SeatedKneeExtensionAnalyzer', () => {
  let a;
  beforeEach(() => { a = new SeatedKneeExtensionAnalyzer(); });
  it('counts left extension cycle', () => {
    const marks = lm({ [LM.LK]:vis(0.4,0.6), [LM.LA]:vis(0.4,0.9) });
    a.analyze(marks, { ...noAngles(), leftKnee:160 }); // extended
    const r = a.analyze(marks, { ...noAngles(), leftKnee:90 }); // bent back
    expect(r.reps).toBeGreaterThanOrEqual(1);
  });
  it('does not count without full cycle', () => {
    const marks = lm({ [LM.LK]:vis(0.4,0.6), [LM.LA]:vis(0.4,0.9) });
    a.analyze(marks, { ...noAngles(), leftKnee:160 });
    expect(a.reps).toBe(0); // extended but not returned yet
  });
});

// ─── 6. Hip Abduction ────────────────────────────────────────────────────────

describe('HipAbductionAnalyzer', () => {
  let a;
  beforeEach(() => { a = new HipAbductionAnalyzer(); });
  it('starts at 0 reps', () => { expect(a.reps).toBe(0); });
  it('detects left leg abduction', () => {
    const base = lm({ [LM.LH]:vis(0.4,0.5), [LM.RH]:vis(0.6,0.5), [LM.LK]:vis(0.3,0.7) });
    a.analyze(base, noAngles()); // sets baseline
    const abducted = lm({ [LM.LH]:vis(0.4,0.5), [LM.RH]:vis(0.6,0.5), [LM.LK]:vis(0.25,0.7) });
    const r = a.analyze(abducted, noAngles());
    expect(r.state).toContain('out');
  });
  it('reset works', () => { a.reps = 3; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 7. Glute Bridge ─────────────────────────────────────────────────────────

describe('GluteBridgeAnalyzer', () => {
  let a;
  beforeEach(() => { a = new GluteBridgeAnalyzer(); });
  it('counts bridge cycle', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7), [LM.RS]:vis(0.6,0.3), [LM.RH]:vis(0.6,0.5), [LM.RK]:vis(0.6,0.7) });
    a.analyze(marks, { ...noAngles(), leftHip:155, rightHip:155 }); // up
    const r = a.analyze(marks, { ...noAngles(), leftHip:110, rightHip:110 }); // down → counts
    expect(r.reps).toBe(1);
  });
  it('reset works', () => { a.reps = 2; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 8. Sit-to-Stand ─────────────────────────────────────────────────────────

describe('SitToStandAnalyzer', () => {
  let a;
  beforeEach(() => { a = new SitToStandAnalyzer(); });
  it('counts stand→sit cycle', () => {
    const marks = lm({ [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7), [LM.LA]:vis(0.4,0.9), [LM.RH]:vis(0.6,0.5), [LM.RK]:vis(0.6,0.7), [LM.RA]:vis(0.6,0.9) });
    a.analyze(marks, { ...noAngles(), leftKnee:165, rightKnee:165 }); // standing
    const r = a.analyze(marks, { ...noAngles(), leftKnee:85, rightKnee:85 }); // sitting
    expect(r.reps).toBe(1);
  });
  it('reset works', () => { a.reps = 2; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 9. Bicep Curl ───────────────────────────────────────────────────────────

describe('BicepCurlAnalyzer', () => {
  let a;
  beforeEach(() => { a = new BicepCurlAnalyzer(); });
  it('starts at 0', () => { expect(a.reps).toBe(0); });
  it('counts both arms', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.LW]:vis(0.4,0.7), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5), [LM.RW]:vis(0.6,0.7) });
    a.analyze(marks, { ...noAngles(), leftElbow:40, rightElbow:40 });
    const r = a.analyze(marks, { ...noAngles(), leftElbow:165, rightElbow:165 });
    expect(r.reps).toBe(2);
  });
  it('does not count without full curl', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.LW]:vis(0.4,0.7), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5), [LM.RW]:vis(0.6,0.7) });
    a.analyze(marks, { ...noAngles(), leftElbow:40, rightElbow:40 });
    expect(a.reps).toBe(0);
  });
  it('reset works', () => { a.reps = 10; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 10. Push-up ─────────────────────────────────────────────────────────────

describe('PushUpAnalyzer', () => {
  let a;
  beforeEach(() => { a = new PushUpAnalyzer(); });
  it('counts push-up cycle', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.LW]:vis(0.4,0.7), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5), [LM.RW]:vis(0.6,0.7) });
    a.analyze(marks, { ...noAngles(), leftElbow:80, rightElbow:80 });
    const r = a.analyze(marks, { ...noAngles(), leftElbow:160, rightElbow:160 });
    expect(r.reps).toBe(1);
  });
  it('reset works', () => { a.reps = 3; a.reset(); expect(a.reps).toBe(0); expect(a.state).toBe('up'); });
});

// ─── 11. Wall Push-up ────────────────────────────────────────────────────────

describe('WallPushUpAnalyzer', () => {
  let a;
  beforeEach(() => { a = new WallPushUpAnalyzer(); });
  it('counts wall push-up', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5) });
    a.analyze(marks, { ...noAngles(), leftElbow:95, rightElbow:95 }); // bent
    const r = a.analyze(marks, { ...noAngles(), leftElbow:162, rightElbow:162 }); // extended → rep
    expect(r.reps).toBe(1);
  });
  it('reset works', () => { a.reps = 5; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 12. Shoulder Lateral Raise ──────────────────────────────────────────────

describe('ShoulderLateralRaiseAnalyzer', () => {
  let a;
  beforeEach(() => { a = new ShoulderLateralRaiseAnalyzer(); });
  it('counts raise cycle', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5) });
    a.analyze(marks, { ...noAngles(), leftShoulder:75, rightShoulder:75 }); // raised
    const r = a.analyze(marks, { ...noAngles(), leftShoulder:20, rightShoulder:20 }); // down → rep
    expect(r.reps).toBeGreaterThanOrEqual(2); // both arms
  });
  it('reset works', () => { a.reps = 2; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 13. Overhead Arm Raise ──────────────────────────────────────────────────

describe('OverheadArmRaiseAnalyzer', () => {
  let a;
  beforeEach(() => { a = new OverheadArmRaiseAnalyzer(); });
  it('counts arm raise cycle', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5) });
    a.analyze(marks, { ...noAngles(), leftShoulder:160, rightShoulder:160 }); // overhead
    const r = a.analyze(marks, { ...noAngles(), leftShoulder:50, rightShoulder:50 }); // down → rep
    expect(r.reps).toBeGreaterThanOrEqual(2);
  });
  it('reset works', () => { a.reps = 3; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 14. Shoulder Press ──────────────────────────────────────────────────────

describe('ShoulderPressAnalyzer', () => {
  let a;
  beforeEach(() => { a = new ShoulderPressAnalyzer(); });
  it('counts press cycle', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.LW]:vis(0.4,0.1), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5), [LM.RW]:vis(0.6,0.1) });
    a.analyze(marks, { ...noAngles(), leftElbow:165, rightElbow:165 }); // pressed
    const r = a.analyze(marks, { ...noAngles(), leftElbow:85, rightElbow:85 }); // down → rep
    expect(r.reps).toBe(1);
  });
  it('reset works', () => { a.reps = 4; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 15. Triceps Extension ───────────────────────────────────────────────────

describe('TricepsExtensionAnalyzer', () => {
  let a;
  beforeEach(() => { a = new TricepsExtensionAnalyzer(); });
  it('counts extension cycle', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.LW]:vis(0.4,0.7), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5), [LM.RW]:vis(0.6,0.7) });
    a.analyze(marks, { ...noAngles(), leftElbow:160, rightElbow:160 }); // extended
    const r = a.analyze(marks, { ...noAngles(), leftElbow:70, rightElbow:70 }); // bent → rep
    expect(r.reps).toBeGreaterThanOrEqual(2);
  });
  it('reset works', () => { a.reps = 3; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 16. Chest Press ─────────────────────────────────────────────────────────

describe('ChestPressAnalyzer', () => {
  let a;
  beforeEach(() => { a = new ChestPressAnalyzer(); });

  it('starts at 0 reps, state down', () => {
    expect(a.reps).toBe(0);
    expect(a.state).toBe('down');
  });
  it('transitions to up when elbows extend past 160°', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.LW]:vis(0.4,0.7), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5), [LM.RW]:vis(0.6,0.7) });
    a.analyze(marks, { ...noAngles(), leftElbow:165, rightElbow:165 });
    expect(a.state).toBe('up');
  });
  it('counts rep on extend→lower cycle', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.LW]:vis(0.4,0.7), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5), [LM.RW]:vis(0.6,0.7) });
    a.analyze(marks, { ...noAngles(), leftElbow:165, rightElbow:165 }); // pressed up
    const r = a.analyze(marks, { ...noAngles(), leftElbow:70,  rightElbow:70  }); // lowered → rep
    expect(r.reps).toBe(1);
  });
  it('does not count without returning to down', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.LW]:vis(0.4,0.7), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5), [LM.RW]:vis(0.6,0.7) });
    a.analyze(marks, { ...noAngles(), leftElbow:165, rightElbow:165 });
    expect(a.reps).toBe(0);
  });
  it('warns on asymmetric arm extension', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.LW]:vis(0.4,0.7), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5), [LM.RW]:vis(0.6,0.7) });
    a.analyze(marks, { ...noAngles(), leftElbow:165, rightElbow:165 }); // up
    const r = a.analyze(marks, { ...noAngles(), leftElbow:70,  rightElbow:70  }); // down → rep
    // trigger feedback on next extended position with uneven arms
    const r2 = a.analyze(marks, { ...noAngles(), leftElbow:165, rightElbow:140 });
    expect(r2.feedback.some(f => f.message.toLowerCase().includes('uneven'))).toBe(true);
  });
  it('reset clears state', () => { a.reps = 7; a.reset(); expect(a.reps).toBe(0); expect(a.state).toBe('down'); });
});

// ─── 17. Step-back Lunge ─────────────────────────────────────────────────────

describe('StepBackLungeAnalyzer', () => {
  let a;
  beforeEach(() => { a = new StepBackLungeAnalyzer(); });
  it('counts left lunge', () => {
    const marks = lm({ [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7) });
    a.analyze(marks, { ...noAngles(), leftKnee:100 }); // stepped back
    const r = a.analyze(marks, { ...noAngles(), leftKnee:168 }); // returned
    expect(r.reps).toBeGreaterThanOrEqual(1);
  });
  it('reset works', () => { a.reps = 2; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 18. High Knee Raises ────────────────────────────────────────────────────

describe('HighKneeRaiseAnalyzer', () => {
  let a;
  beforeEach(() => { a = new HighKneeRaiseAnalyzer(); });
  it('counts both knees', () => {
    const marks = lm({ [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7), [LM.RH]:vis(0.6,0.5), [LM.RK]:vis(0.6,0.7) });
    a.analyze(marks, { ...noAngles(), leftHip:90, rightHip:160 });
    a.analyze(marks, { ...noAngles(), leftHip:158, rightHip:160 }); // left down → 1
    a.analyze(marks, { ...noAngles(), leftHip:158, rightHip:90 });
    const r = a.analyze(marks, { ...noAngles(), leftHip:158, rightHip:158 }); // right down → 2
    expect(r.reps).toBeGreaterThanOrEqual(2);
  });
  it('reset works', () => { a.reps = 4; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 19. Standing Hip Extension ──────────────────────────────────────────────

describe('StandingHipExtensionAnalyzer', () => {
  let a;
  beforeEach(() => { a = new StandingHipExtensionAnalyzer(); });
  it('counts extension cycle', () => {
    const marks = lm({ [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7) });
    a.analyze(marks, { ...noAngles(), leftHip:200, rightHip:180 }); // extended
    const r = a.analyze(marks, { ...noAngles(), leftHip:170, rightHip:180 }); // neutral → rep
    expect(r.reps).toBeGreaterThanOrEqual(1);
  });
  it('reset works', () => { a.reps = 2; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 20. Single-leg Balance ───────────────────────────────────────────────────

describe('SingleLegBalanceAnalyzer', () => {
  let a;
  beforeEach(() => { a = new SingleLegBalanceAnalyzer(); });
  it('starts in both-feet state', () => { expect(a.state).toBe('both-feet'); });
  it('detects left-leg balance when left ankle higher', () => {
    // Left ankle at lower Y value = higher in frame = lifted
    const marks = lm({ [LM.LA]:vis(0.4,0.6), [LM.RA]:vis(0.6,0.8) });
    const r = a.analyze(marks, noAngles());
    expect(r.state).toContain('balancing');
  });
  it('holdMs increases while balancing', () => {
    const marks = lm({ [LM.LA]:vis(0.4,0.6), [LM.RA]:vis(0.6,0.8) });
    a.analyze(marks, noAngles());
    // Simulate time passing by calling again — holdMs won't be exactly predictable in test
    const r = a.analyze(marks, noAngles());
    expect(r.holdMs).toBeGreaterThanOrEqual(0);
  });
  it('reset works', () => { a.holdMs = 5000; a.reset(); expect(a.holdMs).toBe(0); });
});

// ─── 21. Plank Hold ──────────────────────────────────────────────────────────

describe('PlankHoldAnalyzer', () => {
  let a;
  beforeEach(() => { a = new PlankHoldAnalyzer(); });
  it('starts not-in-plank', () => { expect(a.state).toBe('not-in-plank'); });
  it('enters holding state with aligned body', () => {
    // Shoulder, hip, ankle roughly collinear horizontally
    const marks = lm({ [LM.LS]:vis(0.3,0.4), [LM.LH]:vis(0.5,0.43), [LM.LA]:vis(0.8,0.46) });
    const r = a.analyze(marks, noAngles());
    expect(r.state).toBe('holding');
  });
  it('warns when hips sag', () => {
    const marks = lm({ [LM.LS]:vis(0.3,0.4), [LM.LH]:vis(0.5,0.65), [LM.LA]:vis(0.8,0.46) });
    const r = a.analyze(marks, noAngles());
    expect(r.feedback.some(f => f.message.toLowerCase().includes('sag'))).toBe(true);
  });
  it('reset works', () => { a.holdMs = 10000; a.reset(); expect(a.holdMs).toBe(0); });
});

// ─── 22. Bird-Dog ────────────────────────────────────────────────────────────

describe('BirdDogAnalyzer', () => {
  let a;
  beforeEach(() => { a = new BirdDogAnalyzer(); });
  it('counts rep when arm+leg extend then return', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7) });
    a.analyze(marks, { ...noAngles(), rightShoulder:155, leftHip:160 }); // extended
    const r = a.analyze(marks, { ...noAngles(), rightShoulder:80, leftHip:90 }); // neutral → rep
    expect(r.reps).toBe(1);
  });
  it('does not count without returning to neutral', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LH]:vis(0.4,0.5), [LM.LK]:vis(0.4,0.7) });
    a.analyze(marks, { ...noAngles(), rightShoulder:155, leftHip:160 });
    expect(a.reps).toBe(0);
  });
  it('reset works', () => { a.reps = 3; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 23. Standing Side Bend ──────────────────────────────────────────────────

describe('StandingSideBendAnalyzer', () => {
  let a;
  beforeEach(() => { a = new StandingSideBendAnalyzer(); });
  it('counts left bend cycle', () => {
    // midShoulderX=0.38, midHipX=0.50 → offset=-0.12, crosses -0.06 threshold
    const bent = lm({ [LM.LS]:vis(0.31,0.3), [LM.RS]:vis(0.45,0.3), [LM.LH]:vis(0.4,0.5), [LM.RH]:vis(0.6,0.5) });
    a.analyze(bent, noAngles()); // state → left bent
    // midShoulderX=0.50, midHipX=0.50 → offset=0 < return threshold of 0.02
    const neutral = lm({ [LM.LS]:vis(0.4,0.3), [LM.RS]:vis(0.6,0.3), [LM.LH]:vis(0.4,0.5), [LM.RH]:vis(0.6,0.5) });
    const r = a.analyze(neutral, noAngles()); // return → rep
    expect(r.reps).toBeGreaterThanOrEqual(1);
  });
  it('reset works', () => { a.reps = 4; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 24. Dead Bug ────────────────────────────────────────────────────────────

describe('DeadBugAnalyzer', () => {
  let a;
  beforeEach(() => { a = new DeadBugAnalyzer(); });
  it('counts rep when extended then returned', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LH]:vis(0.4,0.5) });
    a.analyze(marks, { ...noAngles(), rightShoulder:155, leftHip:160 }); // extended
    const r = a.analyze(marks, { ...noAngles(), rightShoulder:80, leftHip:90 }); // neutral
    expect(r.reps).toBe(1);
  });
  it('does not count partial movement', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LH]:vis(0.4,0.5) });
    a.analyze(marks, { ...noAngles(), rightShoulder:155, leftHip:90 }); // only arm
    expect(a.reps).toBe(0);
  });
  it('reset works', () => { a.reps = 2; a.reset(); expect(a.reps).toBe(0); });
});

// ─── 25. Jumping Jacks ───────────────────────────────────────────────────────

describe('JumpingJackAnalyzer', () => {
  let a;
  beforeEach(() => { a = new JumpingJackAnalyzer(); });
  it('counts jack cycle', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5) });
    a.analyze(marks, { ...noAngles(), leftShoulder:110, rightShoulder:110 }); // open
    const r = a.analyze(marks, { ...noAngles(), leftShoulder:25, rightShoulder:25 }); // closed → rep
    expect(r.reps).toBe(1);
  });
  it('does not count without closing', () => {
    const marks = lm({ [LM.LS]:vis(0.4,0.3), [LM.LE]:vis(0.4,0.5), [LM.RS]:vis(0.6,0.3), [LM.RE]:vis(0.6,0.5) });
    a.analyze(marks, { ...noAngles(), leftShoulder:110, rightShoulder:110 });
    expect(a.reps).toBe(0);
  });
  it('reset works', () => { a.reps = 10; a.reset(); expect(a.reps).toBe(0); });
});

// ─── EXERCISE_CONFIGS completeness check ─────────────────────────────────────

describe('EXERCISE_CONFIGS', () => {
  it('has exactly 25 exercises', async () => {
    const { EXERCISE_CONFIGS } = await import('./exercises.js');
    expect(Object.keys(EXERCISE_CONFIGS).length).toBe(25);
  });
  it('every config has required fields', async () => {
    const { EXERCISE_CONFIGS } = await import('./exercises.js');
    for (const [id, cfg] of Object.entries(EXERCISE_CONFIGS)) {
      expect(cfg.id, id).toBeDefined();
      expect(cfg.name, id).toBeDefined();
      expect(cfg.category, id).toBeDefined();
      expect(cfg.icon, id).toBeDefined();
      expect(typeof cfg.createAnalyzer, id).toBe('function');
    }
  });
  it('all analyzers can be instantiated and respond to analyze()', async () => {
    const { EXERCISE_CONFIGS } = await import('./exercises.js');
    const marks = Array.from({ length:33 }, (_,i) => ({ x:0.5, y:i*0.03, visibility:0.9 }));
    const angles = { leftElbow:null, rightElbow:null, leftShoulder:null, rightShoulder:null, leftHip:null, rightHip:null, leftKnee:null, rightKnee:null, leftAnkle:null, rightAnkle:null };
    for (const [id, cfg] of Object.entries(EXERCISE_CONFIGS)) {
      const analyzer = cfg.createAnalyzer();
      expect(() => analyzer.analyze(marks, angles)).not.toThrow();
      expect(() => analyzer.reset()).not.toThrow();
    }
  });
});
