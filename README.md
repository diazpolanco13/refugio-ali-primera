# Sala Situacional — Refugio Transitorio Parque del Oeste

Herramienta de gestión de campamento (CCCM) para el monitoreo del refugio de
damnificados en el **Parque del Oeste "Alí Primera"** (Caracas), tras la
tragedia de La Guaira. Mapa georreferenciado con sectores, capas de servicios,
detección automática de brechas contra estándares humanitarios (Esfera) y
funcionamiento sin conexión.

## Estado: Fase 1 (MVP local) — funcional

- 🗺️ **4 bases de mapa** (sin clave): Satélite (Esri), **Híbrido** (satélite +
  nombres de calles), Calles (CARTO Voyager) y Topográfico (OpenTopoMap), con
  GPS. Opcional: bases **HD** (MapTiler) con clave gratuita — ver `.env.example`.
- ⬠ Dibujo de **sectores** como polígono irregular (principal) o rectángulo, con
  **color personalizable**, censo, familias y grupos vulnerables.
- 👥 **Responsables múltiples** por sector, cada uno con nombre, teléfono
  (llamada 📞 y WhatsApp 💬 directos), categoría (funcionario, voluntario,
  policía, militar, salud…) y función (basura, baños, censo, coordinación…).
- 📍 **11 capas de puntos** de servicio conmutables (agua, comida, salud,
  sanitarios/baños, duchas, residuos, carpas, recreación, seguridad, energía,
  accesos). Baños y **duchas** son capas separadas, con **género**
  (hombres/mujeres/mixto) y **condición** (cumple estándar / improvisada); las
  improvisadas no cuentan como cobertura que cumple el estándar Esfera.
  Cada punto se dibuja como **marcador** con ícono + cantidad (ej. 🚽 6, 🗑️ 4) y
  anillo de estado; al pasar el mouse muestra la **etiqueta completa** (nombre y
  detalle). Los puntos de **seguridad** muestran organismo, nº de funcionarios y
  movilidad (a pie / moto / patrulla).
- ✏️ **Modo edición de ubicaciones**: arrastra los íconos para reubicarlos y
  edita los **vértices de los sectores** (mover, agregar y quitar puntos del
  polígono). Los cambios se guardan automáticamente.
- 🧹 **Cronómetro de limpieza/recolección** para baños, duchas y basura: se
  define cada cuántas horas deben limpiarse; el responsable marca "limpiado /
  basura recogida" y el temporizador se reinicia. El **anillo del ícono** pasa
  de verde → amarillo → rojo según el tiempo vencido, y el tablero lista el
  estado de todos los puntos (ordenados por urgencia) con acción rápida.
- 📊 **Tablero / Sala situacional**: KPIs globales, semáforo de sectores,
  alertas y cobertura por sector vs. estándares Esfera.
- 🔎 **Zoom ajustable** con control deslizante; la **vista (centro + zoom) se
  guarda en localStorage** y se restaura al reabrir. Default a ~30 m de escala.
- 💾 **Offline-first**: todo se guarda en IndexedDB (Dexie); PWA instalable con
  caché de tiles.

## Ejecutar

```bash
npm install
npm run dev        # desarrollo → http://localhost:5173
npm run build      # build de producción (dist/)
npm run preview    # previsualizar el build
```

Botón **"Cargar ejemplo"** (en el panel, cuando no hay datos) siembra un sector
y varios puntos de prueba para ver el tablero y las alertas en acción.

## Arquitectura

- **React + Vite + TypeScript**, **Tailwind CSS**.
- **MapLibre GL** (mapa) + **Terra Draw** (dibujo de sectores/puntos).
- **Dexie** (IndexedDB) como fuente local; **vite-plugin-pwa** (Workbox) offline.

### Estructura

```
src/
├─ domain/     tipos, estándares Esfera, cálculo de brechas (brechas.ts)
├─ data/       Dexie (db.ts), repositorios (repos.ts), datos de ejemplo (seed.ts)
├─ map/        MapView.tsx (MapLibre + Terra Draw), estiloMapa.ts
├─ features/   sectores/ · puntos/ · tablero/  (formularios y dashboard)
└─ ui/         Modal y clases compartidas
```

## Estándares humanitarios (configurables)

Valores por defecto en `src/domain/estandares.ts`, **a validar contra el Sphere
Handbook 2018**: 1 punto de agua / 250 pers · 1 letrina / 20 pers · 15 L/pers/día
· 1 contenedor / 10 familias · ≥3.5 m² cubiertos/pers.

## Roadmap

- **Fase 2 — Colaboración:** backend **Supabase** (Postgres + PostGIS + Auth +
  Realtime + RLS), sincronización Dexie↔Supabase, roles (admin / coordinador /
  campo / visor), asignación de coordinador por sector.
- **Fase 3 — Inteligencia y sala de control:** vista de pantalla grande,
  superposición de la ilustración del parque, export de reportes (PDF/imagen),
  bitácora/historial.

> **Privacidad:** el modelo usa **conteos agregados** por sector (sin datos
> nominales de personas). Un censo nominal exigiría medidas de protección de
> datos adicionales.
