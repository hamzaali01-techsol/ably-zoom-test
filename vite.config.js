import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Required headers for Zoom Video SDK SharedArrayBuffer support
    // These enable canvas-based video rendering in Chrome
    // Using 'credentialless' instead of 'require-corp' to allow Zoom SDK resources
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
})
