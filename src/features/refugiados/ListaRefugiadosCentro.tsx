// Lista nominal de damnificados agrupada por familia en la pestaña Población.

import { useMemo, useState } from "react";
import { FilterX, Search, UserPlus, Users } from "lucide-react";
import { useAlojamientosCentro } from "@/data/useAlojamientosCentro";
import { useRefugiadosRed } from "@/data/useRefugiadosRed";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  agruparPorFamilia,
  detectarDuplicadosCedula,
  formatearCedula,
  META_ESTADO_ALOJAMIENTO,
  nombreCompleto,
  type AlojamientoEnriquecido,
  type EstadoAlojamiento,
} from "@/domain/refugiados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  onRegistrar: () => void;
  onAbrirRefugiado: (alojamientoId: string) => void;
}

type FiltroEstado = EstadoAlojamiento | "todos";

export function ListaRefugiadosCentro({
  centro,
  puedeEditar,
  onRegistrar,
  onAbrirRefugiado,
}: Props) {
  const { alojamientos, familias, cargando } = useAlojamientosCentro({ centroId: centro.id });
  const { alojamientos: alojamientosRed } = useRefugiadosRed();

  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("activo");
  const [soloItinerante, setSoloItinerante] = useState(false);

  const duplicados = useMemo(() => detectarDuplicadosCedula(alojamientosRed), [alojamientosRed]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return alojamientos.filter((a) => {
      if (estado !== "todos" && a.estado !== estado) return false;
      if (soloItinerante && !a.itinerante) return false;
      if (!q) return true;
      const nom = nombreCompleto(a.refugiado).toLowerCase();
      const ced = (a.refugiado.cedula_norm ?? "").toLowerCase();
      return nom.includes(q) || ced.includes(q);
    });
  }, [alojamientos, busqueda, estado, soloItinerante]);

  const grupos = useMemo(() => agruparPorFamilia(filtrados), [filtrados]);
  const activos = useMemo(
    () => alojamientos.filter((a) => a.estado === "activo").length,
    [alojamientos],
  );

  const hayFiltros = busqueda.trim() !== "" || estado !== "activo" || soloItinerante;

  function limpiarFiltros() {
    setBusqueda("");
    setEstado("activo");
    setSoloItinerante(false);
  }

  function renderFila(a: AlojamientoEnriquecido) {
    const norm = a.refugiado.cedula_norm;
    const esDup = norm ? (duplicados.get(norm)?.length ?? 0) >= 2 : false;
    const meta = META_ESTADO_ALOJAMIENTO[a.estado];
    return (
      <TableRow
        key={a.id}
        className={cn("cursor-pointer hover:bg-muted/40", esDup && "bg-amber-500/5")}
        onClick={() => onAbrirRefugiado(a.id)}
      >
        <TableCell className="font-medium">
          {nombreCompleto(a.refugiado)}
          {a.es_jefe_familia && (
            <Badge variant="outline" className="ml-1.5 text-[9px]">
              Jefe
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {formatearCedula(a.refugiado.cedula, a.refugiado.tipo_doc)}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">{a.fecha_ingreso}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ borderColor: meta.color, color: meta.color }}
            >
              {meta.label}
            </Badge>
            {a.itinerante && (
              <Badge variant="outline" className="border-sky-500/40 text-[10px] text-sky-400">
                Itinerante
              </Badge>
            )}
            {esDup && (
              <Badge variant="outline" className="border-amber-500/50 text-[10px] text-amber-500">
                Duplicado
              </Badge>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-muted-foreground" />
              Censo nominal
            </CardTitle>
            <CardDescription>
              {activos} activo(s) · {filtrados.length} visible(s)
              {cargando && " · cargando…"}
            </CardDescription>
          </div>
          {puedeEditar && (
            <Button type="button" size="sm" className="gap-1.5" onClick={onRegistrar}>
              <UserPlus className="size-4" />
              Registrar persona
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o documento…"
              className="h-9 pl-9"
            />
          </div>
          <Select value={estado} onValueChange={(v) => setEstado(v as FiltroEstado)}>
            <SelectTrigger className="h-9 w-[9rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="egresado">Egresados</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant={soloItinerante ? "secondary" : "outline"}
            className="h-9"
            onClick={() => setSoloItinerante((v) => !v)}
          >
            Itinerantes
          </Button>
          {hayFiltros && (
            <Button type="button" size="sm" variant="ghost" className="h-9 gap-1" onClick={limpiarFiltros}>
              <FilterX className="size-3.5" />
              Limpiar
            </Button>
          )}
        </div>

        {[...grupos.entries()].length === 0 && !cargando ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 py-10 text-center">
            <Users className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No hay registros nominales</p>
            {puedeEditar && (
              <Button type="button" variant="link" size="sm" className="mt-1" onClick={onRegistrar}>
                Registrar la primera persona
              </Button>
            )}
          </div>
        ) : (
          [...grupos.entries()].map(([familiaId, miembros]) => {
            const familia = familiaId ? familias.find((f) => f.id === familiaId) : null;
            const titulo = familia?.nombre || (familiaId ? "Familia" : "Sin familia asignada");
            return (
              <div key={familiaId ?? "sin-familia"} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {titulo}
                  </h4>
                  <Badge variant="secondary" className="text-[10px]">
                    {miembros.length}
                  </Badge>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Persona</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Ingreso</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>{miembros.map(renderFila)}</TableBody>
                  </Table>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
