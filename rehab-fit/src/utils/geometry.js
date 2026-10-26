/**
 * Geometry utilities for joint-angle calculations and pose analysis.
 * All functions operate on MediaPipe NormalizedLandmark objects:
 *   { x: 0..1, y: 0..1, z: number, visibility: 0..1 }
 */

export const MIN_VISIBILITY = 0.5;

/**
 * Returns the angle ABC in degrees, where B is the vertex.
 * Uses the law of cosines applied to the two vectors BA and BC.
 * Returns null if any landmark is missing or below visibility threshold.
 */
export function angleBetweenPoints(a, b, c, minVisibility = MIN_VISIBILITY) {
  if (!a || !b || !c) return null;
  if (
    (a.visibility !== undefined && a.visibility < minVisibility) ||
    (b.visibility !== undefined && b.visibility < minVisibility) ||
    (c.visibility !== undefined && c.visibility < minVisibility)
  ) return null;

  const vectorBA = { x: a.x - b.x, y: a.y - b.y };
  const vectorBC = { x: c.x - b.x, y: c.y - b.y };

  const dot = vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y;
  const magBA = Math.sqrt(vectorBA.x ** 2 + vectorBA.y ** 2);
  const magBC = Math.sqrt(vectorBC.x ** 2 + vectorBC.y ** 2);

  if (magBA === 0 || magBC === 0) return null;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.round(Math.acos(cosAngle) * (180 / Math.PI));
}

/**
 * Euclidean distance between two landmarks (normalized coords).
 */
export function landmarkDistance(a, b) {
  if (!a || !b) return null;
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Midpoint between two landmarks.
 */
export function midpoint(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Returns true if a landmark meets the minimum visibility requirement.
 */
export function isVisible(landmark, minVisibility = MIN_VISIBILITY) {
  if (!landmark) return false;
  if (landmark.visibility === undefined) return true; // assume visible if no visibility field
  return landmark.visibility >= minVisibility;
}

/**
 * All MediaPipe Pose landmark indices.
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
export const LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

/**
 * Skeleton connections for drawing bones.
 */
export const SKELETON_CONNECTIONS = [
  // Face
  [LANDMARKS.LEFT_EAR, LANDMARKS.LEFT_EYE],
  [LANDMARKS.RIGHT_EAR, LANDMARKS.RIGHT_EYE],
  [LANDMARKS.LEFT_EYE, LANDMARKS.NOSE],
  [LANDMARKS.RIGHT_EYE, LANDMARKS.NOSE],
  // Torso
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP],
  [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP],
  [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
  // Left arm
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW],
  [LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST],
  [LANDMARKS.LEFT_WRIST, LANDMARKS.LEFT_INDEX],
  // Right arm
  [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW],
  [LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST],
  [LANDMARKS.RIGHT_WRIST, LANDMARKS.RIGHT_INDEX],
  // Left leg
  [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE],
  [LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE],
  [LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_FOOT_INDEX],
  [LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_HEEL],
  [LANDMARKS.LEFT_HEEL, LANDMARKS.LEFT_FOOT_INDEX],
  // Right leg
  [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE],
  [LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE],
  [LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_FOOT_INDEX],
  [LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_HEEL],
  [LANDMARKS.RIGHT_HEEL, LANDMARKS.RIGHT_FOOT_INDEX],
];

/**
 * Calculate all named joint angles from a landmarks array.
 * Returns an object with angle values (degrees) or null for missing landmarks.
 */
export function calculateJointAngles(landmarks) {
  if (!landmarks || landmarks.length < 33) return {};

  const L = landmarks;
  const lm = LANDMARKS;

  return {
    leftElbow: angleBetweenPoints(L[lm.LEFT_SHOULDER], L[lm.LEFT_ELBOW], L[lm.LEFT_WRIST]),
    rightElbow: angleBetweenPoints(L[lm.RIGHT_SHOULDER], L[lm.RIGHT_ELBOW], L[lm.RIGHT_WRIST]),
    leftShoulder: angleBetweenPoints(L[lm.LEFT_ELBOW], L[lm.LEFT_SHOULDER], L[lm.LEFT_HIP]),
    rightShoulder: angleBetweenPoints(L[lm.RIGHT_ELBOW], L[lm.RIGHT_SHOULDER], L[lm.RIGHT_HIP]),
    leftHip: angleBetweenPoints(L[lm.LEFT_SHOULDER], L[lm.LEFT_HIP], L[lm.LEFT_KNEE]),
    rightHip: angleBetweenPoints(L[lm.RIGHT_SHOULDER], L[lm.RIGHT_HIP], L[lm.RIGHT_KNEE]),
    leftKnee: angleBetweenPoints(L[lm.LEFT_HIP], L[lm.LEFT_KNEE], L[lm.LEFT_ANKLE]),
    rightKnee: angleBetweenPoints(L[lm.RIGHT_HIP], L[lm.RIGHT_KNEE], L[lm.RIGHT_ANKLE]),
    leftAnkle: angleBetweenPoints(L[lm.LEFT_KNEE], L[lm.LEFT_ANKLE], L[lm.LEFT_FOOT_INDEX]),
    rightAnkle: angleBetweenPoints(L[lm.RIGHT_KNEE], L[lm.RIGHT_ANKLE], L[lm.RIGHT_FOOT_INDEX]),
  };
}

/**
 * Draw landmarks and skeleton on a canvas context.
 */
export function drawPoseOnCanvas(ctx, landmarks, canvasWidth, canvasHeight, options = {}) {
  const {
    landmarkColor = '#00d4aa',
    boneColor = 'rgba(0, 212, 170, 0.7)',
    landmarkRadius = 5,
    lineWidth = 2.5,
    highlightIndices = [],
    highlightColor = '#f4a261',
    mirrorX = true,
  } = options;

  if (!landmarks || landmarks.length === 0) return;

  // Draw bones
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = boneColor;
  ctx.lineCap = 'round';

  for (const [startIdx, endIdx] of SKELETON_CONNECTIONS) {
    const start = landmarks[startIdx];
    const end = landmarks[endIdx];

    if (!start || !end) continue;
    if (
      (start.visibility !== undefined && start.visibility < MIN_VISIBILITY) ||
      (end.visibility !== undefined && end.visibility < MIN_VISIBILITY)
    ) continue;

    const sx = mirrorX ? (1 - start.x) * canvasWidth : start.x * canvasWidth;
    const sy = start.y * canvasHeight;
    const ex = mirrorX ? (1 - end.x) * canvasWidth : end.x * canvasWidth;
    const ey = end.y * canvasHeight;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  // Draw landmarks
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm) continue;
    if (lm.visibility !== undefined && lm.visibility < MIN_VISIBILITY) continue;

    const x = mirrorX ? (1 - lm.x) * canvasWidth : lm.x * canvasWidth;
    const y = lm.y * canvasHeight;
    const isHighlighted = highlightIndices.includes(i);

    ctx.beginPath();
    ctx.arc(x, y, isHighlighted ? landmarkRadius * 1.6 : landmarkRadius, 0, 2 * Math.PI);
    ctx.fillStyle = isHighlighted ? highlightColor : landmarkColor;
    ctx.fill();

    if (isHighlighted) {
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
