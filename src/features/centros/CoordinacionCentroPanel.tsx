import { useMemo, useState } from "react";
import {
  ChartBar,
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
  CATEGORIAS_RESPONSABILIDAD_COORDINACION,
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

const ICONO_CATEGORIA: Record<CategoriaResponsabilidadCoordinacion, React.ReactNode> = {
  politica: <Landmark className="size-3.5 shrink-0" />,
  seguridad: <Shield className="size-3.5 shrink-0" />,
  salud: <Stethoscope className="size-3.5 shrink-0" />,
  justicia: <Scale className="size-3.5 shrink-0" />,
  supervision_rotatoria: <RotateCw className="size-3.5 shrink-0" />,
  comunitaria: <Users className="size-3.5 shrink-0" />,
  analista_sae: <ChartBar className="size-3.5 shrink-0" />,
};

const ETIQUETA_CORTA: Partial<Record<CategoriaResponsabilidadCoordinacion, string>> = {
  politica: "Política",
  seguridad: "Seguridad",
  salud: "Salud",
  justicia: "Justicia",
  supervision_rotatoria: "Supervisión",
  comunitaria: "Comunitaria",
  analista_sae: "SAE",
};

function contarPorCategoria(
  responsables: ResponsableCoordinacion[],
): Record<CategoriaResponsabilidadCoordinacion, number> {
  const counts = Object.fromEntries(
    CATEGORIAS_RESPONSABILIDAD_COORDINACION.map((c) => [c.valor, 0]),
  ) as Record<CategoriaResponsabilidadCoordinacion, number>;
  for (const r of responsables.filter(responsableCoordinacionTieneDatos)) {
    counts[r.categoria] += 1;
  }
  return counts;
}

function categoriaInicial(responsables: ResponsableCoordinacion[]): CategoriaResponsabilidadCoordinacion {
  const primeraConDatos = CATEGORIAS_RESPONSABILIDAD_COORDINACION.find(
    (c) => responsables.some((r) => r.categoria === c.valor && responsableCoordinacionTieneDatos(r)),
  );
  return primeraConDatos?.valor ?? "politica";
}

/** Pestaña Coordinación: sub-pestañas por ámbito + diálogo para crear/editar responsables. */
export function CoordinacionCentroPanel({ centro, puedeEditar }: Props) {
  const c = normalizarCentro(centro);
  const visibles = useMemo(
    () => c.responsables_coordinacion.filter(responsableCoordinacionTieneDatos),
    [c.responsables_coordinacion],
  );
  const conteos = useMemo(() => contarPorCategoria(c.responsables_coordinacion), [c.responsables_coordinacion]);
  const personalTotal = useMemo(
    () => visibles.reduce((sum, r) => sum + r.personal_mando, 0),
    [visibles],
  );
  const categoriasActivas = useMemo(
    () => CATEGORIAS_RESPONSABILIDAD_COORDINACION.filter((cat) => conteos[cat.valor] > 0).length,
    [conteos],
  );

  const [subTab, setSubTab] = useState<CategoriaResponsabilidadCoordinacion>(() =>
    categoriaInicial(c.responsables_coordinacion),
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

  const categoriaActiva = CATEGORIAS_RESPONSABILIDAD_COORDINACION.find((c) => c.valor === subTab)!;

  async function persistir(lista: ResponsableCoordinacion[]) {
    setError(null);
    setGuardando(true);
    try {
      const preparada = prepararResponsablesCoordinacionParaGuardar(
        asegurarIdsResponsablesCoordinacion(lista),
      );
      const sync = syncCentroDesdeCoordinacion(centro, preparada);
      await guardarCentro({
        ...centro,
        responsables_coordinacion: preparada,
        personal: sync.personal,
        servicios: sync.servicios,
      });
      setDialogoAbierto(false);
      setResponsableEditando(null);
      setCategoriaInicialDialogo(undefined);
      return true;
    } catch (err) {
      console.error("[CoordinacionCentroPanel] error guardando:", err);
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
    setCategoriaInicialDialogo(categoria ?? subTab);
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
      setSubTab(responsable.categoria);
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
      {/* Franja resumen */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">
          Responsables:{" "}
          <span className="font-medium text-foreground">
            {visibles.length > 0
              ? visibles.length
              : "sin registrar"}
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
        onValueChange={(v) => setSubTab(v as CategoriaResponsabilidadCoordinacion)}
        className="gap-0"
      >
        <div className="border-b border-border">
          <TabsList
            variant="line"
            className="!flex h-10 w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {CATEGORIAS_RESPONSABILIDAD_COORDINACION.map((cat) => (
              <TabsTrigger
                key={cat.valor}
                value={cat.valor}
                title={cat.label}
                className={tabTriggerClass}
                style={
                  subTab === cat.valor
                    ? { borderBottomColor: cat.color, color: cat.color }
                    : undefined
                }
              >
                {ICONO_CATEGORIA[cat.valor]}
                <span className="truncate">{ETIQUETA_CORTA[cat.valor] ?? cat.label}</span>
                {conteos[cat.valor] > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 px-1 text-[9px] tabular-nums"
                  >
                    {conteos[cat.valor]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {CATEGORIAS_RESPONSABILIDAD_COORDINACION.map((cat) => (
          <TabsContent key={cat.valor} value={cat.valor} className="mt-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold"
                  style={{ color: cat.color }}
                >
                  {cat.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {descripcionCategoria(cat.valor)}
                </p>
              </div>
              {puedeEditar && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 bg-teal-600 hover:bg-teal-500"
                  disabled={guardando}
                  onClick={() => abrirNuevo(cat.valor)}
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
              categoria={cat.valor}
              integrado
              modoEdicion={puedeEditar}
              ocultarBadgeCategoria
              onEditar={abrirEditar}
              onEliminar={(id) => void eliminarResponsable(id)}
              vacio={
                <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
                  <ClipboardList className="mx-auto size-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    Sin datos en {cat.label.toLowerCase()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Registra el responsable, contacto y personal desplegado de este ámbito.
                  </p>
                  {puedeEditar && (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-4 gap-1.5"
                      onClick={() => abrirNuevo(cat.valor)}
                    >
                      <Plus className="size-3.5" />
                      Agregar responsable
                    </Button>
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
        categoriaInicial={categoriaInicialDialogo ?? categoriaActiva.valor}
        guardando={guardando}
        error={error}
        onGuardar={(r) => void guardarResponsable(r)}
      />
    </div>
  );
}

function descripcionCategoria(categoria: CategoriaResponsabilidadCoordinacion): string {
  switch (categoria) {
    case "politica":
      return "Coordinación política e institucional del campamento.";
    case "seguridad":
      return "Seguridad física, organismo y personal desplegado.";
    case "salud":
      return "Personal médico, psicosocial y logística sanitaria.";
    case "justicia":
      return "TJS, Ministerio Público y Defensoría del Pueblo.";
    case "supervision_rotatoria":
      return "Supervisión rotatoria del ámbito territorial.";
    case "comunitaria":
      return "Coordinación comunitaria y funcionarios de apoyo.";
    case "analista_sae":
      return "Analista de la SAE asignado al campamento.";
    default:
      return "";
  }
}
