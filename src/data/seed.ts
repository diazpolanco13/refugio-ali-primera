import { api } from "./api";
import { eliminarLinea, eliminarPunto, eliminarSector, guardarPunto, guardarSector } from "./repos";
import { PARQUE_CENTRO, SECTOR_COLORES, type TipoPunto } from "../domain/tipos";
import { db, nuevoId } from "./db";

// Carga datos de ejemplo alrededor del centro del parque para probar la app.
export async function cargarEjemplo(): Promise<void> {
  const [lng, lat] = PARQUE_CENTRO;
  const d = 0.0016; // ~180 m

  const poligono: GeoJSON.Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ],
    ],
  };

  await guardarSector({
    nombre: "A",
    geom: poligono,
    color: SECTOR_COLORES[0],
    responsables: [
      {
        id: nuevoId(),
        nombre: "María Pérez",
        telefono: "04141234567",
        categoria: "funcionario",
        funcion: "Coordinación general",
      },
      {
        id: nuevoId(),
        nombre: "José Rodríguez",
        telefono: "04249876543",
        categoria: "voluntario",
        funcion: "Recolección de basura",
      },
    ],
    carpas: 45,
    poblacion_estimada: 800,
    familias: 200,
    vulnerables: {
      recien_nacidos_h: 12,
      recien_nacidos_m: 10,
      ninos: 96,
      ninas: 92,
      adolescentes_h: 48,
      adolescentes_m: 45,
      adultos_h: 200,
      adultos_m: 232,
      adultos_mayores_h: 30,
      adultos_mayores_m: 35,
      embarazadas: 18,
      discapacidad_h: 6,
      discapacidad_m: 6,
      mascotas: 14,
    },
    notas: "Sector de ejemplo generado automáticamente.",
  });

  const H = 3_600_000;
  const puntos: {
    tipo: TipoPunto;
    nombre: string;
    dx: number;
    dy: number;
    cap: number;
    freq?: number;
    haceHoras?: number;
  }[] = [
    { tipo: "hidratacion", nombre: "Tanque de agua 1", dx: -0.0008, dy: 0.0006, cap: 250 },
    { tipo: "comida", nombre: "Comedor central", dx: 0.0004, dy: 0.0008, cap: 500 },
    { tipo: "salud", nombre: "Puesto médico", dx: 0.0009, dy: -0.0004, cap: 4 },
    { tipo: "sanitarios", nombre: "Baños portátiles", dx: -0.0006, dy: -0.0007, cap: 6, freq: 8, haceHoras: 3 },
    { tipo: "duchas", nombre: "Duchas mujeres", dx: -0.0009, dy: -0.0004, cap: 3, freq: 8, haceHoras: 7 },
    { tipo: "residuos", nombre: "Punto de basura", dx: 0.0002, dy: -0.0009, cap: 4, freq: 12, haceHoras: 13 },
    { tipo: "carpa", nombre: "Campamento familias", dx: -0.0002, dy: 0.0002, cap: 120 },
  ];

  for (const p of puntos) {
    await guardarPunto({
      tipo: p.tipo,
      nombre: p.nombre,
      geom: { type: "Point", coordinates: [lng + p.dx, lat + p.dy] },
      estado: "operativo",
      capacidad: p.cap,
      frecuenciaLimpiezaHoras: p.freq,
      ultimaLimpieza: p.haceHoras != null ? Date.now() - p.haceHoras * H : undefined,
      notas: "",
    });
  }
}

export async function limpiarTodo(): Promise<void> {
  // Borrado suave (encola tombstones) para que la baja se propague al servidor.
  const [sectores, puntos, lineas] = await Promise.all([
    db.sectores.toArray(),
    db.puntos.toArray(),
    db.lineas.toArray(),
  ]);
  for (const s of sectores) await eliminarSector(s.id);
  for (const p of puntos) await eliminarPunto(p.id);
  for (const l of lineas) await eliminarLinea(l.id);
}

/** Borra mapa local + servidor (admin). Resuelve datos que reaparecen tras limpiar caché. */
export async function vaciarMapaCompleto(): Promise<{ online: boolean }> {
  let serverTime: number | undefined;
  let online = false;
  try {
    const r = await api.purgeMapa();
    serverTime = r.serverTime;
    online = true;
  } catch {
    /* sin conexión o sin sesión: solo vaciado local */
  }

  await db.transaction("rw", [db.sectores, db.puntos, db.lineas, db.outbox], async () => {
    await db.sectores.clear();
    await db.puntos.clear();
    await db.lineas.clear();
    await db.outbox.clear();
  });

  if (serverTime != null) {
    try {
      localStorage.setItem("refugio.lastSync", String(serverTime));
    } catch {
      /* ignore */
    }
  }

  return { online };
}
