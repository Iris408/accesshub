/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    // Let tests read the sign-in stylesheet as text (?raw) to check the
    // illustration's animation rules; other CSS stays stubbed.
    css: { include: [/public\.css/] },
  },
})
