// Wizard de traslado: buscar cédula/nombre → seleccionar miembros → destino.

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronsUpDown,
  Search,
  Truck,
  Users,
} from "lucide-react";
import type { Usuario } from "@/data/authSupabase";
import {
  buscarTrasladoPorCedula,
  buscarTrasladoPorNombre,
  etiquetaDocumentoMiembro,
  ejecutarTraslado,
  obtenerHogarTrasladable,
} from "@/data/reposTraslados";
import type {
  CandidatoTrasladoNombre,
  HogarTrasladable,
} from "@/domain/traslados";
import type { TipoDoc } from "@/domain/refugiados";
import {
  puedeEditarCentro,
  puedeTrasladarEntreCentros,
  permisosDeRol,
} from "@/domain/permisos";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { cn } from "@/lib/utils";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

type Paso = 1 | 2;

interface Props {
  usuario: Usuario;
  centros: CentroTransitorio[];
  cargandoCentros?: boolean;
  errorCentros?: string | null;
  nombresCentros: Map<string, string>;
  onExito: () => void;
}

function idsIniciales(hogar: HogarTrasladable): Set<string> {
  const ref = hogar.referencia_alojamiento_id;
  if (ref && hogar.miembros.some((m) => m.alojamiento_id === ref)) {
    return new Set([ref]);
  }
  if (hogar.miembros.length === 1) {
    return new Set([hogar.miembros[0].alojamiento_id]);
  }
  return new Set();
}

