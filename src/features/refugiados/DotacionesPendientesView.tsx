// Vista de reportes: dotaciones pendientes red-wide + export CSV.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FilterX, Gift } from "lucide-react";
import { useRefugiadosRed } from "@/data/useRefugiadosRed";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { CATALOGO_ITEM_KIT, META_ITEM_KIT, type ItemKit } from "@/domain/beneficios";
import { esMenor5 } from "@/domain/refugiados";
import { pendientesRed, pendientesACsv } from "@/domain/kitMinimo";
import { listarBeneficiosRefugiado } from "@/data/reposRefugiados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";

export function DotacionesPendientesView() {
  const navigate = useNavigate();
  const { alojamientos, cargando: cargandoRed } = useRefugiadosRed();
  const [beneficiosMap, setBeneficiosMap] = useState<Map<string, Awaited<ReturnType<typeof listarBeneficiosRefugiado>>>>(new Map());
  const [cargandoBen, setCargandoBen] = useState(false);

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>("centros", {
    transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
    clientFilter: (c) => !c.deleted,
  });
  const nombresCentros = useMemo(
    () => new Map(filasCentros.map((c) => [c.id, c.nombre || c.id])),
    [filasCentros],
  );

  const [centroId, setCentroId] = useState("todos");
  const [itemKit, setItemKit] = useState<ItemKit | "todos">("todos");
  const [talla, setTalla] = useState("");
  const [soloNinos, setSoloNinos] = useState(false);

  // Cargar beneficios de todos los damnificados visibles
  useEffect(() => {
    if (cargandoRed || alojamientos.length === 0) return;
    setCargandoBen(true);
    void (async () => {
      const map = new Map<string, Awaited<ReturnType<typeof listarBeneficiosRefugiado>>>();
      await Promise.all(
        alojamientos.map(async (a) => {
          const b = await listarBeneficiosRefugiado(a.refugiado_id);
          map.set(a.refugiado_id, b);
        }),
      );
      setBeneficiosMap(map);
      setCargandoBen(false);
    })();
  }, [alojamientos, cargandoRed]);

  const filas = useMemo(() => {
    const personas = alojamientos
      .filter((a) => !soloNinos || esMenor5(a.refugiado.fecha_nacimiento))
      .map((a) => ({
        refugiado: a.refugiado,
        alojamientoId: a.id,
        centroId: a.centro_id,
        entregas: beneficiosMap.get(a.refugiado_id) ?? [],
      }));
    return pendientesRed(personas, {
      centroId: centroId === "todos" ? undefined : centroId,
      item: itemKit === "todos" ? undefined : itemKit,
      talla: talla.trim() || undefined,
    });
  }, [alojamientos, beneficiosMap, centroId, itemKit, talla, soloNinos]);

  function exportarCsv() {
    const csv = pendientesACsv(filas);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dotaciones-pendientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cargando = cargandoRed || cargandoBen;

  return (
    <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL} rellenarAltura marcoClassName="flex min-h-0 flex-col">
      <VistaEncabezado
        icono={Gift}
        acento="amber"
        titulo="Dotaciones pendientes"
        descripcion="Kit mínimo por persona — filtros y exportación CSV"
        acciones={
          <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={filas.length === 0} onClick={exportarCsv}>
            <Download className="size-3.5" />
            Exportar CSV
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label className="text-[10px]">Campamento</Label>
              <Select value={centroId} onValueChange={setCentroId}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {filasCentros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre || c.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Ítem kit</Label>
              <Select value={itemKit} onValueChange={(v) => setItemKit(v as ItemKit | "todos")}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {CATALOGO_ITEM_KIT.map((i) => (
                    <SelectItem key={i.valor} value={i.valor}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Talla</Label>
              <Input value={talla} onChange={(e) => setTalla(e.target.value)} placeholder="L, M, 38…" className="mt-1 h-9" />
            </div>
            <div className="flex items-end gap-2">
              <Button variant={soloNinos ? "default" : "outline"} size="sm" onClick={() => setSoloNinos((v) => !v)}>
                Niños &lt;5 (pañales)
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setCentroId("todos"); setItemKit("todos"); setTalla(""); setSoloNinos(false); }}>
                <FilterX className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando pendientes…</p>
        ) : filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin pendientes con estos filtros.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campamento</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Ítem</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>Faltante</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f, i) => (
                  <TableRow key={`${f.refugiadoId}-${f.item}-${i}`}>
                    <TableCell className="text-xs">{nombresCentros.get(f.centroId) ?? f.centroId}</TableCell>
                    <TableCell className="font-mono text-[10px]">{f.codigoFicha ?? "—"}</TableCell>
                    <TableCell>{f.nombre}</TableCell>
                    <TableCell>{META_ITEM_KIT[f.item]?.label ?? f.item}</TableCell>
                    <TableCell>{f.talla ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{f.faltante}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{f.prioridad}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          {filas.length} fila(s) · Clic en persona desde{" "}
          <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate("/centros/refugiados")}>
            población nominal
          </Button>
        </p>
      </div>
    </MarcoVista>
  );
}
