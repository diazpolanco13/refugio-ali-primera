import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // En desarrollo, el frontend (5173) reenvía /api y /ws al backend (3001).
  // En producción, Caddy sirve la PWA y proxya /api y /ws en el mismo dominio.
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": { target: "http://localhost:3001", ws: true },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Sala Situacional - Refugio Parque del Oeste",
        short_name: "Refugio PdO",
        description:
          "Sala situacional de monitoreo del refugio transitorio en el Parque del Oeste",
        theme_color: "#0f766e",
        background_color: "#0b1120",
        display: "standalone",
        orientation: "any",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        // Rutas del cliente (/, /dashboard, …) se resuelven al index.html cacheado
        // para que funcionen offline y con deep-link. Excluye la API y el WS.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/ws/],
        // Cachea los tiles de satélite/calles ya visitados para uso sin señal.
        runtimeCaching: [
          {
            urlPattern:
              /^https:\/\/([a-z]+\.)?(arcgisonline\.com|basemaps\.cartocdn\.com|tile\.opentopomap\.org|tile\.openstreetmap\.org|api\.maptiler\.com)\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles",
              expiration: {
                maxEntries: 3000,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
