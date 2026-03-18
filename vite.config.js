import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        organigrama: resolve(__dirname, 'organigrama.html'),
        calendario: resolve(__dirname, 'calendario.html'),
        agenda: resolve(__dirname, 'agenda.html'),
        fichadas: resolve(__dirname, 'fichadas.html'),
      },
    },
  },
})
