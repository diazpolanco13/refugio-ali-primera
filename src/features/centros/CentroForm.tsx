import { useRef, useState } from "react";
import {
  BedDouble,
  Camera,
  ClipboardList,
  Droplets,
  HeartPulse,
  Loader2,
  LocateFixed,
  MapPin,
  Package,
  Phone,
  Plus,
  Shield,
  Shirt,
  ShowerHead,
  Trash2,
  Trash,
  Users,
} from "lucide-react";
import { nuevoId, guardarCentro, eliminarCentro } from "@/data/reposSupabase";
import { subirFotoCentro, supabaseDisponible } from "@/data/supabase";
import {
  CATALOGO_CUERPOS,
  ESTADOS_CENTRO,
  normalizarCentro,
  normalizarCuerpo,
  poblacionCentro,
  totalPersonalOperativo,
  personasLogistica,
  type CapacidadCentro,
  type CentroTransitorio,
  type ClaveCuerpo,
  type ContactoReporte,
  type EstadoCentro,
  type ItemRequerimiento,
  type PersonalCentro,
  type SeguridadCentro,
  type ServiciosCentro,
} from "@/domain/centrosTransitorios";
import {
  CATEGORIAS_RESPONSABLE,
  FUNCIONES_COMUNES,
  type Responsable,
  type Vulnerables,
} from "@/domain/tipos";
import { DesgloseDemografico } from "@/features/censo/DesgloseDemografico";
import { DesglosePersonal } from "@/features/censo/DesglosePersonal";
import {
  FormularioContacto,
  FormularioSeguridad,
  FormularioServicios,
} from "@/features/centros/LevantamientoCentro";
import { FormularioRequerimientos } from "@/features/centros/RequerimientosCentro";
import { AccionesContacto } from "@/components/AccionesContacto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  centro: CentroTransitorio;
  soloLectura?: boolean;
  /** true cuando el centro aún no existe en la base (alta de un centro nuevo). */
  esNuevo?: boolean;
  /** Eliminar centros es solo para roles de alcance total (admin/analista SAE). */
  puedeEliminar?: boolean;
  onCerrar: () => void;
}

/** Grupos logísticos válidos del listado de la red. */
const GRUPOS_CENTRO = ["Área Metropolitana", "Gran Caracas"] as const;

type Pestana =
  | "identificacion"
  | "coordinacion"
  | "seguridad"
  | "salud"
  | "poblacion"
  | "novedades"
  | "requerimientos"
  | "capacidad"
  | "contactos";

const PESTANAS: {
  valor: Pestana;
  numero?: string;
  titulo: string;
  icono: typeof BedDouble;
}[] = [
  { valor: "identificacion", numero: "I", titulo: "Identificación", icono: MapPin },
  { valor: "coordinacion", numero: "II", titulo: "Coordinación", icono: ClipboardList },
  { valor: "seguridad", numero: "III", titulo: "Seguridad", icono: Shield },
  { valor: "salud", numero: "IV", titulo: "Salud", icono: HeartPulse },
  { valor: "poblacion", numero: "V", titulo: "Población", icono: Users },
  { valor: "novedades", numero: "VI", titulo: "Novedades", icono: ClipboardList },
  { valor: "requerimientos", titulo: "Requerimientos", icono: Package },
  { valor: "capacidad", titulo: "Capacidad", icono: BedDouble },
  { valor: "contactos", titulo: "Otros contactos", icono: Phone },
];

/**
 * Garantiza que cada responsable tenga un `id` único y no vacío. La migración
 * SAE/SEBIN (y cualquier fuente externa) puede dejar `responsables` sin `id` o
 * con `id` duplicados; sin esto, `actualizarResponsable(id, patch)` no encuentra
 * la fila correcta y el cambio del usuario se pierde silenciosamente.
 */
function asegurarIdsResponsables(lista: Responsable[]): Responsable[] {
  const vistos = new Set<string>();
  return lista.map((r) => {
    const idRaw = (r && r.id) || "";
    if (idRaw && !vistos.has(idRaw)) {
      vistos.add(idRaw);
      return r;
    }
    const nuevo = nuevoId();
    vistos.add(nuevo);
    return { ...r, id: nuevo };
  });
}

