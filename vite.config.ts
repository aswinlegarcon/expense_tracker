import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Must match the GitHub repo name (expense_tracker), not the local folder name.
  base: '/expense_tracker/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Expense Tracker',
        short_name: 'Expenses',
        description: 'Personal income and expense tracker with charts, budgets and recurring transactions',
        display: 'standalone',
        background_color: '#f1f5f9',
        theme_color: '#059669',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell only; Supabase data stays online-first.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/expense_tracker/index.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [{ name: 'recharts', test: /node_modules[\\/](recharts|d3-|victory-vendor)/ }],
        },
      },
    },
  },
})
