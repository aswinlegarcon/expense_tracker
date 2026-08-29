import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Must match the GitHub repo name (expense_tracker), not the local folder name.
  base: '/expense_tracker/',
  plugins: [react(), tailwindcss()],
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
