
import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: process.env.FIGMA_PUBLIC_URL ? `${process.env.FIGMA_PUBLIC_URL}/` : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: process.env.FIGMA_DEV_SERVER_HOST || "0.0.0.0",
    port: Number.parseInt(process.env.PORT || "8443", 10),
    strictPort: true,
    proxy: {
      "/api": {
        // VS Code can reserve 127.0.0.1:3001 for its port-forward service.
        // Use another loopback address so local API requests reach Express.
        target: process.env.API_PROXY_TARGET || "http://127.0.0.2:3001",
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: process.env.FIGMA_DEV_SERVER_HOST || "0.0.0.0",
    port: Number.parseInt(process.env.PORT || "8443", 10),
  },
})
