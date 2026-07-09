import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    base44({
      legacySDKImports: false,
      hmrNotifier: true
    }),
    react()
  ],
  server: {
    port: 5174
  },
  optimizeDeps: {
    // Suppress deprecation from base44 plugin (Vite now uses rolldown)
    esbuildOptions: undefined
  }
})