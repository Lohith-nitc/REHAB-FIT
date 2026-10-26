// Fallback config: plain HTTP, camera only works on localhost (not LAN IP)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: false,
  },
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
})
