/**
 * useCamera — manages webcam stream lifecycle.
 * Requests camera only when startCamera() is called.
 * Automatically releases stream on stopCamera() or unmount.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export function useCamera() {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [availableCameras, setAvailableCameras] = useState([]);
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  // Enumerate cameras on mount
  useEffect(() => {
    async function enumCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === 'videoinput');
        setAvailableCameras(cams);
      } catch {
        // Enumeration may fail before permission is granted — that's okay
      }
    }
    if (navigator.mediaDevices?.enumerateDevices) {
      enumCameras();
    }
  }, []);

  const startCamera = useCallback(async (facing = 'user') => {
    // Camera requires a secure context (HTTPS or localhost).
    // On a LAN IP over plain HTTP the API is present but silently blocked.
    if (!window.isSecureContext) {
      setError(
        'HTTPS_REQUIRED'
      );
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera API not available. Please use Chrome, Firefox, or Safari.');
      return false;
    }

    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    setError(null);
    setFacingMode(facing);

    const constraints = {
      video: {
        facingMode: facing,
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 30, min: 15 },
      },
      audio: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setIsActive(true);
      setError(null);

      // Re-enumerate now that we have permission
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAvailableCameras(devices.filter(d => d.kind === 'videoinput'));
      } catch {}

      return true;
    } catch (err) {
      let message = 'Camera access failed.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission denied. Allow camera access in your browser settings and reload the page.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera found. Connect a webcam and try again.';
      } else if (err.name === 'NotReadableError') {
        message = 'Camera is in use by another application. Close other apps using the camera.';
      } else if (err.name === 'OverconstrainedError') {
        // Retry without ideal constraints
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
          }
          setIsActive(true);
          return true;
        } catch {
          message = 'Camera constraints not met. Try a different camera or browser.';
        }
      } else {
        message = `Camera error: ${err.message}`;
      }
      setError(message);
      setIsActive(false);
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const switchCamera = useCallback(async () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(next);
  }, [facingMode, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return {
    videoRef,
    isActive,
    error,
    facingMode,
    availableCameras,
    startCamera,
    stopCamera,
    switchCamera,
  };
}
