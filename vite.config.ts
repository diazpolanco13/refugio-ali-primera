import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
