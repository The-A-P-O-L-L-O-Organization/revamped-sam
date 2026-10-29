import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Hosted at https://the-a-p-o-l-l-o-organization.github.io/revamped-sam/
  base: '/revamped-sam/',
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
      // The demo talks directly to the library sources; Vite bundles them
      // with the app instead of the committed dist/ build artifacts.
      samjs: path.resolve(dirname, '../src/index.es6'),
    },
  },
  build: {
    // GitHub Pages serves this repository from the "main" branch's /docs
    // directory, so the production bundle lands there directly.
    outDir: '../docs',
    emptyOutDir: true,
  },
})
