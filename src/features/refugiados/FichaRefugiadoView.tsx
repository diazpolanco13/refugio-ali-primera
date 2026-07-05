// Ficha interna de refugiado (vista de página). La pestaña Personal concentra
// la ficha individual (cabecera, identidad, contacto, documentación y empleo);
// el resto de pestañas cubre familia, residencia, salud, tallas y seguimiento.

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  FileDown,
  Heart,
  Home,
  LogOut,
  Ruler,
  User,
  Users,
} from "lucide-react";
import {
  detectarDuplicadosCedula,
  formatearCedula,
  META_ESTADO_ALOJAMIENTO,
  nombreCompleto,
} from "@/domain/refugiados";
import { puedeVerSaludMental } from "@/domain/permisos";
import { useSesion } from "@/data/authSupabase";
import { useAlojamientoDetalle } from "@/data/useAlojamientoDetalle";
import { useRefugiadosRed } from "@/data/useRefugiadosRed";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { registrarEgreso } from "@/data/reposRefugiados";
import { claveDia } from "@/data/reposSupabase";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { DocumentacionLegalSection } from "./DocumentacionLegalSection";
import { FamiliaresReferenciaSection } from "./FamiliaresReferenciaSection";
import { FamiliaresSection } from "./FamiliaresSection";
import { FichaPersonalSection } from "./FichaPersonalSection";
import { HabilidadesMediosVidaSection } from "./HabilidadesMediosVidaSection";
import { ResidenciaAfectadaSection } from "./ResidenciaAfectadaSection";
import { SaludBienestarSection } from "./SaludBienestarSection";
import { SeguimientoNotasSection } from "./SeguimientoNotasSection";
import { TallasDotacionesSection } from "./TallasDotacionesSection";
import { exportarFichaPdf } from "./exportarFichaPdf";

interface Props {
  alojamientoId: string;
  puedeEditar: boolean;
  onVolver: () => void;
  onEgreso?: () => void;
  onAbrirMiembro?: (alojamientoId: string) => void;
}

