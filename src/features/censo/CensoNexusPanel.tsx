// Censo por cédula vía Nexus: verificar → crear hogar → agregar familiares.
// Destino: base nominal (refugiados + familias_centro + alojamientos).

import { useEffect, useMemo, useState } from "react";
import {
  Baby,
  Check,
  Home,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  AlertTriangle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { buscarPersonaNexusConCache } from "@/data/reposNexus";
import {
  estadoNominalPorCedula,
  miembrosHogarActual,
  registrarMiembroSinDocumento,
  registrarPersonaNexusEnNominal,
  type EstadoNominalCedula,
} from "@/data/reposCensoNexus";
import { listarCentrosCenso } from "@/data/reposCenso";
import { asegurarSesionTerreno } from "@/data/loginTerreno";
import { inicialesPersona, type FamiliarNexus, type PersonaNexusCenso } from "@/domain/nexusPersona";
import {
  PARENTESCOS_JEFE,
  calcularEdad,
  formatearCedula,
  type SexoRefugiado,
} from "@/domain/refugiados";
import { cn } from "@/lib/utils";

type Letra = "V" | "E";

interface Props {
  centroId: string;
  centroNombre: string;
  tokenTerreno?: string | null;
  /** Permite volver a elegir campamento (solo sin token de terreno). */
  onCambiarCentro?: () => void;
}

interface MiembroHogar {
  refugiadoId: string;
  es_jefe: boolean;
  parentesco: string;
  nombre: string;
  cedula: string | null;
}

interface FormMenor {
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  sexo: SexoRefugiado | "";
  fecha_nacimiento: string;
  edad: string;
  parentesco: string;
}

function formMenorVacio(): FormMenor {
  return {
    primer_nombre: "",
    segundo_nombre: "",
    primer_apellido: "",
    segundo_apellido: "",
    sexo: "",
    fecha_nacimiento: "",
    edad: "",
    parentesco: "Hijo/a",
  };
}

/** Fecha de nacimiento aproximada (hoy menos N años) cuando solo se conoce la edad. */
function fechaAproximadaPorEdad(edad: number): string {
  const hoy = new Date();
  const y = hoy.getFullYear() - edad;
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

const soloDigitos = (c: string) => c.replace(/\D/g, "");

function fechaCorta(ts: number): string {
  return new Date(ts).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CensoNexusPanel({ centroId, centroNombre, tokenTerreno, onCambiarCentro }: Props) {
  const [sesionLista, setSesionLista] = useState(false);
  const [errorSesion, setErrorSesion] = useState("");

  const [letra, setLetra] = useState<Letra>("V");
  const [cedula, setCedula] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [persona, setPersona] = useState<PersonaNexusCenso | null>(null);
  const [estadoNominal, setEstadoNominal] = useState<EstadoNominalCedula | null>(null);
  // Procedencia de la ficha mostrada: caché propia (BD) o consulta viva a Nexus.
  const [origenFicha, setOrigenFicha] = useState<{
    desdeCache: boolean;
    consultadaTs: number | null;
  } | null>(null);

  // Teléfonos confirmados de palabra con la persona (un toque = verificado)
  // y teléfonos nuevos que el funcionario añade en el momento.
  const [telsConfirmados, setTelsConfirmados] = useState<string[]>([]);
  const [telsAgregados, setTelsAgregados] = useState<string[]>([]);
  const [telNuevo, setTelNuevo] = useState("");
  const [agregandoTel, setAgregandoTel] = useState(false);

  const [familiaId, setFamiliaId] = useState<string | null>(null);
  const [cedulaJefe, setCedulaJefe] = useState<string | null>(null);
  const [miembros, setMiembros] = useState<MiembroHogar[]>([]);

  // Familiares que Nexus sugirió para el jefe del hogar. Sobreviven a la
  // creación del hogar para poder marcarlos después de verificar al jefe.
  const [famSugeridos, setFamSugeridos] = useState<FamiliarNexus[]>([]);
  const [seleccionFam, setSeleccionFam] = useState<Record<string, boolean>>({});
  const [parentescoFam, setParentescoFam] = useState<Record<string, string>>({});
  const [parentescoDirecto, setParentescoDirecto] = useState("Otro familiar");

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [avisoOtros, setAvisoOtros] = useState<string[]>([]);

  // Nombres legibles de campamentos para los avisos (fallback: el id).
  const [nombresCentros, setNombresCentros] = useState<Record<string, string>>({});

  const [menorAbierto, setMenorAbierto] = useState(false);
  const [menor, setMenor] = useState<FormMenor>(formMenorVacio);
  const [errorMenor, setErrorMenor] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (tokenTerreno) {
          await asegurarSesionTerreno(tokenTerreno, centroId);
        }
        if (!cancel) {
          setSesionLista(true);
          setErrorSesion("");
        }
      } catch (e) {
        if (!cancel) {
          setErrorSesion(
            e instanceof Error
              ? e.message
              : "No se pudo abrir sesión de terreno. Use el QR del campamento o inicie sesión.",
          );
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [tokenTerreno, centroId]);

  useEffect(() => {
    if (!sesionLista) return;
    let cancel = false;
    listarCentrosCenso()
      .then((lista) => {
        if (cancel) return;
        setNombresCentros(Object.fromEntries(lista.map((c) => [c.id, c.nombre])));
      })
      .catch(() => {
        /* los avisos caen al id del campamento */
      });
    return () => {
      cancel = true;
    };
  }, [sesionLista]);

  const nombreCentro = (id: string) => nombresCentros[id] ?? id;

  async function refrescarMiembros(id: string) {
    const lista = await miembrosHogarActual(id);
    setMiembros(lista);
  }

  async function onBuscar(
    e?: React.FormEvent,
    opts?: { forzarNexus?: boolean; cedulaBuscar?: string; letraBuscar?: Letra },
  ) {
    e?.preventDefault();
    const cedulaBuscar = opts?.cedulaBuscar ?? cedula;
    const letraBuscar = opts?.letraBuscar ?? letra;
    setErrorBusqueda("");
    setMensaje("");
    setPersona(null);
    setEstadoNominal(null);
    setOrigenFicha(null);
    setAvisoOtros([]);
    setTelsConfirmados([]);
    setTelsAgregados([]);
    setTelNuevo("");
    setAgregandoTel(false);
    setBuscando(true);
    try {
      const [ficha, estado] = await Promise.all([
        buscarPersonaNexusConCache(letraBuscar, cedulaBuscar, {
          forzarNexus: opts?.forzarNexus,
        }),
        // El pre-chequeo nominal es informativo: si falla no bloquea la búsqueda.
        estadoNominalPorCedula(cedulaBuscar, letraBuscar, centroId).catch(() => null),
      ]);
      const p = ficha.persona;
      setPersona(p);
      setEstadoNominal(estado);
      setOrigenFicha({ desdeCache: ficha.desdeCache, consultadaTs: ficha.consultadaTs });
      if (!familiaId) {
        // Sin hogar activo: la persona buscada será el jefe; sus familiares
        // sugeridos se conservan para marcarlos tras crear el hogar.
        setFamSugeridos(p.familiares);
        const sel: Record<string, boolean> = {};
        const par: Record<string, string> = {};
        for (const f of p.familiares) {
          sel[f.cedula] = false;
          par[f.cedula] = f.parentesco || "Otro familiar";
        }
        setSeleccionFam(sel);
        setParentescoFam(par);
      } else {
        // Con hogar activo: si la persona estaba en la lista sugerida del
        // jefe, se preselecciona el parentesco que trajo Nexus.
        const sugerido = famSugeridos.find(
          (f) => soloDigitos(f.cedula) === soloDigitos(p.cedula),
        );
        setParentescoDirecto(sugerido?.parentesco || "Otro familiar");
      }
    } catch (err) {
      setErrorBusqueda(err instanceof Error ? err.message : "Error al consultar");
    } finally {
      setBuscando(false);
    }
  }

  async function onCrearHogar() {
    if (!persona) return;
    setGuardando(true);
    setMensaje("");
    setErrorBusqueda("");
    try {
      const r = await registrarPersonaNexusEnNominal({
        persona,
        centroId,
        esJefe: true,
        telefonosConfirmados: telsConfirmados,
      });
      setFamiliaId(r.familiaId);
      setCedulaJefe(persona.cedula);
      setAvisoOtros(r.otrosCentros);
      await refrescarMiembros(r.familiaId);
      setMensaje(
        r.yaEstabaEnCentro
          ? "Ya estaba en este campamento; se reanudó su hogar."
          : "Hogar creado. Continúe con los adultos del grupo familiar.",
      );
      setPersona(null);
      setEstadoNominal(null);
      setOrigenFicha(null);
      setCedula("");
    } catch (err) {
      setErrorBusqueda(err instanceof Error ? err.message : "No se pudo crear el hogar");
    } finally {
      setGuardando(false);
    }
  }

  async function onAgregarComoFamiliar() {
    if (!persona || !familiaId) return;
    setGuardando(true);
    setMensaje("");
    setErrorBusqueda("");
    try {
      const r = await registrarPersonaNexusEnNominal({
        persona,
        centroId,
        familiaId,
        esJefe: false,
        parentescoJefe: parentescoDirecto,
        telefonosConfirmados: telsConfirmados,
      });
      setAvisoOtros(r.otrosCentros);
      await refrescarMiembros(r.familiaId);
      setMensaje(`Agregado al hogar: ${persona.nombre_completo}`);
      setPersona(null);
      setEstadoNominal(null);
      setOrigenFicha(null);
      setCedula("");
    } catch (err) {
      setErrorBusqueda(err instanceof Error ? err.message : "No se pudo agregar");
    } finally {
      setGuardando(false);
    }
  }

  async function onAgregarFamiliaresMarcados() {
    if (!familiaId) return;
    const marcados = familiaresDisponibles.filter((f) => seleccionFam[f.cedula]);
    if (marcados.length === 0) {
      setErrorBusqueda("Marque al menos un familiar de la lista.");
      return;
    }
    setGuardando(true);
    setMensaje("");
    setErrorBusqueda("");
    try {
      let ok = 0;
      const fallos: string[] = [];
      for (const f of marcados) {
        try {
          const { persona: ficha } = await buscarPersonaNexusConCache(
            (f.letra === "E" ? "E" : "V") as Letra,
            f.cedula,
          );
          await registrarPersonaNexusEnNominal({
            persona: ficha,
            centroId,
            familiaId,
            esJefe: false,
            parentescoJefe: parentescoFam[f.cedula] || f.parentesco || "Otro familiar",
          });
          ok += 1;
        } catch (e) {
          fallos.push(
            `${f.nombre || f.cedula}: ${e instanceof Error ? e.message : "error"}`,
          );
        }
      }
      await refrescarMiembros(familiaId);
      setMensaje(
        ok
          ? `Se agregaron ${ok} familiar(es) al hogar.`
          : "No se pudo agregar ninguno.",
      );
      if (fallos.length) setErrorBusqueda(fallos.join(" · "));
      setSeleccionFam((prev) => {
        const n = { ...prev };
        for (const f of marcados) n[f.cedula] = false;
        return n;
      });
    } catch (err) {
      setErrorBusqueda(err instanceof Error ? err.message : "No se pudieron agregar");
    } finally {
      setGuardando(false);
    }
  }

  async function onAgregarMenor(e: React.FormEvent) {
    e.preventDefault();
    if (!familiaId) return;
    if (!menor.primer_nombre.trim() || !menor.primer_apellido.trim()) {
      setErrorMenor("Indique al menos primer nombre y primer apellido.");
      return;
    }
    if (!menor.sexo) {
      setErrorMenor("Indique el sexo.");
      return;
    }
    const edadNum = menor.edad === "" ? null : Number(menor.edad);
    if (!menor.fecha_nacimiento && edadNum == null) {
      setErrorMenor("Indique la fecha de nacimiento o al menos la edad aproximada.");
      return;
    }
    setErrorMenor("");
    setGuardando(true);
    setMensaje("");
    try {
      await registrarMiembroSinDocumento({
        centroId,
        familiaId,
        primer_nombre: menor.primer_nombre,
        segundo_nombre: menor.segundo_nombre,
        primer_apellido: menor.primer_apellido,
        segundo_apellido: menor.segundo_apellido,
        sexo: menor.sexo || null,
        fecha_nacimiento:
          menor.fecha_nacimiento ||
          (edadNum != null ? fechaAproximadaPorEdad(Math.max(0, edadNum)) : null),
        parentescoJefe: menor.parentesco,
      });
      await refrescarMiembros(familiaId);
      setMensaje(
        `Agregado al hogar sin documento: ${menor.primer_nombre} ${menor.primer_apellido}`,
      );
      setMenor(formMenorVacio());
    } catch (err) {
      setErrorMenor(err instanceof Error ? err.message : "No se pudo agregar");
    } finally {
      setGuardando(false);
    }
  }

  function cerrarHogar() {
    setFamiliaId(null);
    setCedulaJefe(null);
    setMiembros([]);
    setFamSugeridos([]);
    setSeleccionFam({});
    setParentescoFam({});
    setPersona(null);
    setEstadoNominal(null);
    setOrigenFicha(null);
    setAvisoOtros([]);
    setTelsConfirmados([]);
    setTelsAgregados([]);
    setTelNuevo("");
    setAgregandoTel(false);
    setCedula("");
    setMenorAbierto(false);
    setMenor(formMenorVacio());
    setErrorMenor("");
    setMensaje("Hogar cerrado. Puede iniciar otro con la cédula del siguiente jefe.");
  }

  function toggleTelefono(t: string) {
    setTelsConfirmados((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function agregarTelefono() {
    const t = telNuevo.trim();
    if (t.replace(/\D/g, "").length < 7) return;
    setTelsAgregados((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setTelsConfirmados((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setTelNuevo("");
    setAgregandoTel(false);
  }

  /** Consulta la ficha de un familiar con un toque (usa la caché). */
  function verFamiliar(f: FamiliarNexus) {
    const l: Letra = f.letra === "E" ? "E" : "V";
    setLetra(l);
    setCedula(soloDigitos(f.cedula));
    void onBuscar(undefined, { cedulaBuscar: f.cedula, letraBuscar: l });
  }

  const hayHogar = Boolean(familiaId);

  const cedulasMiembros = useMemo(
    () => new Set(miembros.map((m) => soloDigitos(m.cedula || ""))),
    [miembros],
  );

  const familiaresDisponibles = useMemo(
    () => famSugeridos.filter((f) => !cedulasMiembros.has(soloDigitos(f.cedula))),
    [famSugeridos, cedulasMiembros],
  );

  const personaYaEnHogar = Boolean(
    persona && hayHogar && cedulasMiembros.has(soloDigitos(persona.cedula)),
  );

  const jefeHogar = useMemo(() => miembros.find((m) => m.es_jefe) ?? null, [miembros]);

  if (errorSesion) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Sesión requerida</CardTitle>
          <CardDescription>{errorSesion}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!sesionLista) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="size-4 animate-spin" /> Preparando sesión…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Campamento destino: siempre visible para que no haya dudas de dónde
          queda registrado el hogar. */}
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-card px-3 py-2.5 shadow-lg">
        <MapPin className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Registrando en
          </p>
          <p className="truncate text-sm font-semibold">{centroNombre}</p>
        </div>
        {onCambiarCentro && !tokenTerreno ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onCambiarCentro}
          >
            Cambiar
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {hayHogar ? <Home className="size-4" /> : <ShieldCheck className="size-4" />}
            {hayHogar ? "Hogar en registro" : "Censo por cédula"}
          </CardTitle>
          {!hayHogar ? (
            <CardDescription>
              Digite la cédula, verifique la identidad y registre el hogar.
              <span className="block mt-1">Empiece por el jefe de familia.</span>
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {hayHogar ? (
            <>
              {/* Jefe del hogar activo: la referencia de todo lo que sigue. */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
                <Home className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Jefe/a de familia
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {jefeHogar?.nombre || "—"}
                    <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                      {cedulaJefe ? formatearCedula(cedulaJefe, "V") : ""}
                    </span>
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {miembros.length} {miembros.length === 1 ? "miembro" : "miembros"}
                </Badge>
              </div>
              {/* Orden recomendado del levantamiento. */}
              <ol className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <Check className="size-3.5 mt-px shrink-0 text-emerald-600" />
                  <span>Jefe/a verificado y registrado.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-semibold text-foreground shrink-0">2.</span>
                  <span>
                    Agregue ahora a los <span className="font-medium text-foreground">adultos</span>{" "}
                    (cónyuge, padres, hermanos): digite su cédula abajo o marque
                    los familiares detectados.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-semibold text-foreground shrink-0">3.</span>
                  <span>
                    De último los <span className="font-medium text-foreground">menores</span>: con
                    cédula búsquelos igual; sin cédula use «Agregar menor» en la
                    tarjeta del hogar.
                  </span>
                </li>
              </ol>
            </>
          ) : null}
          <form onSubmit={onBuscar} className="flex flex-wrap gap-2 items-end">
            <div className="w-20">
              <Label className="text-xs">Tipo</Label>
              <Select value={letra} onValueChange={(v) => setLetra(v as Letra)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="V">V-</SelectItem>
                  <SelectItem value="E">E-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[10rem]">
              <Label className="text-xs">
                {hayHogar ? "Cédula del siguiente familiar" : "Cédula"}
              </Label>
              <Input
                inputMode="numeric"
                autoComplete="off"
                placeholder="17089732"
                value={cedula}
                onChange={(e) => setCedula(soloDigitos(e.target.value))}
                className="font-mono text-lg tracking-wide"
              />
            </div>
            <Button type="submit" disabled={buscando || cedula.length < 5}>
              {buscando ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Buscar
            </Button>
          </form>
          {errorBusqueda ? (
            <p className="text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              {errorBusqueda}
            </p>
          ) : null}
          {mensaje ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
              <Check className="size-4 mt-0.5 shrink-0" />
              {mensaje}
            </p>
          ) : null}
          {avisoOtros.length > 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Atención: esta persona también figura activa en otro(s) campamento(s):{" "}
              {avisoOtros.map(nombreCentro).join(", ")}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {persona ? (
        <Card className="overflow-hidden">
          <CardContent className="pt-5 space-y-4">
            {persona.fallecido ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold">
                    Esta cédula figura FALLECIDA
                    {persona.fecha_fallecimiento
                      ? ` (${persona.fecha_fallecimiento})`
                      : ""}{" "}
                    en el registro.
                  </span>{" "}
                  No corresponde a una persona viva: verifique con máximo
                  cuidado antes de registrar.
                </span>
              </div>
            ) : null}
            <div className="flex gap-4 items-start">
              <Avatar size="lg" className="size-16 rounded-xl after:rounded-xl">
                <AvatarFallback className="rounded-xl text-lg font-semibold">
                  {inicialesPersona(persona)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-lg leading-tight">{persona.nombre_completo}</p>
                <p className="font-mono text-sm text-muted-foreground">
                  {formatearCedula(persona.cedula, persona.letra === "E" ? "E" : "V")}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {persona.sexo ? <Badge variant="secondary">{persona.sexo}</Badge> : null}
                  {persona.edad != null ? <Badge variant="secondary">{persona.edad} años</Badge> : null}
                  {persona.fecha_nacimiento ? (
                    <Badge variant="outline">Nac. {persona.fecha_nacimiento}</Badge>
                  ) : null}
                  {persona.estado_civil ? (
                    <Badge variant="outline">{persona.estado_civil}</Badge>
                  ) : null}
                  {persona.tiene_foto_saime ? (
                    <Badge variant="outline" className="gap-1">
                      <ShieldCheck className="size-3" /> SAIME
                    </Badge>
                  ) : (
                    <Badge variant="outline">Sin foto en respuesta</Badge>
                  )}
                  {estadoNominal?.enEsteCentro ? (
                    <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-transparent">
                      {estadoNominal.esJefeAqui
                        ? "Jefe de hogar en este campamento"
                        : "Ya registrado en este campamento"}
                    </Badge>
                  ) : null}
                </div>
                {estadoNominal && estadoNominal.otrosCentros.length > 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400 pt-1">
                    Figura activa en: {estadoNominal.otrosCentros.map(nombreCentro).join(", ")}.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Procedencia: clave para detectar a quien no viene de la zona
                afectada (indigencia, oportunismo). Verificar de palabra. */}
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                Dirección registrada — verifique la procedencia
              </p>
              {persona.ubicacion_fiscal &&
              (persona.ubicacion_fiscal.estado ||
                persona.ubicacion_fiscal.municipio ||
                persona.ubicacion_fiscal.parroquia) ? (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    persona.ubicacion_fiscal.estado,
                    persona.ubicacion_fiscal.municipio,
                    persona.ubicacion_fiscal.parroquia,
                  ]
                    .filter(Boolean)
                    .map((u) => (
                      <Badge key={u} variant="secondary" className="text-xs">
                        {u}
                      </Badge>
                    ))}
                </div>
              ) : null}
              {persona.direccion_fiscal ? (
                <p className="text-sm leading-snug">{persona.direccion_fiscal}</p>
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Sin dirección en el sistema. Pregunte de dónde viene y de ser
                  posible pida un comprobante o testigo del sector.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Pida a la persona que diga su dirección ANTES de leerle esta, y
                confirme que corresponde a una zona afectada por la tragedia.
              </p>
            </div>

            {/* Teléfonos: un toque marca el número como confirmado con la
                persona; el confirmado queda como principal de su ficha. */}
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Teléfonos — toque para marcar confirmado
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {[...(persona.telefonos ?? []), ...telsAgregados].map((t) => {
                  const confirmado = telsConfirmados.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTelefono(t)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm transition-colors",
                        confirmado
                          ? "border-emerald-600/50 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {confirmado ? <Check className="size-3.5" /> : null}
                      {t}
                    </button>
                  );
                })}
                {agregandoTel ? (
                  <span className="inline-flex items-center gap-1">
                    <Input
                      autoFocus
                      type="tel"
                      inputMode="tel"
                      value={telNuevo}
                      onChange={(e) => setTelNuevo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          agregarTelefono();
                        }
                      }}
                      placeholder="0412-0000000"
                      className="h-9 w-36 font-mono text-sm"
                    />
                    <Button type="button" size="sm" className="h-9" onClick={agregarTelefono}>
                      <Check className="size-4" />
                    </Button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAgregandoTel(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    + Añadir
                  </button>
                )}
              </div>
              {telsConfirmados.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Pregunte «¿cuál es su teléfono?» y confirme el que coincida.
                </p>
              ) : null}
            </div>

            {/* Familiares según el registro: contrastar con lo que la persona
                declara (p. ej. familiares fallecidos hace años). */}
            {persona.familiares.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  Familiares según el registro
                </p>
                <ul className="space-y-1">
                  {persona.familiares.map((f) => {
                    const edadFam = calcularEdad(f.fecha_nacimiento);
                    return (
                      <li
                        key={f.cedula}
                        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-2.5 py-1.5 text-sm"
                      >
                        <span className="font-medium">{f.nombre || "—"}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatearCedula(f.cedula, f.letra === "E" ? "E" : "V")}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {f.parentesco || "Familiar"}
                        </Badge>
                        {f.fecha_nacimiento ? (
                          <span className="text-xs text-muted-foreground">
                            Nac. {f.fecha_nacimiento}
                            {edadFam != null ? ` · ${edadFam} años` : ""}
                          </span>
                        ) : null}
                        {f.fallecido ? (
                          <Badge className="bg-destructive/15 text-destructive border-transparent text-xs">
                            Falleció{f.fecha_fallecimiento ? ` ${f.fecha_fallecimiento}` : ""}
                          </Badge>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-7 px-2 text-xs"
                          disabled={buscando || guardando}
                          onClick={() => verFamiliar(f)}
                        >
                          <Search className="size-3.5" />
                          Ver
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  Pregunte por el grupo familiar y contraste con esta lista.
                </p>
              </div>
            ) : null}

            {origenFicha ? (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {origenFicha.desdeCache
                    ? `Consulta guardada${origenFicha.consultadaTs ? ` del ${fechaCorta(origenFicha.consultadaTs)}` : ""} (sin ir a Nexus).`
                    : "Consulta en vivo a Nexus, guardada para la próxima."}
                </span>
                {origenFicha.desdeCache ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-xs"
                    disabled={buscando}
                    onClick={() =>
                      onBuscar(undefined, {
                        forzarNexus: true,
                        cedulaBuscar: persona.cedula,
                        letraBuscar: persona.letra === "E" ? "E" : "V",
                      })
                    }
                  >
                    <RefreshCw className="size-3.5" />
                    Reconsultar
                  </Button>
                ) : null}
              </div>
            ) : null}

            <Separator />

            {!hayHogar ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button className="flex-1" disabled={guardando} onClick={onCrearHogar}>
                  {guardando ? <Loader2 className="size-4 animate-spin" /> : <Home className="size-4" />}
                  {estadoNominal?.esJefeAqui
                    ? "Verificar y reanudar su hogar"
                    : "Verificar y crear hogar"}
                </Button>
              </div>
            ) : personaYaEnHogar ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Check className="size-4 text-emerald-600" />
                Esta persona ya es miembro del hogar actual.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={parentescoDirecto} onValueChange={setParentescoDirecto}>
                  <SelectTrigger className="sm:w-[11rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARENTESCOS_JEFE.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="flex-1" disabled={guardando} onClick={onAgregarComoFamiliar}>
                  {guardando ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  Agregar al hogar como {parentescoDirecto}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {hayHogar && familiaresDisponibles.length > 0 ? (
        <Card>
          <CardContent className="pt-5 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Users className="size-4" />
              Familiares detectados del jefe — ¿quiénes están en el campamento?
            </p>
            <ul className="space-y-2">
              {familiaresDisponibles.map((f) => (
                <li
                  key={f.cedula}
                  className={cn(
                    "flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5",
                    seleccionFam[f.cedula] ? "bg-muted/60" : "",
                  )}
                >
                  <Checkbox
                    checked={Boolean(seleccionFam[f.cedula])}
                    onCheckedChange={(v) =>
                      setSeleccionFam((s) => ({ ...s, [f.cedula]: Boolean(v) }))
                    }
                    id={`fam-${f.cedula}`}
                  />
                  <label htmlFor={`fam-${f.cedula}`} className="flex-1 text-sm cursor-pointer min-w-[8rem]">
                    <span className="font-medium">{f.nombre || "—"}</span>
                    <span className="text-muted-foreground font-mono text-xs ml-2">
                      {formatearCedula(f.cedula, f.letra === "E" ? "E" : "V")}
                    </span>
                  </label>
                  <Select
                    value={parentescoFam[f.cedula] || f.parentesco || "Otro familiar"}
                    onValueChange={(v) =>
                      setParentescoFam((p) => ({ ...p, [f.cedula]: v }))
                    }
                  >
                    <SelectTrigger className="w-[9.5rem] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PARENTESCOS_JEFE.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              disabled={guardando || !familiaresDisponibles.some((f) => seleccionFam[f.cedula])}
              onClick={onAgregarFamiliaresMarcados}
            >
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Agregar marcados al hogar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {hayHogar ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="size-4" />
              Hogar actual
            </CardTitle>
            <CardDescription>
              Identificado por cédula del jefe {cedulaJefe ? formatearCedula(cedulaJefe, "V") : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5">
              {miembros.map((m) => (
                <li key={m.refugiadoId} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{m.nombre}</span>
                    {m.cedula ? (
                      <span className="text-muted-foreground font-mono text-xs ml-2">
                        {formatearCedula(m.cedula, "V")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs ml-2">sin documento</span>
                    )}
                  </span>
                  <Badge variant={m.es_jefe ? "default" : "secondary"}>
                    {m.es_jefe ? "Jefe/a" : m.parentesco || "Familiar"}
                  </Badge>
                </li>
              ))}
            </ul>

            {!menorAbierto ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setMenorAbierto(true)}
              >
                <Baby className="size-4" />
                Agregar menor u otra persona sin cédula
              </Button>
            ) : (
              <form
                onSubmit={onAgregarMenor}
                className="space-y-3 rounded-lg border border-sky-500/40 bg-sky-500/5 p-3"
              >
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Baby className="size-4" />
                    Persona sin documento (menores, sin cédula a mano)
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Queda registrada en este hogar sin verificación SAIME. Si luego
                    aparece la cédula, se puede completar desde la ficha.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="menor-pn" className="text-xs">Primer nombre</Label>
                    <Input
                      id="menor-pn"
                      value={menor.primer_nombre}
                      onChange={(e) => setMenor((m) => ({ ...m, primer_nombre: e.target.value }))}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="menor-sn" className="text-xs text-muted-foreground">
                      Segundo nombre
                    </Label>
                    <Input
                      id="menor-sn"
                      value={menor.segundo_nombre}
                      onChange={(e) => setMenor((m) => ({ ...m, segundo_nombre: e.target.value }))}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="menor-pa" className="text-xs">Primer apellido</Label>
                    <Input
                      id="menor-pa"
                      value={menor.primer_apellido}
                      onChange={(e) => setMenor((m) => ({ ...m, primer_apellido: e.target.value }))}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="menor-sa" className="text-xs text-muted-foreground">
                      Segundo apellido
                    </Label>
                    <Input
                      id="menor-sa"
                      value={menor.segundo_apellido}
                      onChange={(e) => setMenor((m) => ({ ...m, segundo_apellido: e.target.value }))}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Sexo</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["M", "F"] as const).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          size="sm"
                          variant={menor.sexo === s ? "default" : "outline"}
                          onClick={() => setMenor((m) => ({ ...m, sexo: s }))}
                        >
                          {s === "M" ? "Masc." : "Fem."}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Parentesco con el jefe</Label>
                    <Select
                      value={menor.parentesco}
                      onValueChange={(v) => setMenor((m) => ({ ...m, parentesco: v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PARENTESCOS_JEFE.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="menor-fnac" className="text-xs">Fecha de nacimiento</Label>
                    <Input
                      id="menor-fnac"
                      type="date"
                      value={menor.fecha_nacimiento}
                      onChange={(e) =>
                        setMenor((m) => ({ ...m, fecha_nacimiento: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="menor-edad" className="text-xs">
                      Edad (si no hay fecha)
                    </Label>
                    <Input
                      id="menor-edad"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={120}
                      value={menor.edad}
                      onChange={(e) => setMenor((m) => ({ ...m, edad: e.target.value }))}
                      placeholder="Aproximada"
                    />
                  </div>
                </div>
                {errorMenor ? (
                  <p className="text-xs text-destructive">{errorMenor}</p>
                ) : null}
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={guardando}>
                    {guardando ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                    Agregar al hogar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setMenorAbierto(false);
                      setMenor(formMenorVacio());
                      setErrorMenor("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}

            <Button type="button" variant="outline" onClick={cerrarHogar}>
              Cerrar hogar e iniciar otro
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
