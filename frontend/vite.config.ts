import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {resolve} from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        content: resolve(__dirname, 'src/content/content.ts'),
        background: resolve(__dirname, 'src/background/background.ts')
      },
      output: {
        entryFileNames: '[name].js' // 👈 IMPORTANT (no hashing)
      }
    }
  }
})