export function FichaRefugiadoView({
  alojamientoId,
  puedeEditar,
  onVolver,
  onEgreso,
  onAbrirMiembro,
}: Props) {
  const sesion = useSesion();
  const { alojamiento, cargando } = useAlojamientoDetalle(alojamientoId);
  const { alojamientos: alojamientosRed } = useRefugiadosRed();
  const verSaludMental = sesion ? puedeVerSaludMental(sesion.user.rol) : false;

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>("centros", {
    transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
    clientFilter: (c) => !c.deleted,
  });
  const nombresCentros = useMemo(
    () => new Map(filasCentros.map((c) => [c.id, c.nombre || c.id])),
    [filasCentros],
  );

  const [confirmandoEgreso, setConfirmandoEgreso] = useState(false);
  const [fechaEgreso, setFechaEgreso] = useState(() => claveDia(Date.now()));
  const [motivoEgreso, setMotivoEgreso] = useState("");
  const [destinoEgreso, setDestinoEgreso] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [pestana, setPestana] = useState("personal");

  const duplicados = useMemo(() => detectarDuplicadosCedula(alojamientosRed), [alojamientosRed]);

  if (cargando) {
    return (
      <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL}>
        <p className="p-6 text-sm text-muted-foreground">Cargando ficha…</p>
      </MarcoVista>
    );
  }

  if (!alojamiento) {
    return (
      <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL}>
        <VistaEncabezado
          icono={User}
          acento="sky"
          titulo="Registro no encontrado"
          descripcion="El alojamiento solicitado no existe o no tiene permiso para verlo"
          acciones={
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onVolver}>
              <ArrowLeft className="size-3.5" />
              Volver
            </Button>
          }
        />
      </MarcoVista>
    );
  }

  const { refugiado } = alojamiento;
  const norm = refugiado.cedula_norm;
  const centrosDup = norm ? duplicados.get(norm) : undefined;
  const esDuplicado = centrosDup && centrosDup.length >= 2;
  const metaEstado = META_ESTADO_ALOJAMIENTO[alojamiento.estado];
  const nombreCampamento = nombresCentros.get(alojamiento.centro_id) ?? alojamiento.centro_id;

  async function confirmarEgreso() {
    setProcesando(true);
    try {
      await registrarEgreso(alojamiento!.id, {
        fechaEgreso,
        motivo: motivoEgreso,
        destino: destinoEgreso,
      });
      setConfirmandoEgreso(false);
      onEgreso?.();
      onVolver();
    } catch (err) {
      console.error("[FichaRefugiado] egreso:", err);
    } finally {
      setProcesando(false);
    }
  }

  async function exportarPdf() {
    setExportando(true);
    try {
      await exportarFichaPdf(alojamiento!, nombreCampamento);
    } finally {
      setExportando(false);
    }
  }

  return (
    <MarcoVista
      ancho={ANCHO_VISTA_PRINCIPAL}
      rellenarAltura
      className="overflow-hidden"
      marcoClassName="flex min-h-0 flex-col text-foreground"
    >
      <VistaEncabezado
        icono={User}
        acento="sky"
        titulo={nombreCompleto(refugiado)}
        descripcion={`${refugiado.codigo_ficha ?? formatearCedula(refugiado.cedula, refugiado.tipo_doc)} · ${nombreCampamento}`}
        acciones={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              disabled={exportando}
              onClick={() => void exportarPdf()}
            >
              <FileDown className="size-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 px-2" onClick={onVolver}>
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Volver</span>
            </Button>
          </div>
        }
        debajo={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" style={{ borderColor: metaEstado.color, color: metaEstado.color }}>
              {metaEstado.label}
            </Badge>
            {alojamiento.plaza_modulo && (
              <Badge variant="outline">Ubicación: {alojamiento.plaza_modulo}</Badge>
            )}
            {alojamiento.itinerante && (
              <Badge variant="outline" className="border-sky-500/50 text-sky-400">
                Itinerante
              </Badge>
            )}
            {alojamiento.es_jefe_familia && <Badge variant="outline">Jefe de familia</Badge>}
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
          {esDuplicado && centrosDup && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle className="text-sm">Activo en varios campamentos</AlertTitle>
              <AlertDescription className="text-xs">
                Esta cédula tiene plaza activa en:{" "}
                {centrosDup.map((id) => nombresCentros.get(id) ?? id).join(", ")}
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={pestana} onValueChange={setPestana} className="gap-4">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="personal" className="gap-1.5">
                <User className="size-3.5" /> Personal
              </TabsTrigger>
              <TabsTrigger value="familiares" className="gap-1.5">
                <Users className="size-3.5" /> Familiares
              </TabsTrigger>
              <TabsTrigger value="residencia" className="gap-1.5" disabled={!alojamiento.familia_id}>
                <Home className="size-3.5" /> Residencia
              </TabsTrigger>
              <TabsTrigger value="salud" className="gap-1.5">
                <Heart className="size-3.5" /> Salud
              </TabsTrigger>
              <TabsTrigger value="tallas" className="gap-1.5">
                <Ruler className="size-3.5" /> Tallas / Kit
              </TabsTrigger>
              <TabsTrigger value="seguimiento" className="gap-1.5">
                <ClipboardList className="size-3.5" /> Seguimiento
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-4">
              <FichaPersonalSection
                detalle={alojamiento}
                nombreCampamento={nombreCampamento}
                puedeEditar={puedeEditar}
              />
              <DocumentacionLegalSection detalle={alojamiento} puedeEditar={puedeEditar} />
              <HabilidadesMediosVidaSection detalle={alojamiento} puedeEditar={puedeEditar} />
            </TabsContent>

            <TabsContent value="familiares" className="space-y-4">
              <FamiliaresSection
                miembros={alojamiento.miembrosFamilia}
                familiaNombre={alojamiento.familia?.nombre}
                refugiadoActualId={refugiado.id}
                alojamientoActualId={alojamiento.id}
                onAbrirMiembro={onAbrirMiembro}
              />
              <FamiliaresReferenciaSection detalle={alojamiento} puedeEditar={puedeEditar} />
            </TabsContent>

            <TabsContent value="residencia">
              {alojamiento.familia_id ? (
                <ResidenciaAfectadaSection
                  familiaId={alojamiento.familia_id}
                  centroId={alojamiento.centro_id}
                  familiaNombre={alojamiento.familia?.nombre}
                  residencia={alojamiento.residencia}
                  puedeEditar={puedeEditar}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Asigna un grupo familiar para registrar la residencia afectada.
                </p>
              )}
            </TabsContent>

            <TabsContent value="salud">
              <SaludBienestarSection
                detalle={alojamiento}
                puedeEditar={puedeEditar}
                puedeVerSaludMental={verSaludMental}
              />
            </TabsContent>

            <TabsContent value="tallas">
              <TallasDotacionesSection
                detalle={alojamiento}
                puedeEditar={puedeEditar}
                nombresCentros={nombresCentros}
              />
            </TabsContent>

            <TabsContent value="seguimiento">
              <SeguimientoNotasSection detalle={alojamiento} puedeEditar={puedeEditar} />
            </TabsContent>
          </Tabs>

          {puedeEditar && alojamiento.estado === "activo" && !confirmandoEgreso && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-rose-500/40 text-rose-400 hover:bg-rose-500/10 sm:w-auto"
              onClick={() => setConfirmandoEgreso(true)}
            >
              <LogOut className="size-3.5" />
              Registrar egreso
            </Button>
          )}

          {confirmandoEgreso && (
            <div className="space-y-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
              <p className="text-xs font-medium text-rose-300">Confirmar egreso</p>
              <div>
                <Label className="text-[10px]">Fecha de egreso</Label>
                <Input type="date" value={fechaEgreso} onChange={(e) => setFechaEgreso(e.target.value)} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-[10px]">Motivo</Label>
                <Textarea value={motivoEgreso} onChange={(e) => setMotivoEgreso(e.target.value)} rows={2} className="mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Destino probable</Label>
                <Input value={destinoEgreso} onChange={(e) => setDestinoEgreso(e.target.value)} className="mt-1 h-9" />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={procesando} onClick={() => setConfirmandoEgreso(false)}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" variant="destructive" disabled={procesando} onClick={() => void confirmarEgreso()}>
                  {procesando ? "Guardando…" : "Confirmar egreso"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MarcoVista>
  );
}
