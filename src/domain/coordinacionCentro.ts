import {
  MAX_PERSONAL_CATEGORIA,
  normalizarPersonal,
  normalizarServicios,
  PERSONAL_VACIO,
  SERVICIOS_VACIOS,
  type CentroTransitorio,
  type PersonalCentro,
  type RespuestaLevantamiento,
  type ServiciosCentro,
} from "./centrosTransitorios";
import type { Responsable } from "./tipos";

/** Entero no negativo; por encima del tope se trata como dato corrupto (p. ej. teléfono). */
function enteroPersonalMando(valor: unknown): number {
  const n = Math.max(0, Math.floor(Number(valor) || 0));
  if (n > MAX_PERSONAL_CATEGORIA) return 0;
  return n;
}

/** Ámbito de responsabilidad dentro de la coordinación del campamento. */
export type CategoriaResponsabilidadCoordinacion =
  | "politica"
  | "seguridad"
  | "supervision_rotatoria"
  | "comunitaria"
  | "analista_sae"
  | "salud"
  | "justicia";

export type SubtipoPersonalCoordinacion =
  | "medico"
  | "psicologo"
  | "funcionario"
  | "trabajador"
  | "justicia_tjs"
  | "justicia_mp"
  | "justicia_defensoria"
  | "seguridad";

export interface ItemLogisticaCoordinacion {
  clave: string;
  label: string;
  disponible: boolean;
  cantidad: number;
}

export interface TransporteCoordinacion {
  vehiculos: number;
}

export interface ResponsableCoordinacion {
  id: string;
  nombre: string;
  cedula: string;
  ente: string;
  categoria: CategoriaResponsabilidadCoordinacion;
  subtipo: SubtipoPersonalCoordinacion;
  personal_mando: number;
  telefonos: string[];
  logistica: ItemLogisticaCoordinacion[];
  transporte: TransporteCoordinacion;
}

export const CATEGORIAS_RESPONSABILIDAD_COORDINACION: {
  valor: CategoriaResponsabilidadCoordinacion;
  label: string;
  color: string;
}[] = [
  { valor: "comunitaria", label: "Ente encargado", color: "#a855f7" },
  { valor: "supervision_rotatoria", label: "Supervisión rotatoria", color: "#ca8a04" },
  { valor: "analista_sae", label: "Analista", color: "#0d9488" },
  { valor: "politica", label: "Responsabilidad política", color: "#3b82f6" },
  { valor: "seguridad", label: "Seguridad física", color: "#4d7c0f" },
  { valor: "salud", label: "Coordinación de salud", color: "#e11d48" },
  { valor: "justicia", label: "Coordinación de justicia", color: "#d97706" },
];

/**
 * Pestañas de la UI de Coordinación. Supervisión muestra la asignación
 * operativa (`cuerpo` + `supervision.*`); el resto usa responsables_coordinacion.
 * Orden: Ente encargado primero; Supervisión sin cambios de contenido.
 */
export type IdPestanaCoordinacion = Exclude<
  CategoriaResponsabilidadCoordinacion,
  "analista_sae"
>;

export const PESTANAS_COORDINACION: {
  id: IdPestanaCoordinacion;
  label: string;
  labelCorto: string;
  color: string;
  categorias: CategoriaResponsabilidadCoordinacion[];
}[] = [
  {
    id: "comunitaria",
    label: "Ente encargado",
    labelCorto: "Ente encargado",
    color: "#a855f7",
    categorias: ["comunitaria"],
  },
  {
    id: "supervision_rotatoria",
    label: "Supervisión",
    labelCorto: "Supervisión",
    color: "#ca8a04",
    categorias: ["supervision_rotatoria", "analista_sae"],
  },
  {
    id: "politica",
    label: "Responsabilidad política",
    labelCorto: "Política",
    color: "#3b82f6",
    categorias: ["politica"],
  },
  {
    id: "seguridad",
    label: "Seguridad física",
    labelCorto: "Seguridad",
    color: "#4d7c0f",
    categorias: ["seguridad"],
  },
  {
    id: "salud",
    label: "Coordinación de salud",
    labelCorto: "Salud",
    color: "#e11d48",
    categorias: ["salud"],
  },
  {
    id: "justicia",
    label: "Coordinación de justicia",
    labelCorto: "Justicia",
    color: "#d97706",
    categorias: ["justicia"],
  },
];

