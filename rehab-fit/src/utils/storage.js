/**
 * Session persistence using localStorage.
 * Sessions are stored as JSON objects keyed by session ID.
 */

const SESSIONS_KEY = 'rehabfit_sessions';
const MAX_SESSIONS = 50;

export function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSession(session) {
  try {
    const sessions = loadSessions();
    // Prepend new session, keep most recent MAX_SESSIONS
    const updated = [session, ...sessions].slice(0, MAX_SESSIONS);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export function clearSessions() {
  localStorage.removeItem(SESSIONS_KEY);
}

export function getTotals() {
  const sessions = loadSessions();
  return {
    totalSessions: sessions.length,
    totalReps: sessions.reduce((sum, s) => sum + (s.reps || 0), 0),
    totalDurationSec: sessions.reduce((sum, s) => sum + (s.durationSec || 0), 0),
  };
}

export function createSession(exerciseId, exerciseName) {
  return {
    id: `session_${Date.now()}`,
    exerciseId,
    exerciseName,
    startTime: new Date().toISOString(),
    endTime: null,
    reps: 0,
    durationSec: 0,
    feedbackEvents: [],
    angleStats: {},
  };
}

export function finalizeSession(session, reps, durationSec, feedbackEvents, angleStats) {
  return {
    ...session,
    endTime: new Date().toISOString(),
    reps,
    durationSec,
    feedbackEvents,
    angleStats,
  };
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
