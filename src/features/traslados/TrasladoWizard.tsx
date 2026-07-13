// Wizard de traslado formal: origen → hogar → destino+motivo → confirmar.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Search, Truck, Users } from "lucide-react";
import type { Usuario } from "@/data/authSupabase";
import {
  buscarHogaresTrasladables,
  etiquetaDocumentoMiembro,
  ejecutarTraslado,
} from "@/data/reposTraslados";
import type { HogarTrasladable } from "@/domain/traslados";
import { puedeEditarCentro, permisosDeRol } from "@/domain/permisos";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

type Paso = 1 | 2 | 3;

interface Props {
  usuario: Usuario;
  centros: CentroTransitorio[];
  /** True mientras llega el catálogo de campamentos (evita falso “sin alcance”). */
  cargandoCentros?: boolean;
  errorCentros?: string | null;
  nombresCentros: Map<string, string>;
  onExito: () => void;
}

export function TrasladoWizard({
  usuario,
  centros,
  cargandoCentros = false,
  errorCentros = null,
  nombresCentros,
  onExito,
}: Props) {
  const infoRol = permisosDeRol(usuario.rol);
  const puedeEscribir = infoRol.puedeEscribir;
  const centrosEditables = useMemo(() => {
    // Escritura total (admin / analista_sae): toda la red cargada.
    if (infoRol.escrituraTotal) return centros;
    return centros.filter((c) => puedeEditarCentro(usuario, c.id));
  }, [centros, usuario, infoRol.escrituraTotal]);

  /** Roles de alcance limitado: mirar asignaciones, no el catálogo aún vacío. */
  const centrosAsignados = usuario.centros_asignados ?? [];
  const alcanceLimitadoInsuficiente =
    !infoRol.escrituraTotal && centrosAsignados.length < 2;

  const [paso, setPaso] = useState<Paso>(1);
  const [centroOrigen, setCentroOrigen] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [hogares, setHogares] = useState<HogarTrasladable[]>([]);
  const [cargandoHogares, setCargandoHogares] = useState(false);
  const [errorHogares, setErrorHogares] = useState<string | null>(null);
  const [hogarSel, setHogarSel] = useState<HogarTrasladable | null>(null);
  const [centroDestino, setCentroDestino] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargarHogares = useCallback(async (centroId: string, q: string) => {
    if (!centroId) {
      setHogares([]);
      return;
    }
    setCargandoHogares(true);
    setErrorHogares(null);
    try {
      const lista = await buscarHogaresTrasladables(centroId, q);
      setHogares(lista);
    } catch (err) {
      setHogares([]);
      setErrorHogares(
        err instanceof Error ? err.message : "No se pudieron cargar hogares",
      );
    } finally {
      setCargandoHogares(false);
    }
  }, []);

  useEffect(() => {
    if (!centroOrigen) return;
    const t = window.setTimeout(() => {
      void cargarHogares(centroOrigen, busqueda);
    }, 250);
    return () => window.clearTimeout(t);
  }, [centroOrigen, busqueda, cargarHogares]);

  const destinos = useMemo(
    () => centrosEditables.filter((c) => c.id !== centroOrigen),
    [centrosEditables, centroOrigen],
  );

  function reiniciarFormulario() {
    setPaso(1);
    setCentroOrigen("");
    setBusqueda("");
    setHogares([]);
    setHogarSel(null);
    setCentroDestino("");
    setMotivo("");
    setError(null);
  }

  async function confirmarTraslado() {
    if (!hogarSel || !centroOrigen || !centroDestino) return;
    setEjecutando(true);
    setError(null);
    setExito(null);
    try {
      const resultado = await ejecutarTraslado({
        centroOrigen,
        centroDestino,
        motivo,
        familiaId: hogarSel.familia_id,
        alojamientoId: hogarSel.familia_id ? null : hogarSel.alojamiento_id,
      });
      setConfirmOpen(false);
      reiniciarFormulario();
      setExito(
        `Traslado registrado (${resultado.miembros.length} persona${resultado.miembros.length === 1 ? "" : "s"}).`,
      );
      onExito();
    } catch (err) {
      setConfirmOpen(false);
      setError(
        err instanceof Error ? err.message : "No se pudo completar el traslado",
      );
    } finally {
      setEjecutando(false);
    }
  }

  if (!puedeEscribir) {
    return (
      <Alert>
        <AlertTitle>Solo lectura</AlertTitle>
        <AlertDescription>
          Su rol puede consultar el historial de traslados, pero no registrar
          movimientos.
        </AlertDescription>
      </Alert>
    );
  }

  if (cargandoCentros) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="size-4" />
            Nuevo traslado
          </CardTitle>
          <CardDescription>Cargando campamentos…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (errorCentros) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error al cargar campamentos</AlertTitle>
        <AlertDescription>{errorCentros}</AlertDescription>
      </Alert>
    );
  }

  if (alcanceLimitadoInsuficiente) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Alcance insuficiente</AlertTitle>
        <AlertDescription>
          Necesita al menos dos campamentos asignados para registrar un
          traslado. Consulte con un administrador.
        </AlertDescription>
      </Alert>
    );
  }

  if (centrosEditables.length < 2) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Catálogo incompleto</AlertTitle>
        <AlertDescription>
          No hay suficientes campamentos visibles para origen y destino. Recargue
          la página o verifique su conexión.
        </AlertDescription>
      </Alert>
    );
  }

  const nombreOrigen = nombresCentros.get(centroOrigen) ?? centroOrigen;
  const nombreDestino = nombresCentros.get(centroDestino) ?? centroDestino;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="size-4" />
          Nuevo traslado
        </CardTitle>
        <CardDescription>
          Paso {paso} de 3 — familia completa (o persona sola) pasa de un
          campamento a otro en una sola operación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {exito && (
          <Alert>
            <AlertTitle>Listo</AlertTitle>
            <AlertDescription>{exito}</AlertDescription>
          </Alert>
        )}

        {paso === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="centro-origen">Campamento origen</Label>
              <Select
                value={centroOrigen || undefined}
                onValueChange={(v) => {
                  setCentroOrigen(v);
                  setHogarSel(null);
                  setCentroDestino("");
                  setBusqueda("");
                }}
              >
                <SelectTrigger id="centro-origen" className="w-full">
                  <SelectValue placeholder="Seleccione campamento" />
                </SelectTrigger>
                <SelectContent>
                  {centrosEditables.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buscar-hogar">Buscar hogar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="buscar-hogar"
                  className="pl-8"
                  placeholder="Nombre de familia, persona o cédula"
                  value={busqueda}
                  disabled={!centroOrigen}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>

            {!centroOrigen ? (
              <p className="text-sm text-muted-foreground">
                Elija campamento origen para listar hogares activos.
              </p>
            ) : cargandoHogares ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : errorHogares ? (
              <Alert variant="destructive">
                <AlertDescription>{errorHogares}</AlertDescription>
              </Alert>
            ) : hogares.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay hogares activos que coincidan.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hogar</TableHead>
                      <TableHead className="w-24 text-right">Miembros</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hogares.map((h) => {
                      const sel = hogarSel?.clave === h.clave;
                      return (
                        <TableRow
                          key={h.clave}
                          className={sel ? "bg-primary/10" : undefined}
                        >
                          <TableCell>
                            <div className="font-medium">{h.nombre_hogar}</div>
                            <div className="text-xs text-muted-foreground">
                              {h.familia_id
                                ? "Familia"
                                : "Persona sin hogar"}
                              {" · "}
                              {h.miembros
                                .slice(0, 2)
                                .map((m) => m.nombre)
                                .join(", ")}
                              {h.miembros.length > 2
                                ? ` +${h.miembros.length - 2}`
                                : ""}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">
                              {h.miembros.length}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant={sel ? "default" : "outline"}
                              onClick={() => setHogarSel(h)}
                            >
                              {sel ? "Elegido" : "Elegir"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                className="gap-1.5"
                disabled={!hogarSel}
                onClick={() => {
                  setExito(null);
                  setPaso(2);
                }}
              >
                Continuar
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {paso === 2 && hogarSel && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <div className="font-medium">{hogarSel.nombre_hogar}</div>
              <div className="text-muted-foreground">
                Origen: {nombreOrigen} · {hogarSel.miembros.length} persona
                {hogarSel.miembros.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Rol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hogarSel.miembros.map((m) => (
                    <TableRow key={m.alojamiento_id}>
                      <TableCell className="font-medium">{m.nombre}</TableCell>
                      <TableCell>{etiquetaDocumentoMiembro(m)}</TableCell>
                      <TableCell>
                        {m.es_jefe_familia ? (
                          <Badge>Líder</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {m.parentesco_jefe || "Miembro"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Alert>
              <Users className="size-4" />
              <AlertTitle>Traslado completo</AlertTitle>
              <AlertDescription>
                Todos los miembros activos listados se egresan del origen y se
                dan de alta en el destino. No se puede partir la familia en este
                MVP.
              </AlertDescription>
            </Alert>

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaso(1)}
              >
                <ArrowLeft className="size-4" />
                Atrás
              </Button>
              <Button type="button" onClick={() => setPaso(3)}>
                Continuar
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {paso === 3 && hogarSel && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="centro-destino">Campamento destino</Label>
              <Select
                value={centroDestino || undefined}
                onValueChange={setCentroDestino}
              >
                <SelectTrigger id="centro-destino" className="w-full">
                  <SelectValue placeholder="Seleccione destino" />
                </SelectTrigger>
                <SelectContent>
                  {destinos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo-traslado">Motivo</Label>
              <Textarea
                id="motivo-traslado"
                rows={3}
                placeholder="Motivo del traslado (obligatorio)"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaso(2)}
              >
                <ArrowLeft className="size-4" />
                Atrás
              </Button>
              <Button
                type="button"
                disabled={
                  !centroDestino || motivo.trim().length < 3 || ejecutando
                }
                onClick={() => setConfirmOpen(true)}
              >
                Revisar y confirmar
              </Button>
            </div>
          </div>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Confirmar traslado?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Se egresarán{" "}
                    <strong className="text-foreground">
                      {hogarSel?.miembros.length ?? 0}
                    </strong>{" "}
                    persona
                    {(hogarSel?.miembros.length ?? 0) === 1 ? "" : "s"} de{" "}
                    <strong className="text-foreground">{nombreOrigen}</strong>{" "}
                    y se darán de alta en{" "}
                    <strong className="text-foreground">{nombreDestino}</strong>
                    .
                  </p>
                  <p>
                    Hogar:{" "}
                    <strong className="text-foreground">
                      {hogarSel?.nombre_hogar}
                    </strong>
                  </p>
                  <p>
                    Motivo:{" "}
                    <strong className="text-foreground">{motivo.trim()}</strong>
                  </p>
                  <p>Esta acción no se puede deshacer desde esta pantalla.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={ejecutando}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={ejecutando}
                onClick={(e) => {
                  e.preventDefault();
                  void confirmarTraslado();
                }}
              >
                {ejecutando ? "Trasladando…" : "Confirmar traslado"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
