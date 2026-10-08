<<<<<<< HEAD
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
=======
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
>>>>>>> 2fd61da (chore(scaffold): vite + vue 3 + ts + pinia + vue-router)

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
<<<<<<< HEAD
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5174,
    strictPort: false
  },
  test: {
    globals: true,
    environment: 'jsdom',
=======
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
>>>>>>> 2fd61da (chore(scaffold): vite + vue 3 + ts + pinia + vue-router)
    include: ['src/**/*.{test,spec}.ts']
  }
})
