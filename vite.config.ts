import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Calls to /api go to the Express server (server/index.js).
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 4000}` },
  },
})
