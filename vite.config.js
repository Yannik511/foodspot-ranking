import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Erlaubt Zugriff von außen (für iOS Simulatoren)
    port: 5173,
  },
})
