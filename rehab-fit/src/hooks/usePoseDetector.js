/**
 * usePoseDetector — React hook wrapping MediaPipe PoseLandmarker.
 *
 * Returns:
 *   { detector, isLoading, error, isReady }
 *
 * The detector exposes:
 *   detectFromVideo(videoElement, timestampMs) → landmarks[]
 *   detectFromImage(imageElement) → landmarks[]
 *   close()
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

export function usePoseDetector() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const detectorRef = useRef(null);
  const visionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function initDetector() {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamically import to avoid SSR issues
        const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

        if (cancelled) return;

        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

        if (cancelled) return;

        visionRef.current = vision;

        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (cancelled) return;

        detectorRef.current = poseLandmarker;

        if (!cancelled) {
          setIsReady(true);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[REHAB-FIT] Pose detector init failed:', err);
          // Try CPU fallback
          try {
            const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
            const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
            const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: MODEL_URL,
                delegate: 'CPU',
              },
              runningMode: 'VIDEO',
              numPoses: 1,
            });
            if (!cancelled) {
              detectorRef.current = poseLandmarker;
              setIsReady(true);
              setIsLoading(false);
            }
          } catch (fallbackErr) {
            if (!cancelled) {
              setError(`Pose detection unavailable: ${fallbackErr.message}. Check your internet connection and browser compatibility.`);
              setIsLoading(false);
            }
          }
        }
      }
    }

    initDetector();

    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detectorRef.current) {
        try {
          detectorRef.current.close();
        } catch {}
      }
    };
  }, []);

  const detectFromVideo = useCallback((videoElement, timestampMs) => {
    if (!detectorRef.current || !isReady) return null;
    try {
      const result = detectorRef.current.detectForVideo(videoElement, timestampMs);
      return result?.landmarks?.[0] || null;
    } catch (err) {
      console.warn('[REHAB-FIT] detectForVideo error:', err);
      return null;
    }
  }, [isReady]);

  const detectFromImage = useCallback(async (imageElement) => {
    if (!detectorRef.current || !visionRef.current) return null;
    try {
      // Switch to IMAGE mode for static images
      const { PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const imageLandmarker = await PoseLandmarker.createFromOptions(visionRef.current, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
      const result = imageLandmarker.detect(imageElement);
      imageLandmarker.close();
      return result?.landmarks?.[0] || null;
    } catch (err) {
      console.warn('[REHAB-FIT] detectFromImage error:', err);
      return null;
    }
  }, []);

  return {
    isLoading,
    error,
    isReady,
    detectFromVideo,
    detectFromImage,
  };
}
