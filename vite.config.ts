import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/convert': {
        target: 'http://ape:7777', // 后端服务器地址
        changeOrigin: true,       // 更改请求的 Origin 为目标地址
      }
    }
  }
});