import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// relative base so the build works under https://<user>.github.io/<repo>/
export default defineConfig({ plugins: [vue()], base: './' })
