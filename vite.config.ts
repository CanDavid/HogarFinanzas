import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/HogarFinanzas/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Hogar Finanzas',
        short_name: 'Finanzas',
        description: 'Finanzas domésticas compartidas y disponibles sin conexión.',
        theme_color: '#173f35',
        background_color: '#f4f1e8',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'es',
        start_url: '/HogarFinanzas/',
        scope: '/HogarFinanzas/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/HogarFinanzas/index.html',
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
