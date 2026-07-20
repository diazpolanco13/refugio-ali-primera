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
  // proyectos en la misma máquina / túneles SSH locales. PORT (env) permite
  // que el preview del asistente asigne un puerto libre (autoPort).
  server: {
    port: Number(process.env.PORT) || 5180,
    strictPort: true,
  },
  // Sin proxy: la PWA habla directo con Supabase (Postgres, Auth, Realtime,
  // Storage) vía supabase-js. Ya no hay backend Fastify propio que proxyar.
  optimizeDeps: {
    // Pre-empaqueta deps pesadas al arrancar el server: si Vite las descubre
    // a mitad de sesión fuerza re-optimización + reload (cuelgue de arranque).
    // maplibre + supabase van en el camino crítico de /centros/mapa.
    include: [
      "jspdf",
      "qrcode",
      "xlsx",
      "maplibre-gl",
      "@supabase/supabase-js",
      "react",
      "react-dom",
      "react-router-dom",
    ],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "icon.svg",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
        "icon-512-maskable.png",
      ],
      manifest: {
        id: "/",
        name: "Campamentos Transitorios",
        short_name: "Campamentos",
        description:
          "Gestión de campamentos transitorios del Área Metropolitana de Caracas",
        lang: "es",
        dir: "ltr",
        // La app instalada abre en /: main.tsx decide según el dispositivo
        // (token de terreno sin sesión de operador redirige a /terreno; el
        // resto entra por login/app normal).
        start_url: "/",
        scope: "/",
        theme_color: "#041410",
        background_color: "#041410",
        display: "standalone",
        display_override: ["standalone", "browser"],
        orientation: "any",
        categories: ["productivity", "government"],
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
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
