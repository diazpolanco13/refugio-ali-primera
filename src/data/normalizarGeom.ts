// Normaliza el campo `geom` (geography Point de PostGIS) al formato que
// espera el frontend: un GeoJSON Point `{ type: "Point", coordinates: [lng, lat] }`
// o `null`.
//
// Supabase/PostgREST serializa la columna `geography(Point, 4326)` como un
// string hex EWKB (p. ej. "0101000020E610000066AD8E091EBA50C02FDD240681F52440"),
// no como GeoJSON. El código de mapa (MapLibre) asume la forma GeoJSON, así que
// hay que convertir. Esta función es tolerante: acepta null, objeto GeoJSON ya,
// string GeoJSON, string WKT "POINT(lng lat)" o string EWKB hex, y devuelve
// siempre lo mismo.

type GeoJSONPoint = { type: "Point"; coordinates: [number, number] };

const RE_WKT_POINT = /^POINT\s*\(\s*([-+0-9.]+)\s+([-+0-9.]+)\s*\)$/i;
const RE_HEX_EWKB = /^[0-9a-f]+$/i;

/** Convierte un double de 8 bytes en little/big endian desde un DataView. */
function leerDouble(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getFloat64(offset, littleEndian);
}

/**
 * Parsea un string hex EWKB que represente un Point (con o sin SRID) y devuelve
 * `[lng, lat]`. Soporta solo Point; otros tipos devuelven null.
 */
function parsearEwkbPunto(hex: string): [number, number] | null {
  // 1 byte byteorder + 4 bytes tipo (+ 4 bytes SRID si flag) + 8 X + 8 Y = 21 o 25 bytes
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  if (bytes.length < 21) return null;
  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  // tipo: uint32 en byte 1. El flag 0x20000000 indica SRID embebido.
  const tipo = view.getUint32(1, littleEndian);
  const geomType = tipo & 0x0fffffff;
  if (geomType !== 1) return null; // 1 = Point
  const tieneSrid = (tipo & 0x20000000) !== 0;
  let offset = 5;
  if (tieneSrid) {
    offset += 4; // saltar SRID (no lo necesitamos para coords)
  }
  if (bytes.length < offset + 16) return null;
  const x = leerDouble(view, offset, littleEndian); // lng
  const y = leerDouble(view, offset + 8, littleEndian); // lat
  return [x, y];
}

/**
 * Normaliza `raw` (lo que llega en `fila.geom` desde Supabase) a un GeoJSON
 * Point o `null`. Acepta:
 *  - null/undefined → null
 *  - GeoJSON Point ya → tal cual
 *  - string GeoJSON (`'{"type":"Point","coordinates":[...]}'`) → JSON.parse
 *  - string WKT (`"POINT(lng lat)"`) → regex
 *  - string hex EWKB → parseo binario (solo Point)
 */
export function normalizarGeom(raw: unknown): GeoJSONPoint | null {
  if (raw == null) return null;

  // Objeto GeoJSON ya.
  if (typeof raw === "object") {
    const r = raw as { type?: string; coordinates?: unknown };
    if (r.type === "Point" && Array.isArray(r.coordinates) && r.coordinates.length === 2) {
      const [lng, lat] = r.coordinates as [number, number];
      if (typeof lng === "number" && typeof lat === "number") {
        return { type: "Point", coordinates: [lng, lat] };
      }
    }
    return null;
  }

  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  // String GeoJSON.
  if (s.startsWith("{")) {
    try {
      return normalizarGeom(JSON.parse(s));
    } catch {
      return null;
    }
  }

  // String WKT "POINT(lng lat)".
  const mWkt = s.match(RE_WKT_POINT);
  if (mWkt) {
    const lng = Number(mWkt[1]);
    const lat = Number(mWkt[2]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { type: "Point", coordinates: [lng, lat] };
    }
    return null;
  }

  // String hex EWKB.
  if (RE_HEX_EWKB.test(s) && s.length >= 42) {
    const coords = parsearEwkbPunto(s);
    if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
      return { type: "Point", coordinates: coords };
    }
  }

  return null;
}