/** Formulario de registro/edición del estado de un centro transitorio. */
export function CentroForm({
  centro,
  soloLectura = false,
  esNuevo = false,
  puedeEliminar = false,
  onCerrar,
}: Props) {
  const base = normalizarCentro(centro);

  const [pestana, setPestana] = useState<Pestana>("identificacion");
  const [estado, setEstado] = useState<EstadoCentro>(base.estado);
  const [nombre, setNombre] = useState(base.nombre);
  const [grupo, setGrupo] = useState(base.grupo || GRUPOS_CENTRO[0]);
  const [cuerpo, setCuerpo] = useState(base.cuerpo ?? "");
  const [parroquia, setParroquia] = useState(base.parroquia ?? "");
  const [direccion, setDireccion] = useState(base.direccion ?? "");
  const [mapsUrl, setMapsUrl] = useState(base.mapsUrl ?? "");
  // Coordenadas como texto para permitir edición parcial ("-66.9", "10.48…").
  const [latTexto, setLatTexto] = useState(
    base.geom ? String(base.geom.coordinates[1]) : "",
  );
  const [lngTexto, setLngTexto] = useState(
    base.geom ? String(base.geom.coordinates[0]) : "",
  );
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [errorCoords, setErrorCoords] = useState<string | null>(null);
  const [fechaLevantamiento, setFechaLevantamiento] = useState(base.fecha_levantamiento);
  const [estadoFederativo, setEstadoFederativo] = useState(base.estado_federativo);
  const [municipio, setMunicipio] = useState(base.municipio);
  const [coordPolitico, setCoordPolitico] = useState<ContactoReporte>(base.coord_politico);
  const [coordMinisterial, setCoordMinisterial] = useState<ContactoReporte>(base.coord_ministerial);
  const [seguridad, setSeguridad] = useState<SeguridadCentro>(base.seguridad);
  const [servicios, setServicios] = useState<ServiciosCentro>(base.servicios);
  const [totalAfectados, setTotalAfectados] = useState(base.total_afectados);
  const [censoEnProceso, setCensoEnProceso] = useState(base.censo_en_proceso);
  const [novedades, setNovedades] = useState(base.novedades);
  const [requerimientos, setRequerimientos] = useState<ItemRequerimiento[]>(base.requerimientos);
  const [capacidad, setCapacidad] = useState<CapacidadCentro>(base.capacidad);
  const [ocupacion, setOcupacion] = useState<Vulnerables>(base.ocupacion);
  const [personal, setPersonal] = useState<PersonalCentro>(base.personal);
  const [familias, setFamilias] = useState(base.familias_ocupadas);
  const [responsables, setResponsables] = useState<Responsable[]>(
    asegurarIdsResponsables(base.responsables),
  );
  const [fotoUrl, setFotoUrl] = useState(base.foto_url);
  const [notas, setNotas] = useState(base.notas);

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const ocupados = poblacionCentro({
    ...centro,
    ocupacion,
    total_afectados: totalAfectados,
    censo_en_proceso: censoEnProceso,
  });
  const personalTotal = totalPersonalOperativo(personal);
  const logistica = personasLogistica({
    ...centro,
    ocupacion,
    total_afectados: totalAfectados,
    censo_en_proceso: censoEnProceso,
    personal,
  });
  const hayStorage = supabaseDisponible();

  const setCap =
    (campo: keyof CapacidadCentro) =>
    (valor: number | boolean) =>
      setCapacidad((prev) => ({ ...prev, [campo]: valor }));

  /**
   * Convierte los textos de lat/lng al GeoJSON Point del centro. Devuelve
   * `null` si ambos campos están vacíos (centro sin ubicar) y `"error"` si hay
   * texto pero no forma una coordenada válida (lat -90..90, lng -180..180).
   */
  function parsearCoordenadas(): GeoJSON.Point | null | "error" {
    const latStr = latTexto.trim().replace(",", ".");
    const lngStr = lngTexto.trim().replace(",", ".");
    if (!latStr && !lngStr) return null;
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (
      !latStr ||
      !lngStr ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return "error";
    }
    return { type: "Point", coordinates: [lng, lat] };
  }

  function usarGps() {
    if (!navigator.geolocation) {
      setErrorCoords("Tu navegador no soporta geolocalización (GPS).");
      return;
    }
    setErrorCoords(null);
    setBuscandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatTexto(pos.coords.latitude.toFixed(6));
        setLngTexto(pos.coords.longitude.toFixed(6));
        setBuscandoGps(false);
      },
      () => {
        setErrorCoords("No se pudo obtener tu ubicación. Revisa los permisos del navegador.");
        setBuscandoGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function onFotoSeleccionada(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setErrorFoto(null);
    setSubiendoFoto(true);
    try {
      const url = await subirFotoCentro(centro.id, file);
      setFotoUrl(url);
    } catch (err) {
      setErrorFoto(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function guardar() {
    if (soloLectura) return;
    setErrorGuardado(null);
    if (!nombre.trim()) {
      setPestana("identificacion");
      setErrorGuardado("El centro necesita un nombre.");
      return;
    }
    const geom = parsearCoordenadas();
    if (geom === "error") {
      setPestana("identificacion");
      setErrorGuardado(
        "Coordenadas inválidas: revisa latitud y longitud (ej. 10.48061 y -66.90360).",
      );
      return;
    }
    setGuardando(true);
    try {
      await guardarCentro({
        ...centro,
        nombre: nombre.trim(),
        grupo,
        cuerpo,
        parroquia: parroquia.trim(),
        direccion: direccion.trim(),
        mapsUrl: mapsUrl.trim(),
        geom,
        estado,
        fecha_levantamiento: fechaLevantamiento,
        estado_federativo: estadoFederativo.trim(),
        municipio: municipio.trim(),
        coord_politico: {
          ...coordPolitico,
          nombre: coordPolitico.nombre.trim(),
          cedula: coordPolitico.cedula.trim(),
          telefono: coordPolitico.telefono.trim(),
          ente: coordPolitico.ente.trim(),
        },
        coord_ministerial: {
          ...coordMinisterial,
          nombre: coordMinisterial.nombre.trim(),
          cedula: coordMinisterial.cedula.trim(),
          telefono: coordMinisterial.telefono.trim(),
          ente: coordMinisterial.ente.trim(),
        },
        seguridad: {
          ...seguridad,
          nombre: seguridad.nombre.trim(),
          cedula: seguridad.cedula.trim(),
          telefono: seguridad.telefono.trim(),
          organismo: seguridad.organismo.trim() || centro.cuerpo,
        },
        servicios,
        total_afectados: totalAfectados,
        censo_en_proceso: censoEnProceso,
        novedades: novedades.trim(),
        requerimientos: requerimientos
          .filter((r) => r.concepto.trim() && r.cantidad > 0)
          .map((r) => ({
            ...r,
            concepto: r.concepto.trim(),
            notas: r.notas?.trim() ?? "",
          })),
        capacidad,
        ocupacion,
        personal,
        familias_ocupadas: familias,
        responsables: responsables
          .filter((r) => r.nombre.trim() || r.telefono.trim())
          .map((r) => ({
            ...r,
            nombre: r.nombre.trim(),
            telefono: r.telefono.trim(),
            funcion: r.funcion.trim(),
          })),
        foto_url: fotoUrl,
        notas: notas.trim(),
      });
      onCerrar();
    } catch (err) {
      console.error("[CentroForm] error guardando centro:", err);
      const mensaje =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "No se pudo guardar el centro. Revisa la consola para más detalle.";
      setErrorGuardado(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    setErrorGuardado(null);
    setEliminando(true);
    try {
      await eliminarCentro(centro.id);
      onCerrar();
    } catch (err) {
      console.error("[CentroForm] error eliminando centro:", err);
      setErrorGuardado(
        err instanceof Error ? err.message : "No se pudo eliminar el centro.",
      );
    } finally {
      setEliminando(false);
    }
  }

  function agregarResponsable() {
    setResponsables((prev) => [
      ...prev,
      { id: nuevoId(), nombre: "", telefono: "", categoria: "funcionario", funcion: "" },
    ]);
  }
  function actualizarResponsable(id: string, patch: Partial<Responsable>) {
    setResponsables((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function eliminarResponsable(id: string) {
    setResponsables((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent
        className="flex max-h-[96dvh] flex-col gap-0 p-0 sm:max-w-3xl"
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-5 py-4 sm:px-6">
          <DialogTitle className="text-lg">
            {esNuevo
              ? "Registrar centro nuevo"
              : soloLectura
                ? "Estado del centro"
                : "Registrar estado del centro"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {esNuevo
              ? `N.° ${centro.nro} · Alta de un nuevo centro en la red`
              : `N.° ${centro.nro} · ${centro.nombre}`}
          </DialogDescription>
        </DialogHeader>

        <nav
          className="grid shrink-0 grid-cols-2 gap-2 border-b border-border px-4 py-3 sm:grid-cols-3 sm:px-6 sm:py-4"
          aria-label="Secciones del reporte de levantamiento"
        >
          {PESTANAS.map(({ valor, numero, titulo, icono: Icono }) => {
            const activa = pestana === valor;
            return (
              <button
                key={valor}
                type="button"
                onClick={() => setPestana(valor)}
                className={cn(
                  "flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  activa
                    ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-card/40 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icono className="size-5 shrink-0" />
                <span className="min-w-0 leading-tight">
                  {numero && (
                    <span
                      className={cn(
                        "block text-[10px] font-semibold uppercase tracking-wide",
                        activa ? "text-primary/80" : "text-muted-foreground",
                      )}
                    >
                      Sección {numero}
                    </span>
                  )}
                  <span className="block text-sm font-medium">{titulo}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
          {/* I · Identificación */}
          {pestana === "identificacion" && (
          <div className="space-y-5">
            <div>
              <Label htmlFor="centro-fecha">Fecha del levantamiento</Label>
              <Input
                id="centro-fecha"
                type="date"
                className="mt-1.5"
                value={fechaLevantamiento}
                disabled={soloLectura}
                onChange={(e) => setFechaLevantamiento(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="centro-estado-fed">Estado</Label>
                <Input
                  id="centro-estado-fed"
                  className="mt-1.5"
                  value={estadoFederativo}
                  disabled={soloLectura}
                  onChange={(e) => setEstadoFederativo(e.target.value)}
                  placeholder="Miranda"
                />
              </div>
              <div>
                <Label htmlFor="centro-municipio">Municipio</Label>
                <Input
                  id="centro-municipio"
                  className="mt-1.5"
                  value={municipio}
                  disabled={soloLectura}
                  onChange={(e) => setMunicipio(e.target.value)}
                  placeholder="Sucre"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="centro-nombre">Nombre del centro</Label>
              <Input
                id="centro-nombre"
                className="mt-1.5"
                value={nombre}
                disabled={soloLectura}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="UEN Pedro Emilio Coll"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="centro-grupo">Grupo</Label>
                <select
                  id="centro-grupo"
                  className="mt-1.5 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                  value={grupo}
                  disabled={soloLectura}
                  onChange={(e) => setGrupo(e.target.value)}
                >
                  {GRUPOS_CENTRO.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="centro-cuerpo">Cuerpo asignado</Label>
                <select
                  id="centro-cuerpo"
                  className="mt-1.5 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                  value={normalizarCuerpo(cuerpo)}
                  disabled={soloLectura}
                  onChange={(e) => {
                    const clave = e.target.value as ClaveCuerpo;
                    const meta = CATALOGO_CUERPOS.find((c) => c.clave === clave);
                    setCuerpo(clave === "sin_asignar" ? "" : meta?.label ?? "");
                  }}
                >
                  {CATALOGO_CUERPOS.map((c) => (
                    <option key={c.clave} value={c.clave}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="centro-parroquia">Parroquia</Label>
              <Input
                id="centro-parroquia"
                className="mt-1.5"
                value={parroquia}
                disabled={soloLectura}
                onChange={(e) => setParroquia(e.target.value)}
                placeholder="Parroquia Coche"
              />
            </div>

            <div>
              <Label htmlFor="centro-direccion">Dirección</Label>
              <Textarea
                id="centro-direccion"
                className="mt-1.5"
                rows={2}
                value={direccion}
                disabled={soloLectura}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Av. Intercomunal de El Valle, Caracas…"
              />
            </div>

            <div>
              <Label htmlFor="centro-maps">Enlace de Google Maps (opcional)</Label>
              <Input
                id="centro-maps"
                className="mt-1.5"
                type="url"
                value={mapsUrl}
                disabled={soloLectura}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/…"
              />
            </div>

            <div>
              <Label>Ubicación en el mapa (coordenadas)</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Latitud y longitud en grados decimales (ej. 10.48061, -66.90360). Sin
                coordenadas, el centro no aparece en el mapa.
              </p>
              <div className="mt-2 flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="centro-lat" className="text-[11px] text-muted-foreground">
                    Latitud
                  </Label>
                  <Input
                    id="centro-lat"
                    className="mt-1 font-mono text-xs"
                    inputMode="decimal"
                    value={latTexto}
                    disabled={soloLectura}
                    onChange={(e) => setLatTexto(e.target.value)}
                    placeholder="10.48061"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="centro-lng" className="text-[11px] text-muted-foreground">
                    Longitud
                  </Label>
                  <Input
                    id="centro-lng"
                    className="mt-1 font-mono text-xs"
                    inputMode="decimal"
                    value={lngTexto}
                    disabled={soloLectura}
                    onChange={(e) => setLngTexto(e.target.value)}
                    placeholder="-66.90360"
                  />
                </div>
                {!soloLectura && (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    disabled={buscandoGps}
                    onClick={usarGps}
                    title="Usar mi ubicación actual (GPS)"
                  >
                    {buscandoGps ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LocateFixed className="size-4" />
                    )}
                    GPS
                  </Button>
                )}
              </div>
              {errorCoords && (
                <p className="mt-1 text-[11px] text-destructive">{errorCoords}</p>
              )}
            </div>

            <div>
              <Label>Foto del centro</Label>
              <div className="mt-1.5 overflow-hidden rounded-xl border border-border bg-muted/20">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="Foto del centro" className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">
                    Sin foto
                  </div>
                )}
              </div>
              {!soloLectura && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    ref={inputFotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onFotoSeleccionada}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!hayStorage || subiendoFoto}
                    onClick={() => inputFotoRef.current?.click()}
                    title={hayStorage ? "Subir foto" : "Configura Supabase para subir fotos"}
                  >
                    {subiendoFoto ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                    {fotoUrl ? "Cambiar foto" : "Subir foto"}
                  </Button>
                  {fotoUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setFotoUrl("")}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
              )}
              {!hayStorage && !soloLectura && (
                <p className="mt-1 text-[11px] text-amber-400">
                  Subida de fotos desactivada: falta configurar Supabase (ver .env.example).
                </p>
              )}
              {errorFoto && <p className="mt-1 text-[11px] text-destructive">{errorFoto}</p>}
            </div>

            <div>
              <Label htmlFor="centro-estado">Estado operativo</Label>
              <select
                id="centro-estado"
                className="mt-1.5 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                value={estado}
                disabled={soloLectura}
                onChange={(e) => setEstado(e.target.value as EstadoCentro)}
              >
                {ESTADOS_CENTRO.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          )}

          {/* II · Coordinación política y ministerial */}
          {pestana === "coordinacion" && (
          <div className="space-y-3">
            <FormularioContacto
              titulo="Coordinador político"
              contacto={coordPolitico}
              deshabilitado={soloLectura}
              onChange={(patch) => setCoordPolitico((prev) => ({ ...prev, ...patch }))}
            />
            <FormularioContacto
              titulo="Coordinador ministerial"
              contacto={coordMinisterial}
              deshabilitado={soloLectura}
              onChange={(patch) => setCoordMinisterial((prev) => ({ ...prev, ...patch }))}
            />
          </div>
          )}

          {/* III · Seguridad */}
          {pestana === "seguridad" && (
          <FormularioSeguridad
            seguridad={seguridad}
            organismoSugerido={centro.cuerpo}
            deshabilitado={soloLectura}
            onChange={(patch) => setSeguridad((prev) => ({ ...prev, ...patch }))}
          />
          )}

          {/* IV · Salud y apoyo */}
          {pestana === "salud" && (
          <FormularioServicios
            servicios={servicios}
            deshabilitado={soloLectura}
            onChange={(clave, valor) => setServicios((prev) => ({ ...prev, [clave]: valor }))}
          />
          )}

          {/* V · Población / censo */}
          {pestana === "poblacion" && (
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-semibold">Población afectada</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Refugiados:{" "}
                <span className="font-semibold text-foreground">{ocupados.toLocaleString("es")}</span>
                {personalTotal > 0 && (
                  <>
                    {" "}
                    · Personal:{" "}
                    <span className="font-semibold text-foreground">
                      {personalTotal.toLocaleString("es")}
                    </span>
                  </>
                )}
                {" "}
                · Logística total:{" "}
                <span className="font-semibold text-foreground">{logistica.toLocaleString("es")}</span>
                {censoEnProceso && " (censo detallado en proceso)"}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="centro-afectados" className="text-[11px] text-muted-foreground">
                    Cantidad de afectados
                  </Label>
                  <NumInput
                    id="centro-afectados"
                    className="mt-1"
                    value={totalAfectados}
                    disabled={soloLectura}
                    onChange={setTotalAfectados}
                  />
                </div>
                <div>
                  <Label htmlFor="centro-familias" className="text-[11px] text-muted-foreground">
                    N.° de familias
                  </Label>
                  <NumInput
                    id="centro-familias"
                    className="mt-1"
                    value={familias}
                    disabled={soloLectura}
                    onChange={setFamilias}
                  />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-amber-500"
                  checked={censoEnProceso}
                  disabled={soloLectura}
                  onChange={(e) => setCensoEnProceso(e.target.checked)}
                />
                Censo demográfico en proceso (desglose pendiente)
              </label>
            </div>

            <div>
              <Label className="text-sm font-semibold">Desglose por edad y sexo</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Hombres, mujeres, niños, niñas y adultos mayores. Completa cuando el censo avance.
              </p>
              <div className={cn("mt-3", censoEnProceso && "opacity-90")}>
                <DesgloseDemografico
                  vulnerables={ocupacion}
                  onCampo={(campo, valor) =>
                    setOcupacion((prev) => ({ ...prev, [campo]: valor }))
                  }
                  deshabilitado={soloLectura}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Personal operativo</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Funcionarios, salud y justicia desplegados en el centro. Se suman a los refugiados
                para calcular agua, comida y baños.
              </p>
              <div className="mt-3">
                <DesglosePersonal
                  personal={personal}
                  onCampo={(campo, valor) =>
                    setPersonal((prev) => ({ ...prev, [campo]: valor }))
                  }
                  deshabilitado={soloLectura}
                />
              </div>
            </div>
          </div>
          )}

          {/* VI · Novedades */}
          {pestana === "novedades" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="centro-novedades">Novedades relevantes</Label>
              <Textarea
                id="centro-novedades"
                className="mt-1.5"
                rows={5}
                value={novedades}
                disabled={soloLectura}
                onChange={(e) => setNovedades(e.target.value)}
                placeholder="Ej. Estamos en el proceso de censo y recolección de información…"
              />
            </div>
            <div>
              <Label htmlFor="centro-notas">Notas internas (opcional)</Label>
              <Textarea
                id="centro-notas"
                className="mt-1.5"
                rows={2}
                value={notas}
                disabled={soloLectura}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>
          </div>
          )}

          {/* Requerimientos logísticos */}
          {pestana === "requerimientos" && (
          <FormularioRequerimientos
            items={requerimientos}
            deshabilitado={soloLectura}
            onChange={setRequerimientos}
          />
          )}

          {/* Capacidad instalada vs. operativa */}
          {pestana === "capacidad" && (
          <div className="space-y-5">
            {/* Capacidad */}
            <div>
              <Label className="text-sm font-semibold">Capacidad (instalada / operativa)</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Registra lo instalado y cuánto está operativo ahora. La diferencia revela qué
                recurso limita el ingreso (ej. muchas camas pero pocas pocetas).
              </p>
              <div className="mt-2 space-y-2">
                <ParRecurso
                  icono={<BedDouble className="size-4 text-primary" />}
                  label="Camas"
                  instaladas={capacidad.camas_instaladas}
                  operativas={capacidad.camas_operativas}
                  onInstaladas={(n) => setCap("camas_instaladas")(n)}
                  onOperativas={(n) => setCap("camas_operativas")(n)}
                  deshabilitado={soloLectura}
                />
                <ParRecurso
                  icono={<span className="text-base leading-none">🚽</span>}
                  label="Pocetas / baños"
                  instaladas={capacidad.pocetas_instaladas}
                  operativas={capacidad.pocetas_operativas}
                  onInstaladas={(n) => setCap("pocetas_instaladas")(n)}
                  onOperativas={(n) => setCap("pocetas_operativas")(n)}
                  deshabilitado={soloLectura}
                />
                <ParRecurso
                  icono={<ShowerHead className="size-4 text-cyan-400" />}
                  label="Duchas"
                  instaladas={capacidad.duchas_instaladas}
                  operativas={capacidad.duchas_operativas}
                  onInstaladas={(n) => setCap("duchas_instaladas")(n)}
                  onOperativas={(n) => setCap("duchas_operativas")(n)}
                  deshabilitado={soloLectura}
                />
                <ParRecurso
                  icono={<Shirt className="size-4 text-violet-400" />}
                  label="Lavaderos de ropa"
                  instaladas={capacidad.lavaderos_instalados}
                  operativas={capacidad.lavaderos_operativos}
                  onInstaladas={(n) => setCap("lavaderos_instalados")(n)}
                  onOperativas={(n) => setCap("lavaderos_operativos")(n)}
                  deshabilitado={soloLectura}
                />
                <ParRecurso
                  icono={<Trash className="size-4 text-lime-500" />}
                  label="Contenedores de basura"
                  instaladas={capacidad.contenedores_instalados}
                  operativas={capacidad.contenedores_operativos}
                  onInstaladas={(n) => setCap("contenedores_instalados")(n)}
                  onOperativas={(n) => setCap("contenedores_operativos")(n)}
                  deshabilitado={soloLectura}
                />

                {/* Agua potable */}
                <Card size="sm" className="py-2">
                  <CardContent className="space-y-2 px-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <Droplets className="size-4 text-sky-400" />
                      Agua potable
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="size-4 accent-sky-500"
                          checked={capacidad.agua_tanque}
                          disabled={soloLectura}
                          onChange={(e) => setCap("agua_tanque")(e.target.checked)}
                        />
                        Hay tanque
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="size-4 accent-emerald-500"
                          checked={capacidad.agua_operativa}
                          disabled={soloLectura}
                          onChange={(e) => setCap("agua_operativa")(e.target.checked)}
                        />
                        Suministro operativo
                      </label>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Capacidad del tanque (litros)
                      </Label>
                      <NumInput
                        className="mt-1 w-40"
                        value={capacidad.agua_litros}
                        disabled={soloLectura}
                        onChange={(n) => setCap("agua_litros")(n)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
          )}

          {/* Otros contactos adicionales */}
          {pestana === "contactos" && (
          <div className="space-y-5">
            {/* Responsables */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  Responsables del centro ({responsables.length})
                </Label>
                {!soloLectura && (
                  <Button type="button" size="xs" variant="secondary" onClick={agregarResponsable}>
                    <Plus className="size-3" />
                    Agregar
                  </Button>
                )}
              </div>
              {responsables.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Sin responsables. Agrega encargados con teléfono para contacto.
                </p>
              )}
              <div className="space-y-2">
                {responsables.map((r) => {
                  const cat = CATEGORIAS_RESPONSABLE.find((c) => c.valor === r.categoria);
                  return (
                    <Card key={r.id} size="sm" className="py-2">
                      <CardContent className="space-y-2 px-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value={r.nombre}
                            disabled={soloLectura}
                            onChange={(e) => actualizarResponsable(r.id, { nombre: e.target.value })}
                            placeholder="Nombre y apellido"
                          />
                          {r.telefono.trim() && <AccionesContacto telefono={r.telefono} />}
                          {!soloLectura && (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => eliminarResponsable(r.id)}
                              title="Quitar"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={r.telefono}
                            disabled={soloLectura}
                            onChange={(e) =>
                              actualizarResponsable(r.id, { telefono: e.target.value })
                            }
                            placeholder="Teléfono"
                            inputMode="tel"
                          />
                          <select
                            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                            value={r.categoria}
                            disabled={soloLectura}
                            onChange={(e) =>
                              actualizarResponsable(r.id, {
                                categoria: e.target.value as Responsable["categoria"],
                              })
                            }
                          >
                            {CATEGORIAS_RESPONSABLE.map((c) => (
                              <option key={c.valor} value={c.valor}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Input
                          list="funciones-comunes-centro"
                          value={r.funcion}
                          disabled={soloLectura}
                          onChange={(e) => actualizarResponsable(r.id, { funcion: e.target.value })}
                          placeholder="Función (ej: Coordinación general)"
                        />
                        {cat && (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={{ borderColor: `${cat.color}66`, color: cat.color }}
                          >
                            {cat.label}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <datalist id="funciones-comunes-centro">
                {FUNCIONES_COMUNES.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
          </div>
          )}
        </div>

        <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          {errorGuardado && (
            <p className="mr-auto max-w-[60%] text-xs leading-snug text-destructive">
              {errorGuardado}
            </p>
          )}
          {!soloLectura && !esNuevo && puedeEliminar && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="sm:mr-auto"
                  disabled={guardando || eliminando}
                >
                  {eliminando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Eliminar centro
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar este centro de la red?</AlertDialogTitle>
                  <AlertDialogDescription>
                    N.° {centro.nro} · {centro.nombre}. Desaparecerá del mapa, el tablero y
                    el dashboard en todos los dispositivos. El histórico queda guardado y un
                    administrador puede restaurarlo desde la base de datos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => void eliminar()}>
                    Eliminar centro
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={onCerrar}>
            {soloLectura ? "Cerrar" : "Cancelar"}
          </Button>
          {!soloLectura && (
            <Button
              onClick={() => void guardar()}
              disabled={guardando || eliminando || subiendoFoto}
            >
              {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
              {esNuevo ? "Crear centro" : "Guardar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParRecurso({
  icono,
  label,
  instaladas,
  operativas,
  onInstaladas,
  onOperativas,
  deshabilitado,
}: {
  icono: React.ReactNode;
  label: string;
  instaladas: number;
  operativas: number;
  onInstaladas: (n: number) => void;
  onOperativas: (n: number) => void;
  deshabilitado?: boolean;
}) {
  return (
    <Card size="sm" className="py-2">
      <CardContent className="px-3">
        <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground">
          {icono}
          {label}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Instaladas</Label>
            <NumInput
              className="mt-1"
              value={instaladas}
              disabled={deshabilitado}
              onChange={onInstaladas}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Operativas</Label>
            <NumInput
              className="mt-1"
              value={operativas}
              disabled={deshabilitado}
              onChange={onOperativas}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