function validarFiltrosNombre(
  nombres: string,
  apellidos: string,
  sexo: string,
  edadMin: string,
  edadMax: string,
): string | null {
  const n = nombres.trim();
  const a = apellidos.trim();
  if (n.length < 2 && a.length < 2) {
    return "Indique al menos 2 caracteres en nombres o apellidos.";
  }
  if (!sexo && !edadMin && !edadMax) {
    return "Indique sexo o rango de edad para acotar la búsqueda.";
  }
  return null;
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
  const puedeTrasladar = puedeTrasladarEntreCentros(usuario.rol);
  const centrosEditables = useMemo(() => {
    if (infoRol.escrituraTotal) return centros;
    return centros.filter((c) => puedeEditarCentro(usuario, c.id));
  }, [centros, usuario, infoRol.escrituraTotal]);

  const centrosAsignados = usuario.centros_asignados ?? [];
  const alcanceLimitadoInsuficiente =
    !infoRol.escrituraTotal && centrosAsignados.length < 2;

  const [paso, setPaso] = useState<Paso>(1);
  const [cedula, setCedula] = useState("");
  const [tipoDoc, setTipoDoc] = useState<TipoDoc>("V");
  const [buscandoCedula, setBuscandoCedula] = useState(false);

  const [nombreExpandido, setNombreExpandido] = useState(false);
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [sexoFiltro, setSexoFiltro] = useState("");
  const [edadMin, setEdadMin] = useState("");
  const [edadMax, setEdadMax] = useState("");
  const [buscandoNombre, setBuscandoNombre] = useState(false);
  const [candidatos, setCandidatos] = useState<CandidatoTrasladoNombre[]>([]);

  const [hogar, setHogar] = useState<HogarTrasladable | null>(null);
  const [referenciaId, setReferenciaId] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const [centroDestino, setCentroDestino] = useState("");
  const [comboDestinoAbierto, setComboDestinoAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  const destinos = useMemo(
    () =>
      centrosEditables.filter((c) => c.id !== (hogar?.centro_id ?? "")),
    [centrosEditables, hogar?.centro_id],
  );

  const nombreOrigen =
    hogar?.centro_nombre ??
    (hogar ? nombresCentros.get(hogar.centro_id) : undefined) ??
    hogar?.centro_id ??
    "";
  const nombreDestino =
    nombresCentros.get(centroDestino) ?? centroDestino;

  function reiniciarFormulario() {
    setPaso(1);
    setCedula("");
    setNombres("");
    setApellidos("");
    setSexoFiltro("");
    setEdadMin("");
    setEdadMax("");
    setCandidatos([]);
    setHogar(null);
    setReferenciaId(null);
    setSeleccionados(new Set());
    setCentroDestino("");
    setMotivo("");
    setError(null);
    setErrorBusqueda(null);
  }

  function aplicarHogar(h: HogarTrasladable) {
    setHogar(h);
    setReferenciaId(h.referencia_alojamiento_id ?? null);
    setSeleccionados(idsIniciales(h));
    setCandidatos([]);
    setErrorBusqueda(null);
    setCentroDestino("");
  }

  async function buscarPorCedula() {
    const q = cedula.trim();
    if (!q) {
      setErrorBusqueda("Indique la cédula a buscar.");
      return;
    }
    setBuscandoCedula(true);
    setErrorBusqueda(null);
    setExito(null);
    try {
      const resultado = await buscarTrasladoPorCedula(q, tipoDoc);
      if (!resultado) {
        setHogar(null);
        setErrorBusqueda(
          "No se encontró persona activa con esa cédula en su alcance.",
        );
        return;
      }
      aplicarHogar(resultado);
    } catch (err) {
      setHogar(null);
      setErrorBusqueda(
        err instanceof Error ? err.message : "Error al buscar por cédula",
      );
    } finally {
      setBuscandoCedula(false);
    }
  }

  async function buscarPorNombre() {
    const msg = validarFiltrosNombre(nombres, apellidos, sexoFiltro, edadMin, edadMax);
    if (msg) {
      setErrorBusqueda(msg);
      return;
    }
    setBuscandoNombre(true);
    setErrorBusqueda(null);
    setExito(null);
    setHogar(null);
    try {
      const lista = await buscarTrasladoPorNombre({
        nombres,
        apellidos,
        sexo: sexoFiltro || null,
        edadMin: edadMin ? Number(edadMin) : null,
        edadMax: edadMax ? Number(edadMax) : null,
      });
      setCandidatos(lista);
      if (lista.length === 0) {
        setErrorBusqueda("Sin coincidencias. Ajuste filtros e intente de nuevo.");
      }
    } catch (err) {
      setCandidatos([]);
      setErrorBusqueda(
        err instanceof Error ? err.message : "Error al buscar por nombre",
      );
    } finally {
      setBuscandoNombre(false);
    }
  }

  async function elegirCandidato(c: CandidatoTrasladoNombre) {
    setBuscandoNombre(true);
    setErrorBusqueda(null);
    try {
      const h = await obtenerHogarTrasladable(c.alojamiento_id, c.alojamiento_id);
      if (!h) {
        setErrorBusqueda("No se pudo cargar el hogar de la persona seleccionada.");
        return;
      }
      aplicarHogar(h);
    } catch (err) {
      setErrorBusqueda(
        err instanceof Error ? err.message : "Error al cargar hogar",
      );
    } finally {
      setBuscandoNombre(false);
    }
  }

  function toggleMiembro(id: string, checked: boolean) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function seleccionarTodos() {
    if (!hogar) return;
    setSeleccionados(new Set(hogar.miembros.map((m) => m.alojamiento_id)));
  }

  function seleccionarNinguno() {
    setSeleccionados(new Set());
  }

  async function confirmarTraslado() {
    if (!hogar || !centroDestino) return;
    const ids = [...seleccionados];
    setEjecutando(true);
    setError(null);
    setExito(null);
    try {
      const resultado = await ejecutarTraslado({
        centroOrigen: hogar.centro_id,
        centroDestino,
        motivo,
        alojamientoIds: ids,
        jefeAlojamientoId: referenciaId,
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

  const puedeContinuar =
    hogar != null && seleccionados.size > 0 && !buscandoCedula && !buscandoNombre;

  if (!puedeTrasladar) {
    return (
      <Alert>
        <AlertTitle>Sin permiso</AlertTitle>
        <AlertDescription>
          Solo administradores, analistas SAE y supervisores pueden registrar
          traslados entre campamentos.
        </AlertDescription>
      </Alert>
    );
  }

  if (cargandoCentros) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (errorCentros) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorCentros}</AlertDescription>
      </Alert>
    );
  }

  if (alcanceLimitadoInsuficiente) {
    return (
      <Alert>
        <AlertTitle>Alcance insuficiente</AlertTitle>
        <AlertDescription>
          Necesita permiso de escritura en al menos dos campamentos asignados
          para registrar traslados entre ellos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="size-4" />
          Registrar traslado
        </CardTitle>
        <CardDescription>
          {paso === 1
            ? "Busque por cédula o por nombre, seleccione quién se traslada."
            : "Indique campamento destino y motivo."}
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
            <div className="space-y-2 rounded-md border p-3">
              <Label htmlFor="cedula-traslado">Cédula</Label>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={tipoDoc}
                  onValueChange={(v) => setTipoDoc(v as TipoDoc)}
                >
                  <SelectTrigger className="w-[88px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="V">V</SelectItem>
                    <SelectItem value="E">E</SelectItem>
                    <SelectItem value="P">P</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="cedula-traslado"
                  className="min-w-[160px] flex-1"
                  placeholder="Número de documento"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void buscarPorCedula();
                  }}
                />
                <Button
                  type="button"
                  className="gap-1.5"
                  disabled={buscandoCedula}
                  onClick={() => void buscarPorCedula()}
                >
                  <Search className="size-4" />
                  {buscandoCedula ? "Buscando…" : "Buscar"}
                </Button>
              </div>
            </div>

            <Collapsible open={nombreExpandido} onOpenChange={setNombreExpandido}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between">
                  Buscar por nombres y apellidos
                  <ChevronsUpDown className="size-4 opacity-60" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="nombres-traslado">Nombres</Label>
                    <Input
                      id="nombres-traslado"
                      value={nombres}
                      onChange={(e) => setNombres(e.target.value)}
                      placeholder="Al menos 2 caracteres"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="apellidos-traslado">Apellidos</Label>
                    <Input
                      id="apellidos-traslado"
                      value={apellidos}
                      onChange={(e) => setApellidos(e.target.value)}
                      placeholder="Al menos 2 caracteres"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Sexo</Label>
                    <Select
                      value={sexoFiltro || "todos"}
                      onValueChange={(v) =>
                        setSexoFiltro(v === "todos" ? "" : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Femenino</SelectItem>
                        <SelectItem value="O">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="edad-min">Edad mín.</Label>
                      <Input
                        id="edad-min"
                        type="number"
                        min={0}
                        max={120}
                        value={edadMin}
                        onChange={(e) => setEdadMin(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edad-max">Edad máx.</Label>
                      <Input
                        id="edad-max"
                        type="number"
                        min={0}
                        max={120}
                        value={edadMax}
                        onChange={(e) => setEdadMax(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Requiere nombres o apellidos (≥2 caracteres) y al menos sexo o
                  rango de edad. Máximo 20 resultados.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-1.5"
                  disabled={buscandoNombre}
                  onClick={() => void buscarPorNombre()}
                >
                  <Search className="size-4" />
                  {buscandoNombre ? "Buscando…" : "Buscar por nombre"}
                </Button>
              </CollapsibleContent>
            </Collapsible>

            {errorBusqueda && (
              <Alert variant="destructive">
                <AlertDescription>{errorBusqueda}</AlertDescription>
              </Alert>
            )}

            {candidatos.length > 0 && !hogar && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Campamento</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidatos.map((c) => (
                      <TableRow key={c.alojamiento_id}>
                        <TableCell>
                          <div className="font-medium">{c.nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {etiquetaDocumentoMiembro({
                              alojamiento_id: c.alojamiento_id,
                              refugiado_id: c.refugiado_id,
                              nombre: c.nombre,
                              cedula: c.cedula,
                              tipo_doc: c.tipo_doc,
                              es_jefe_familia: false,
                              parentesco_jefe: "",
                              estado: "activo",
                            })}
                            {c.edad != null ? ` · ${c.edad} años` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{c.centro_nombre}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={buscandoNombre}
                            onClick={() => void elegirCandidato(c)}
                          >
                            Elegir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {hogar && (
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                  <div className="font-medium">{hogar.nombre_hogar}</div>
                  <div className="text-muted-foreground">
                    Origen: {nombreOrigen} · {hogar.miembros.length} persona
                    {hogar.miembros.length === 1 ? "" : "s"} en el hogar
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={seleccionarTodos}>
                    Seleccionar todos
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={seleccionarNinguno}>
                    Ninguno
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Nombre</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Rol</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hogar.miembros.map((m) => {
                        const marcado = seleccionados.has(m.alojamiento_id);
                        return (
                          <TableRow key={m.alojamiento_id}>
                            <TableCell>
                              <Checkbox
                                checked={marcado}
                                onCheckedChange={(v) =>
                                  toggleMiembro(m.alojamiento_id, Boolean(v))
                                }
                                aria-label={`Seleccionar ${m.nombre}`}
                              />
                            </TableCell>
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
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <Alert>
                  <Users className="size-4" />
                  <AlertTitle>Traslado parcial</AlertTitle>
                  <AlertDescription>
                    Solo las personas marcadas se egresan del origen y se dan de
                    alta en el destino. Las demás permanecen en el campamento actual.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                className="gap-1.5"
                disabled={!puedeContinuar}
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

        {paso === 2 && hogar && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <span className="font-medium">{seleccionados.size}</span> persona
              {seleccionados.size === 1 ? "" : "s"} desde{" "}
              <span className="font-medium">{nombreOrigen}</span>
            </div>

            <div className="space-y-2">
              <Label>Campamento destino</Label>
              <Popover open={comboDestinoAbierto} onOpenChange={setComboDestinoAbierto}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboDestinoAbierto}
                    className="w-full justify-between font-normal"
                  >
                    {centroDestino
                      ? nombresCentros.get(centroDestino) ?? centroDestino
                      : "Buscar campamento destino…"}
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Nombre o N° del campamento…" />
                    <CommandList>
                      <CommandEmpty>Sin campamentos.</CommandEmpty>
                      <CommandGroup>
                        {destinos.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.nombre ?? ""} ${c.id} ${c.nro ?? ""}`}
                            onSelect={() => {
                              setCentroDestino(c.id);
                              setComboDestinoAbierto(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                centroDestino === c.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate">
                              {c.nro != null ? `${c.nro}. ` : ""}
                              {c.nombre || c.id}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
              <Button type="button" variant="outline" onClick={() => setPaso(1)}>
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
                    Se trasladarán{" "}
                    <strong className="text-foreground">{seleccionados.size}</strong>{" "}
                    persona{seleccionados.size === 1 ? "" : "s"} de{" "}
                    <strong className="text-foreground">{nombreOrigen}</strong> a{" "}
                    <strong className="text-foreground">{nombreDestino}</strong>.
                  </p>
                  <p>
                    Motivo:{" "}
                    <span className="text-foreground">{motivo.trim()}</span>
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={ejecutando}>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={ejecutando} onClick={() => void confirmarTraslado()}>
                {ejecutando ? "Registrando…" : "Confirmar traslado"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