/**
 * Ámbitos editables desde el portal de terreno (/terreno): las mismas
 * pestañas de autoridades del directorio del centro, sin Supervisión
 * (esa se gestiona en la app con usuario).
 */
export const PESTANAS_AUTORIDADES_TERRENO = PESTANAS_COORDINACION.filter(
  (p) => p.id !== "supervision_rotatoria",
);

export const CATEGORIAS_AUTORIDADES_TERRENO: CategoriaResponsabilidadCoordinacion[] =
  PESTANAS_AUTORIDADES_TERRENO.flatMap((p) => p.categorias);

/** Pestaña UI que contiene una categoría de responsabilidad. */
export function pestanaDeCategoria(
  categoria: CategoriaResponsabilidadCoordinacion,
): (typeof PESTANAS_COORDINACION)[number] {
  return (
    PESTANAS_COORDINACION.find((p) => p.categorias.includes(categoria)) ??
    PESTANAS_COORDINACION[0]
  );
}

export const ETIQUETA_SUBTIPO: Record<SubtipoPersonalCoordinacion, string> = {
  medico: "Médico",
  psicologo: "Psicólogo",
  funcionario: "Funcionario",
  trabajador: "Trabajador",
  justicia_tjs: "TJS / Juez de paz",
  justicia_mp: "Ministerio Público",
  justicia_defensoria: "Defensoría del Pueblo",
  seguridad: "Seguridad",
};

interface ConfigCategoriaCoordinacion {
  subtipos: SubtipoPersonalCoordinacion[];
  logistica: { clave: string; label: string }[];
  transporte: boolean;
}

export const CONFIG_CATEGORIA_COORDINACION: Record<
  CategoriaResponsabilidadCoordinacion,
  ConfigCategoriaCoordinacion
> = {
  politica: { subtipos: ["funcionario", "trabajador"], logistica: [], transporte: true },
  seguridad: { subtipos: ["seguridad"], logistica: [], transporte: true },
  salud: {
    subtipos: ["medico", "psicologo"],
    logistica: [{ clave: "ambulancias", label: "Ambulancia" }],
    transporte: true,
  },
  justicia: {
    subtipos: ["justicia_tjs", "justicia_mp", "justicia_defensoria"],
    logistica: [],
    transporte: false,
  },
  supervision_rotatoria: { subtipos: ["funcionario", "trabajador"], logistica: [], transporte: true },
  comunitaria: { subtipos: ["funcionario", "trabajador"], logistica: [], transporte: false },
  analista_sae: { subtipos: ["funcionario"], logistica: [], transporte: false },
};

function esCategoriaCoordinacion(v: unknown): v is CategoriaResponsabilidadCoordinacion {
  return (
    v === "politica" ||
    v === "seguridad" ||
    v === "supervision_rotatoria" ||
    v === "comunitaria" ||
    v === "analista_sae" ||
    v === "salud" ||
    v === "justicia"
  );
}

function esSubtipoCoordinacion(v: unknown): v is SubtipoPersonalCoordinacion {
  return typeof v === "string" && v in ETIQUETA_SUBTIPO;
}

export function subtipoDefault(categoria: CategoriaResponsabilidadCoordinacion): SubtipoPersonalCoordinacion {
  return CONFIG_CATEGORIA_COORDINACION[categoria].subtipos[0];
}

export const subtipoDefaultCategoria = subtipoDefault;

export function labelSubtipoCoordinacion(subtipo: SubtipoPersonalCoordinacion): string {
  return ETIQUETA_SUBTIPO[subtipo];
}

export function configCategoriaCoordinacion(categoria: CategoriaResponsabilidadCoordinacion) {
  const cfg = CONFIG_CATEGORIA_COORDINACION[categoria];
  return {
    subtipos: cfg.subtipos.map((valor) => ({ valor, label: ETIQUETA_SUBTIPO[valor] })),
    logistica: cfg.logistica,
    transporte: cfg.transporte,
  };
}

export function logisticaDefault(categoria: CategoriaResponsabilidadCoordinacion): ItemLogisticaCoordinacion[] {
  return CONFIG_CATEGORIA_COORDINACION[categoria].logistica.map((item) => ({
    ...item,
    disponible: false,
    cantidad: 0,
  }));
}

export const logisticaDefaultCategoria = logisticaDefault;

