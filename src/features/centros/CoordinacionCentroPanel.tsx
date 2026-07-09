import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Landmark,
  Loader2,
  Plus,
  RotateCw,
  Scale,
  Shield,
  Stethoscope,
  Users,
} from "lucide-react";
import { guardarCentro } from "@/data/reposSupabase";
import { normalizarCentro, type CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  asegurarIdsResponsablesCoordinacion,
  pestanaDeCategoria,
  PESTANAS_COORDINACION,
  prepararResponsablesCoordinacionParaGuardar,
  responsableCoordinacionTieneDatos,
  syncCentroDesdeCoordinacion,
  type CategoriaResponsabilidadCoordinacion,
  type ResponsableCoordinacion,
} from "@/domain/coordinacionCentro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DialogoResponsableCoordinacion } from "./DialogoResponsableCoordinacion";
import { ListaResponsablesCoordinacion } from "./ResponsablesCoordinacion";

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
}

function firmaResponsables(lista: ResponsableCoordinacion[]): string {
  return lista
    .map((r) => r.id)
    .filter(Boolean)
    .sort()
    .join("|");
}

type IdPestana = (typeof PESTANAS_COORDINACION)[number]["id"];

const ICONO_PESTANA: Record<IdPestana, React.ReactNode> = {
  supervision_rotatoria: <RotateCw className="size-3.5 shrink-0" />,
  politica: <Landmark className="size-3.5 shrink-0" />,
  seguridad: <Shield className="size-3.5 shrink-0" />,
  salud: <Stethoscope className="size-3.5 shrink-0" />,
  justicia: <Scale className="size-3.5 shrink-0" />,
  comunitaria: <Users className="size-3.5 shrink-0" />,
};

function contarPorPestana(
  responsables: ResponsableCoordinacion[],
): Record<IdPestana, number> {
  const counts = Object.fromEntries(
    PESTANAS_COORDINACION.map((p) => [p.id, 0]),
  ) as Record<IdPestana, number>;
  for (const r of responsables.filter(responsableCoordinacionTieneDatos)) {
    const pestana = pestanaDeCategoria(r.categoria);
    counts[pestana.id] += 1;
  }
  return counts;
}

function pestanaInicial(responsables: ResponsableCoordinacion[]): IdPestana {
  const primeraConDatos = PESTANAS_COORDINACION.find((p) =>
    responsables.some(
      (r) => p.categorias.includes(r.categoria) && responsableCoordinacionTieneDatos(r),
    ),
  );
  return primeraConDatos?.id ?? "supervision_rotatoria";
}

function descripcionPestana(id: IdPestana): string {
  switch (id) {
    case "supervision_rotatoria":
      return "Supervisión rotatoria y analista SAE asignado al campamento.";
    case "politica":
      return "Coordinación política e institucional del campamento.";
    case "seguridad":
      return "Seguridad física, organismo y personal desplegado.";
    case "salud":
      return "Personal médico, psicosocial y logística sanitaria.";
    case "justicia":
      return "TJS, Ministerio Público y Defensoría del Pueblo.";
    case "comunitaria":
      return "Coordinación comunitaria y funcionarios de apoyo.";
    default:
      return "";
  }
}

