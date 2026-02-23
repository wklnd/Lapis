import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    cssMinify: false,
    minify: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('codemirror') || id.includes('@codemirror') || id.includes('@lezer')) {
            return 'codemirror';
          }
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'codemirror',
      '@codemirror/view',
      '@codemirror/state',
      '@codemirror/language',
      '@codemirror/lang-markdown',
      '@codemirror/commands',
      '@codemirror/autocomplete',
      '@lezer/highlight',
    ]
  }
})