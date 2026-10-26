# REHAB-FIT

AI-assisted physiotherapy and exercise monitoring app. Runs entirely in the browser using MediaPipe Pose Landmarker — no server, no API keys, no uploads.

## What it does

- **Live camera tracking** — real-time pose detection with skeletal overlay
- **Joint angle calculations** — elbow, shoulder, hip, knee, ankle
- **Exercise counters** — squats, bicep curls, push-ups with state-machine rep counting
- **Form feedback** — posture cues based on measured landmark geometry
- **Image/video analysis** — upload a photo or video for static pose analysis
- **Session history** — saved locally in localStorage

---

## Quick start (Windows PowerShell)

```powershell
# 1. Open the project directory
cd path\to\rehab-fit

# 2. Install dependencies (first time only)
npm install

# 3. Start the dev server
npm run dev
```

Open **http://localhost:5173** in Chrome or Edge.

> **Note:** The MediaPipe model (~3 MB) is downloaded from Google's CDN on first load. Ensure you have internet access.

---

## Running tests

```powershell
npm test
```

21 tests covering joint-angle geometry and exercise rep-counting logic.

---

## Accessing from an Android phone (same Wi-Fi)

Camera access on mobile browsers requires a **secure context** (HTTPS or localhost). A plain HTTP IP address (e.g. `http://192.168.1.x:5173`) will be blocked by Chrome on Android.

### Option A — mkcert (recommended)

1. Install [mkcert](https://github.com/FiloSottile/mkcert/releases) and add it to PATH.
2. Run:
   ```powershell
   mkcert -install
   mkcert localhost 192.168.1.YOUR_IP
   ```
3. Update `vite.config.js`:
   ```js
   server: {
     host: '0.0.0.0',
     port: 5173,
     https: {
       key: './localhost+1-key.pem',
       cert: './localhost+1.pem',
     },
   }
   ```
4. On your phone, browse to `https://192.168.1.YOUR_IP:5173` and accept the certificate.

### Option B — ngrok (easiest, requires ngrok account)

```powershell
# In a second terminal, after starting npm run dev:
ngrok http 5173
```

Open the `https://...ngrok.io` URL on your phone.

### Option C — Chrome flags (Android only, temporary)

In Chrome on Android, go to `chrome://flags` and enable **"Insecure origins treated as secure"**, add your laptop's IP, then reload. This bypasses the HTTPS requirement for development only.

---

## Technology stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + Vite |
| Pose detection | MediaPipe PoseLandmarker (WASM, runs in browser) |
| Styling | Plain CSS with CSS custom properties |
| Storage | localStorage |
| Testing | Vitest |

No backend required for the browser prototype.

---

## Project structure

```
src/
  hooks/
    useCamera.js          Webcam stream lifecycle
    usePoseDetector.js    MediaPipe initialisation and inference
  utils/
    geometry.js           Angle calculations, landmark constants, canvas drawing
    exercises.js          Squat / BicepCurl / PushUp analyzers
    storage.js            Session persistence (localStorage)
    geometry.test.js      Unit tests
  pages/
    Dashboard.jsx         Home screen
    LiveSession.jsx       Camera + pose overlay + rep counting
    ImageAnalysis.jsx     Static image / video upload analysis
    SessionHistory.jsx    Past sessions with angle stats
  components/
    Nav.jsx               Top navigation
```

---

## Limitations and disclaimers

- **2D estimation only.** Angles are calculated from 2D landmark projections. Depth is not measured. Results may differ from 3D goniometry.
- **Not a medical device.** Feedback is general fitness guidance. Consult a physiotherapist before using for rehabilitation.
- **Lighting and occlusion matter.** Poor lighting, loose clothing, or partial occlusion reduce accuracy. The UI shows a warning when landmarks are not detected.
- **Mobile performance.** On low-end devices, inference may drop below 15 fps. The app shows sampled frames for video analysis to avoid timeouts.
- **Model loading requires internet.** The MediaPipe WASM and model files are loaded from CDN on first use. Subsequent loads are cached by the browser.

---

## Build for production

```powershell
npm run build
npm run preview    # preview the production build locally
```

The `dist/` folder can be served by any static file host (Netlify, Vercel, GitHub Pages).
