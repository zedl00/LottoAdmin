import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Tratar etiquetas desconocidas como elementos nativos
          isCustomElement: tag => false,
        }
      }
    })
  ],
  build: {
    outDir: 'dist',
  }
})
