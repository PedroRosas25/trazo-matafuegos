import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Acabamos de devolverle la vida al diseño
import { VitePWA } from 'vite-plugin-pwa'
//import basicSsl from '@vitejs/plugin-basic-ssl' // 1. Importamos el plugin

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Plugin de Tailwind activado
    //basicSsl(), // 2. Lo activamos acá
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
    }
  }
})