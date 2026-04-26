import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa/icon-192.png', 'pwa/icon-512.png'],
      manifest: {
        name: 'Rankify',
        short_name: 'Rankify',
        description: 'Foodspot Ranking – private und geteilte Foodspot-Listen.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#1a1a1a',
        theme_color: '#FF7E42',
        icons: [
          {
            src: '/pwa/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        // App Shell cachen (JS, CSS, HTML)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // Supabase & externe Anfragen: network-first (immer frische Daten)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 Minuten
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 Jahr
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // SW nur im Production Build aktiv
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
