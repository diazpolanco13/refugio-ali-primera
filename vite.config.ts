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
  // Puerto distinto del default de Vite (5173) para no chocar con otros
  // proyectos en la misma máquina / túneles SSH locales.
  server: {
    port: 5180,
    strictPort: true,
  },
  // Sin proxy: la PWA habla directo con Supabase (Postgres, Auth, Realtime,
  // Storage) vía supabase-js. Ya no hay backend Fastify propio que proxyar.
  optimizeDeps: {
    // Pre-empaqueta las deps pesadas de import dinámico al arrancar el server:
    // si Vite las descubre a mitad de sesión fuerza una re-optimización con
    // recarga completa de la página (era parte del cuelgue de arranque).
    include: ["jspdf", "qrcode", "xlsx"],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Campamentos Transitorios",
        short_name: "Campamentos",
        description:
          "Gestión de campamentos transitorios del Área Metropolitana de Caracas",
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
        // El bundle principal supera el límite por defecto de Workbox (2 MiB)
        // tras añadir MapLibre + recharts. Subimos el tope para que igual se
        // precachee y la PWA siga funcionando offline. (Optimización futura:
        // code-splitting con manualChunks para reducir el chunk inicial.)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Rutas del cliente (/, /dashboard, …) se resuelven al index.html cacheado
        // para que funcionen offline y con deep-link.
        navigateFallback: "index.html",
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
