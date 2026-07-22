// Flujo para agregar una persona nominal al hogar del campamento.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, Search, UserPlus } from "lucide-react";
import {
  formatearCedula,
  nombreCompleto,
  PARENTESCOS_JEFE,
  type AlojamientoEnriquecido,
  type Refugiado,
  type SexoRefugiado,
  type TipoDoc,
} from "@/domain/refugiados";
import {
  asociarRefugiadoAFamilia,
  buscarRefugiados,
  crearRefugiado,
  listarAlojamientosActivosRefugiado,
} from "@/data/reposRefugiados";
import { claveDia } from "@/data/reposSupabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centroId: string;
  familiaId: string;
  miembros: AlojamientoEnriquecido[];
  onAgregado?: (alojamientoId: string) => void;
}

export function AgregarFamiliarHogarDialog({
  open,
  onOpenChange,
  centroId,
  familiaId,
  miembros,
  onAgregado,
}: Props) {
  const [modo, setModo] = useState<"buscar" | "crear">("buscar");
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<Refugiado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [seleccionado, setSeleccionado] = useState<Refugiado | null>(null);
  const [activosSeleccionado, setActivosSeleccionado] = useState<string[]>([]);

  const [tipoDoc, setTipoDoc] = useState<TipoDoc>("V");
  const [cedula, setCedula] = useState("");
  const [menorSinDocumento, setMenorSinDocumento] = useState(false);
  const [primerNombre, setPrimerNombre] = useState("");
  const [segundoNombre, setSegundoNombre] = useState("");
  const [primerApellido, setPrimerApellido] = useState("");
  const [segundoApellido, setSegundoApellido] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [sexo, setSexo] = useState<SexoRefugiado | "">("");

  const [fechaIngreso, setFechaIngreso] = useState(() => claveDia(Date.now()));
  const [esJefe, setEsJefe] = useState(false);
  const [parentesco, setParentesco] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsMiembros = useMemo(() => new Set(miembros.map((m) => m.refugiado_id)), [miembros]);
  const jefeActual = miembros.find((m) => m.es_jefe_familia);
  const yaEnHogar = seleccionado ? idsMiembros.has(seleccionado.id) : false;

  useEffect(() => {
    if (!open) {
      setModo("buscar");
      setConsulta("");
      setResultados([]);
      setSeleccionado(null);
      setActivosSeleccionado([]);
      setError(null);
      setGuardando(false);
      setEsJefe(false);
      setParentesco("");
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || modo !== "buscar") return;
    const q = consulta.trim();
    if (q.length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const timer = window.setTimeout(() => {
      void buscarRefugiados(q)
        .then((lista) => {
          if (!cancelado) setResultados(lista);
        })
        .catch((err) => {
          if (!cancelado) setError(err instanceof Error ? err.message : "Error al buscar persona");
        })
        .finally(() => {
          if (!cancelado) setBuscando(false);
        });
    }, 250);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [consulta, modo, open]);

  useEffect(() => {
    if (!seleccionado) {
      setActivosSeleccionado([]);
      return;
    }
    let cancelado = false;
    void listarAlojamientosActivosRefugiado(seleccionado.id)
      .then((activos) => {
        if (!cancelado) setActivosSeleccionado(activos.map((a) => a.centro_id));
      })
      .catch(() => {
        if (!cancelado) setActivosSeleccionado([]);
      });
    return () => {
      cancelado = true;
    };
  }, [seleccionado]);

  function validar(): boolean {
    setError(null);
    if (!esJefe && !parentesco.trim()) {
      setError("Selecciona el parentesco con el jefe de familia.");
      return false;
    }
    if (esJefe && jefeActual && seleccionado?.id !== jefeActual.refugiado_id) {
      setError("Este hogar ya tiene un jefe activo. Cambia primero el jefe actual si corresponde.");
      return false;
    }
    if (modo === "buscar") {
      if (!seleccionado) {
        setError("Selecciona una persona existente o registra una nueva.");
        return false;
      }
      return true;
    }
    if (!primerNombre.trim()) {
      setError("El primer nombre es obligatorio.");
      return false;
    }
    if (!menorSinDocumento && !cedula.trim()) {
      setError("El documento es obligatorio salvo que se trate de un menor sin documento.");
      return false;
    }
    if (menorSinDocumento && (!fechaNacimiento || !sexo)) {
      setError("Para un menor sin documento registra fecha de nacimiento y sexo.");
      return false;
    }
    return true;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true);
    setError(null);
    try {
      let refugiadoId = seleccionado?.id;
      if (modo === "crear") {
        refugiadoId = await crearRefugiado({
          cedula: menorSinDocumento ? null : cedula,
          tipo_doc: menorSinDocumento ? null : tipoDoc,
          primer_nombre: primerNombre,
          segundo_nombre: segundoNombre,
          primer_apellido: primerApellido,
          segundo_apellido: segundoApellido,
          fecha_nacimiento: fechaNacimiento || null,
          sexo: sexo || null,
        }, centroId);
      }
      if (!refugiadoId) throw new Error("No se pudo identificar la persona a asociar.");
      const alojamientoId = await asociarRefugiadoAFamilia({
        refugiado_id: refugiadoId,
        centro_id: centroId,
        familia_id: familiaId,
        fecha_ingreso: fechaIngreso,
        es_jefe_familia: esJefe,
        parentesco_jefe: esJefe ? "" : parentesco,
      });
      onAgregado?.(alojamientoId);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el familiar al hogar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar familiar al hogar</DialogTitle>
          <DialogDescription>
            Busca una persona ya registrada o crea una ficha nominal. La persona quedará asociada
            al mismo hogar y centro.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={modo === "buscar" ? "default" : "outline"}
              className="justify-start gap-2"
              onClick={() => {
                setModo("buscar");
                setError(null);
              }}
            >
              <Search className="size-4" />
              Buscar persona existente
            </Button>
            <Button
              type="button"
              variant={modo === "crear" ? "default" : "outline"}
              className="justify-start gap-2"
              onClick={() => {
                setModo("crear");
                setSeleccionado(null);
                setError(null);
              }}
            >
              <UserPlus className="size-4" />
              Registrar persona nueva
            </Button>
          </div>

          {modo === "buscar" ? (
            <div className="rounded-lg border">
              <Command shouldFilter={false}>
                <CommandInput
                  value={consulta}
                  onValueChange={setConsulta}
                  placeholder="Buscar por documento, código de ficha, nombre o apellido…"
                />
                <CommandList>
                  <CommandEmpty>
                    {buscando ? "Buscando…" : "Sin resultados. Puedes registrar una persona nueva."}
                  </CommandEmpty>
                  <CommandGroup>
                    {resultados.map((r) => {
                      const activo = seleccionado?.id === r.id;
                      return (
                        <CommandItem
                          key={r.id}
                          value={r.id}
                          onSelect={() => {
                            setSeleccionado(r);
                            setError(null);
                          }}
                          className="items-start gap-3 py-2"
                        >
                          <div className="mt-0.5 flex size-5 items-center justify-center">
                            {activo && <Check className="size-4 text-primary" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{nombreCompleto(r)}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.codigo_ficha ?? formatearCedula(r.cedula, r.tipo_doc)}
                            </p>
                          </div>
                          {idsMiembros.has(r.id) && (
                            <Badge variant="secondary" className="text-[10px]">
                              Ya está en este hogar
                            </Badge>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="menor-sin-doc-hogar"
                  checked={menorSinDocumento}
                  onCheckedChange={(v) => setMenorSinDocumento(Boolean(v))}
                />
                <Label htmlFor="menor-sin-doc-hogar">Menor sin documento</Label>
              </div>
              {!menorSinDocumento && (
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={tipoDoc} onValueChange={(v) => setTipoDoc(v as TipoDoc)}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="V">V</SelectItem>
                        <SelectItem value="E">E</SelectItem>
                        <SelectItem value="P">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Documento</Label>
                    <Input value={cedula} onChange={(e) => setCedula(e.target.value)} className="mt-1 h-9" />
                  </div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Primer nombre *" value={primerNombre} onChange={setPrimerNombre} />
                <Campo label="Segundo nombre" value={segundoNombre} onChange={setSegundoNombre} />
                <Campo label="Primer apellido" value={primerApellido} onChange={setPrimerApellido} />
                <Campo label="Segundo apellido" value={segundoApellido} onChange={setSegundoApellido} />
                <div>
                  <Label className="text-xs">Fecha de nacimiento</Label>
                  <Input
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Sexo</Label>
                  <Select
                    value={sexo || "none"}
                    onValueChange={(v) => {
                      setSexo(v === "none" ? "" : (v as SexoRefugiado));
                    }}
                  >
                    <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Femenino</SelectItem>
                      <SelectItem value="O">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {menorSinDocumento && (
                <p className="text-xs text-muted-foreground">
                  Al guardar se genera un código de ficha para que el menor sea buscable aunque no tenga documento.
                </p>
              )}
            </div>
          )}

          {seleccionado && (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <p className="font-medium">{nombreCompleto(seleccionado)}</p>
              <p className="text-xs text-muted-foreground">
                {seleccionado.codigo_ficha ?? formatearCedula(seleccionado.cedula, seleccionado.tipo_doc)}
              </p>
              {activosSeleccionado.length > 0 && (
                <p className="mt-2 text-xs text-amber-300">
                  Tiene alojamiento activo en: {activosSeleccionado.join(", ")}.
                </p>
              )}
            </div>
          )}

          {yaEnHogar && (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertTitle className="text-sm">Ya pertenece a este hogar</AlertTitle>
              <AlertDescription className="text-xs">
                Al guardar solo se actualizará parentesco o rol si cambió.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Fecha de ingreso al hogar</Label>
              <Input
                type="date"
                value={fechaIngreso}
                onChange={(e) => setFechaIngreso(e.target.value)}
                className="mt-1 h-9"
              />
            </div>
            <label className="flex items-center gap-2 self-end rounded-md border px-3 py-2">
              <Checkbox checked={esJefe} onCheckedChange={(v) => setEsJefe(Boolean(v))} />
              <span className="text-sm">Es jefe del hogar</span>
            </label>
            {!esJefe && (
              <div className="sm:col-span-2">
                <Label className="text-xs">Parentesco con el jefe *</Label>
                <Select value={parentesco || "none"} onValueChange={(v) => setParentesco(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder="Seleccionar parentesco…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seleccionar parentesco…</SelectItem>
                    {PARENTESCOS_JEFE.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" className="gap-2" disabled={guardando} onClick={() => void guardar()}>
            <Plus className="size-4" />
            {guardando ? "Guardando…" : "Agregar al hogar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-9" />
    </div>
  );
}
