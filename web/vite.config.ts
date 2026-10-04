import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const server = process.env.SERVER_URL ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': server,
      '/ws': { target: server.replace(/^http/, 'ws'), ws: true },
    },
  },
})
