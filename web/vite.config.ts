import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy charting library into its own chunk
          recharts: ['recharts'],
          // Split drag-and-drop into its own chunk
          dnd: ['react-dnd', 'react-dnd-html5-backend'],
          // Core vendor chunk (React, router, state)
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          // Date utilities
          'date-fns': ['date-fns'],
        },
      },
    },
    // Raise limit since we've split chunks intentionally
    chunkSizeWarningLimit: 600,
  },
})