/** Pestaña Coordinación: sub-pestañas por ámbito + diálogo para crear/editar responsables. */
export function CoordinacionCentroPanel({ centro, puedeEditar }: Props) {
  // Copia local: al guardar no esperamos Realtime para reflejar el cambio.
  const [centroLocal, setCentroLocal] = useState(centro);
  useEffect(() => {
    setCentroLocal((prev) => {
      if (centro.id !== prev.id) return centro;
      const prop = normalizarCentro(centro);
      const local = normalizarCentro(prev);
      // Update remoto (u otro tab) con lista distinta: sincronizar.
      // Tras un guardado propio la firma ya coincide → sin flicker.
      if (
        (centro.updated_at ?? 0) >= (prev.updated_at ?? 0) &&
        firmaResponsables(prop.responsables_coordinacion) !==
          firmaResponsables(local.responsables_coordinacion)
      ) {
        return centro;
      }
      return prev;
    });
  }, [centro]);

  const c = normalizarCentro(centroLocal);
  const visibles = useMemo(
    () => c.responsables_coordinacion.filter(responsableCoordinacionTieneDatos),
    [c.responsables_coordinacion],
  );
  const conteos = useMemo(
    () => contarPorPestana(c.responsables_coordinacion),
    [c.responsables_coordinacion],
  );
  const personalTotal = useMemo(
    () => visibles.reduce((sum, r) => sum + r.personal_mando, 0),
    [visibles],
  );
  const categoriasActivas = useMemo(
    () => PESTANAS_COORDINACION.filter((p) => conteos[p.id] > 0).length,
    [conteos],
  );

  const [subTab, setSubTab] = useState<IdPestana>(() =>
    pestanaInicial(c.responsables_coordinacion),
  );
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [responsableEditando, setResponsableEditando] = useState<ResponsableCoordinacion | null>(
    null,
  );
  const [categoriaInicialDialogo, setCategoriaInicialDialogo] = useState<
    CategoriaResponsabilidadCoordinacion | undefined
  >(undefined);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pestanaActiva = PESTANAS_COORDINACION.find((p) => p.id === subTab)!;

  async function persistir(lista: ResponsableCoordinacion[]) {
    setError(null);
    setGuardando(true);
    try {
      const preparada = prepararResponsablesCoordinacionParaGuardar(
        asegurarIdsResponsablesCoordinacion(lista),
      );
      const sync = syncCentroDesdeCoordinacion(centroLocal, preparada);
      const siguiente: CentroTransitorio = {
        ...centroLocal,
        responsables_coordinacion: preparada,
        personal: sync.personal,
        servicios: sync.servicios,
        updated_at: Date.now(),
      };
      // Optimista: la lista se actualiza al instante; Realtime confirmará después.
      setCentroLocal(siguiente);
      await guardarCentro(siguiente);
      setDialogoAbierto(false);
      setResponsableEditando(null);
      setCategoriaInicialDialogo(undefined);
      return true;
    } catch (err) {
      console.error("[CoordinacionCentroPanel] error guardando:", err);
      // Revertir al prop del padre si el upsert falló.
      setCentroLocal(centro);
      setError(
        err instanceof Error ? err.message : "No se pudo guardar la coordinación del campamento.",
      );
      return false;
    } finally {
      setGuardando(false);
    }
  }

  function abrirNuevo(categoria?: CategoriaResponsabilidadCoordinacion) {
    setResponsableEditando(null);
    setCategoriaInicialDialogo(categoria ?? pestanaActiva.categorias[0]);
    setError(null);
    setDialogoAbierto(true);
  }

  function abrirEditar(responsable: ResponsableCoordinacion) {
    setResponsableEditando(responsable);
    setCategoriaInicialDialogo(undefined);
    setError(null);
    setDialogoAbierto(true);
  }

  function cerrarDialogo() {
    if (guardando) return;
    setDialogoAbierto(false);
    setResponsableEditando(null);
    setCategoriaInicialDialogo(undefined);
    setError(null);
  }

  async function guardarResponsable(responsable: ResponsableCoordinacion) {
    const actual = c.responsables_coordinacion;
    const existe = actual.some((r) => r.id === responsable.id);
    const lista = existe
      ? actual.map((r) => (r.id === responsable.id ? responsable : r))
      : [...actual, responsable];
    const ok = await persistir(lista);
    if (ok) {
      setSubTab(pestanaDeCategoria(responsable.categoria).id);
    }
  }

  async function eliminarResponsable(id: string) {
    await persistir(c.responsables_coordinacion.filter((r) => r.id !== id));
  }

  const tabTriggerClass = cn(
    "relative flex h-full min-h-0 shrink-0 items-center justify-center gap-1.5 rounded-none px-3 py-0",
    "!border-x-transparent !border-t-transparent !border-b-2 !border-b-transparent !bg-transparent !shadow-none",
    "text-xs font-medium text-muted-foreground",
    "transition-colors hover:text-foreground",
    "after:!hidden after:!content-none",
    "data-active:!border-x-transparent data-active:!border-t-transparent data-active:!border-b-primary",
    "data-active:!bg-transparent data-active:!font-semibold data-active:!text-teal-300 data-active:!shadow-none",
    "dark:data-active:!border-b-primary dark:data-active:!bg-transparent",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">
          Responsables:{" "}
          <span className="font-medium text-foreground">
            {visibles.length > 0 ? visibles.length : "sin registrar"}
          </span>
        </span>
        <span className="hidden text-border sm:inline">·</span>
        <span className="text-muted-foreground">
          Ámbitos:{" "}
          <span className="font-medium text-foreground">
            {categoriasActivas > 0 ? categoriasActivas : "ninguno"}
          </span>
        </span>
        <span className="hidden text-border sm:inline">·</span>
        <span className="text-muted-foreground">
          Personal desplegado:{" "}
          <span className="font-medium text-foreground">
            {personalTotal > 0 ? personalTotal.toLocaleString("es") : "—"}
          </span>
        </span>
      </div>

      <Tabs
        value={subTab}
        onValueChange={(v) => setSubTab(v as IdPestana)}
        className="gap-0"
      >
        <div className="border-b border-border">
          <TabsList
            variant="line"
            className="!flex h-10 w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {PESTANAS_COORDINACION.map((pestana) => (
              <TabsTrigger
                key={pestana.id}
                value={pestana.id}
                title={pestana.label}
                className={tabTriggerClass}
                style={
                  subTab === pestana.id
                    ? { borderBottomColor: pestana.color, color: pestana.color }
                    : undefined
                }
              >
                {ICONO_PESTANA[pestana.id]}
                <span className="truncate">{pestana.labelCorto}</span>
                {conteos[pestana.id] > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 px-1 text-[9px] tabular-nums"
                  >
                    {conteos[pestana.id]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {PESTANAS_COORDINACION.map((pestana) => (
          <TabsContent key={pestana.id} value={pestana.id} className="mt-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: pestana.color }}>
                  {pestana.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {descripcionPestana(pestana.id)}
                </p>
              </div>
              {puedeEditar && pestana.categorias.length === 1 && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 bg-teal-600 hover:bg-teal-500"
                  disabled={guardando}
                  onClick={() => abrirNuevo(pestana.categorias[0])}
                >
                  {guardando && !dialogoAbierto ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  Agregar responsable
                </Button>
              )}
            </div>

            <ListaResponsablesCoordinacion
              responsables={c.responsables_coordinacion}
              categoriasFiltro={pestana.categorias}
              integrado
              modoEdicion={puedeEditar}
              ocultarBadgeCategoria={pestana.categorias.length === 1}
              onEditar={abrirEditar}
              onEliminar={(id) => void eliminarResponsable(id)}
              onAgregarCategoria={puedeEditar ? abrirNuevo : undefined}
              vacio={
                <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
                  <ClipboardList className="mx-auto size-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    Sin datos en {pestana.label.toLowerCase()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pestana.categorias.length > 1
                      ? "Registra la supervisión rotatoria y/o el analista SAE del campamento."
                      : "Registra el responsable, contacto y personal desplegado de este ámbito."}
                  </p>
                  {puedeEditar && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {pestana.categorias.map((cat) => (
                        <Button
                          key={cat}
                          type="button"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => abrirNuevo(cat)}
                        >
                          <Plus className="size-3.5" />
                          {cat === "analista_sae"
                            ? "Analista SAE"
                            : cat === "supervision_rotatoria"
                              ? "Supervisión rotatoria"
                              : "Agregar responsable"}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              }
            />
          </TabsContent>
        ))}
      </Tabs>

      <DialogoResponsableCoordinacion
        abierto={dialogoAbierto}
        onCerrar={cerrarDialogo}
        responsable={responsableEditando}
        categoriaInicial={categoriaInicialDialogo ?? pestanaActiva.categorias[0]}
        guardando={guardando}
        error={error}
        onGuardar={(r) => void guardarResponsable(r)}
      />
    </div>
  );
}