export function nuevoIdCoordinacion(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function responsableCoordinacionVacio(
  categoria: CategoriaResponsabilidadCoordinacion = "politica",
): ResponsableCoordinacion {
  return {
    id: nuevoIdCoordinacion(),
    nombre: "",
    cedula: "",
    ente: "",
    categoria,
    subtipo: subtipoDefault(categoria),
    personal_mando: 0,
    telefonos: [""],
    logistica: logisticaDefault(categoria),
    transporte: { vehiculos: 0 },
  };
}

function normalizarLogistica(
  items: Partial<ItemLogisticaCoordinacion>[] | undefined,
  categoria: CategoriaResponsabilidadCoordinacion,
): ItemLogisticaCoordinacion[] {
  const defaults = logisticaDefault(categoria);
  if (!Array.isArray(items) || items.length === 0) return defaults;
  return defaults.map((def) => {
    const found = items.find((i) => i.clave === def.clave);
    return {
      clave: def.clave,
      label: def.label,
      disponible: Boolean(found?.disponible),
      cantidad: Math.max(0, Number(found?.cantidad) || 0),
    };
  });
}

export function normalizarResponsableCoordinacion(
  r: Partial<ResponsableCoordinacion> & { telefono?: string },
): ResponsableCoordinacion {
  const categoria = esCategoriaCoordinacion(r.categoria) ? r.categoria : "comunitaria";
  let telefonos: string[] = [];
  if (Array.isArray(r.telefonos)) {
    telefonos = r.telefonos.map((t) => String(t).trim()).filter(Boolean);
  } else if (r.telefono?.trim()) {
    telefonos = [r.telefono.trim()];
  }

  const subtipo = esSubtipoCoordinacion(r.subtipo) ? r.subtipo : subtipoDefault(categoria);

  return {
    id: r.id?.trim() || nuevoIdCoordinacion(),
    nombre: r.nombre?.trim() ?? "",
    cedula: r.cedula?.trim() ?? "",
    ente: r.ente?.trim() ?? "",
    categoria,
    subtipo,
    // Tope igual que personal operativo: un teléfono pegado aquí se
    // propagaba a `centros.data.personal` vía syncCentroDesdeCoordinacion.
    personal_mando: enteroPersonalMando(r.personal_mando),
    telefonos,
    logistica: normalizarLogistica(r.logistica, categoria),
    transporte: {
      vehiculos: Math.max(0, Number(r.transporte?.vehiculos) || 0),
    },
  };
}

export function responsableCoordinacionTieneDatos(r: ResponsableCoordinacion): boolean {
  return Boolean(
    r.nombre.trim() ||
      r.ente.trim() ||
      r.telefonos.some((t) => t.trim()) ||
      r.personal_mando > 0 ||
      r.logistica.some((l) => l.disponible || l.cantidad > 0) ||
      r.transporte.vehiculos > 0,
  );
}

export function prepararResponsablesCoordinacionParaGuardar(
  items: ResponsableCoordinacion[],
): ResponsableCoordinacion[] {
  return items.filter(responsableCoordinacionTieneDatos).map((r) => normalizarResponsableCoordinacion(r));
}

export function asegurarIdsResponsablesCoordinacion(
  lista: ResponsableCoordinacion[],
): ResponsableCoordinacion[] {
  const vistos = new Set<string>();
  return lista.map((r) => {
    let id = r.id?.trim() || nuevoIdCoordinacion();
    while (vistos.has(id)) id = nuevoIdCoordinacion();
    vistos.add(id);
    return { ...r, id };
  });
}

function categoriaLegacyResponsable(r: Responsable): CategoriaResponsabilidadCoordinacion {
  const texto = `${r.funcion ?? ""} ${r.nombre ?? ""}`.toLowerCase();
  if (texto.includes("sae") || texto.includes("analista")) return "analista_sae";
  if (texto.includes("médico") || texto.includes("medico") || texto.includes("salud")) return "salud";
  if (texto.includes("psicolog")) return "salud";
  if (texto.includes("justicia") || texto.includes("tjs") || texto.includes("defensor")) {
    return "justicia";
  }
  if (texto.includes("supervisor") || texto.includes("supervisión") || texto.includes("supervision")) {
    return "supervision_rotatoria";
  }
  if (texto.includes("sebin") || texto.includes("seguridad") || texto.includes("gnb")) {
    return "seguridad";
  }
  return "comunitaria";
}

function migrarPersonalLegacy(c: CentroTransitorio, out: ResponsableCoordinacion[]): void {
  const p = normalizarPersonal(c.personal);
  const serv = normalizarServicios(c.servicios);

  if (p.medicos > 0 || serv.medicos === true) {
    out.push(
      normalizarResponsableCoordinacion({
        id: nuevoIdCoordinacion(),
        nombre: "Personal médico",
        categoria: "salud",
        subtipo: "medico",
        personal_mando: p.medicos,
        logistica: [
          {
            clave: "ambulancias",
            label: "Ambulancia",
            disponible: serv.ambulancias === true,
            cantidad: serv.ambulancias === true ? 1 : 0,
          },
        ],
      }),
    );
  }

  if (p.psicologos > 0 || serv.psicologo === true) {
    out.push(
      normalizarResponsableCoordinacion({
        id: nuevoIdCoordinacion(),
        nombre: "Personal psicosocial",
        categoria: "salud",
        subtipo: "psicologo",
        personal_mando: p.psicologos,
      }),
    );
  }

  if (p.justicia_tjs > 0 || serv.contacto_juez_paz === true) {
    out.push(
      normalizarResponsableCoordinacion({
        id: nuevoIdCoordinacion(),
        categoria: "justicia",
        subtipo: "justicia_tjs",
        nombre: "Funcionarios TJS",
        personal_mando: p.justicia_tjs,
      }),
    );
  }
  if (p.justicia_mp > 0) {
    out.push(
      normalizarResponsableCoordinacion({
        id: nuevoIdCoordinacion(),
        categoria: "justicia",
        subtipo: "justicia_mp",
        nombre: "Ministerio Público",
        personal_mando: p.justicia_mp,
      }),
    );
  }
  if (p.justicia_defensoria > 0) {
    out.push(
      normalizarResponsableCoordinacion({
        id: nuevoIdCoordinacion(),
        categoria: "justicia",
        subtipo: "justicia_defensoria",
        nombre: "Defensoría del Pueblo",
        personal_mando: p.justicia_defensoria,
      }),
    );
  }

  if (p.funcionarios > 0) {
    out.push(
      normalizarResponsableCoordinacion({
        id: nuevoIdCoordinacion(),
        categoria: "comunitaria",
        subtipo: "funcionario",
        nombre: "Funcionarios operativos",
        personal_mando: p.funcionarios,
      }),
    );
  }
  if (p.trabajadores > 0) {
    out.push(
      normalizarResponsableCoordinacion({
        id: nuevoIdCoordinacion(),
        categoria: "comunitaria",
        subtipo: "trabajador",
        nombre: "Trabajadores",
        personal_mando: p.trabajadores,
      }),
    );
  }
}

function migrarLegacyCoordinacion(c: CentroTransitorio): ResponsableCoordinacion[] {
  const out: ResponsableCoordinacion[] = [];

  const cp = c.coord_politico;
  if (cp?.nombre?.trim()) {
    out.push(
      normalizarResponsableCoordinacion({
        id: nuevoIdCoordinacion(),
        nombre: cp.nombre,
        cedula: cp.cedula ?? "",
        ente: cp.ente ?? "",
        categoria: "politica",
        subtipo: "funcionario",
        telefonos: cp.telefono?.trim() ? [cp.telefono] : [],
      }),
    );
  }

  const cm = c.coord_ministerial;
  if (cm?.nombre?.trim()) {
    out.push(
      normalizarResponsableCoordinacion({
        id: nuevoIdCoordinacion(),
        nombre: cm.nombre,
        cedula: cm.cedula ?? "",
        ente: cm.ente ?? "",
        categoria: "politica",
        subtipo: "funcionario",
        telefonos: cm.telefono?.trim() ? [cm.telefono] : [],
      }),
    );
  }

  const seg = c.seguridad;
  if (
    seg?.nombre?.trim() ||
    seg?.telefono?.trim() ||
    (seg?.personal_mando ?? 0) > 0 ||
    (seg?.vehiculos ?? 0) > 0
  ) {
    out.push(
      normalizarResponsableCoordinacion({
        id: nuevoIdCoordinacion(),
        nombre: seg?.nombre ?? "",
        cedula: seg?.cedula ?? "",
        ente: seg?.organismo?.trim() || c.cuerpo || "",
        categoria: "seguridad",
        subtipo: "seguridad",
        personal_mando: seg?.personal_mando ?? 0,
        telefonos: seg?.telefono?.trim() ? [seg.telefono] : [],
        transporte: { vehiculos: seg?.vehiculos ?? 0 },
      }),
    );
  }

  for (const r of c.responsables ?? []) {
    if (!legacyResponsableTieneDatos(r)) continue;
    const cat = categoriaLegacyResponsable(r);
    out.push(
      normalizarResponsableCoordinacion({
        id: r.id,
        nombre: r.nombre,
        ente: r.funcion ?? "",
        categoria: cat,
        subtipo: subtipoDefault(cat),
        telefonos: r.telefono?.trim() ? [r.telefono] : [],
      }),
    );
  }

  migrarPersonalLegacy(c, out);
  return out;
}

function legacyResponsableTieneDatos(r: Responsable): boolean {
  return Boolean(r.nombre?.trim() || r.telefono?.trim());
}

export function responsablesCoordinacionDeCentro(c: CentroTransitorio): ResponsableCoordinacion[] {
  if (Array.isArray(c.responsables_coordinacion) && c.responsables_coordinacion.length > 0) {
    return asegurarIdsResponsablesCoordinacion(
      c.responsables_coordinacion.map(normalizarResponsableCoordinacion),
    );
  }
  return migrarLegacyCoordinacion(c);
}

export function metaCategoriaCoordinacion(categoria: CategoriaResponsabilidadCoordinacion) {
  return (
    CATEGORIAS_RESPONSABILIDAD_COORDINACION.find((c) => c.valor === categoria) ??
    CATEGORIAS_RESPONSABILIDAD_COORDINACION.find((c) => c.valor === "comunitaria")!
  );
}

const CAMPO_PERSONAL: Record<SubtipoPersonalCoordinacion, keyof PersonalCentro> = {
  medico: "medicos",
  psicologo: "psicologos",
  funcionario: "funcionarios",
  trabajador: "trabajadores",
  justicia_tjs: "justicia_tjs",
  justicia_mp: "justicia_mp",
  justicia_defensoria: "justicia_defensoria",
  seguridad: "funcionarios",
};

function respuestaServicio(disponible: boolean, hayResponsable: boolean): RespuestaLevantamiento {
  if (disponible || hayResponsable) return true;
  return null;
}

/** Recalcula personal y servicios del centro desde responsables de coordinación. */
export function syncCentroDesdeCoordinacion(
  _centro: CentroTransitorio,
  responsables: ResponsableCoordinacion[],
): Pick<CentroTransitorio, "personal" | "servicios"> {
  const personal: PersonalCentro = { ...PERSONAL_VACIO };
  const servicios: ServiciosCentro = { ...SERVICIOS_VACIOS };

  let hayMedico = false;
  let hayPsicologo = false;
  let hayTjs = false;
  let ambulanciasDisponible = false;

  for (const r of responsables.filter(responsableCoordinacionTieneDatos)) {
    const n = normalizarResponsableCoordinacion(r);
    const campo = CAMPO_PERSONAL[n.subtipo];
    personal[campo] += n.personal_mando;

    if (n.subtipo === "medico") hayMedico = hayMedico || n.nombre.trim().length > 0 || n.personal_mando > 0;
    if (n.subtipo === "psicologo") {
      hayPsicologo = hayPsicologo || n.nombre.trim().length > 0 || n.personal_mando > 0;
    }
    if (n.subtipo === "justicia_tjs") {
      hayTjs = hayTjs || n.nombre.trim().length > 0 || n.personal_mando > 0;
    }

    if (n.categoria === "salud") {
      for (const item of n.logistica) {
        if (item.clave === "ambulancias" && (item.disponible || item.cantidad > 0)) {
          ambulanciasDisponible = true;
        }
      }
    }
  }

  servicios.medicos = respuestaServicio(hayMedico, hayMedico);
  servicios.psicologo = respuestaServicio(hayPsicologo, hayPsicologo);
  servicios.contacto_juez_paz = respuestaServicio(hayTjs, hayTjs);
  servicios.ambulancias = ambulanciasDisponible ? true : null;

  return {
    personal: normalizarPersonal(personal),
    servicios: normalizarServicios(servicios),
  };
}
