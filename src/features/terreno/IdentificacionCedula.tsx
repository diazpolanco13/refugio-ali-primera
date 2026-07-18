// Identificación del operador de terreno por CÉDULA (Fase A del plan de
// identidad, docs/plan-identidad-terreno.md). Sustituye al formulario de 4
// campos self-declarados: la cédula se verifica contra Nexus (o contra
// nuestros perfiles si ya se identificó antes) y la unidad e institución
// salen solas del campamento; el único campo manual es la jerarquía.
//
// Orden de la UI (contexto del centro primero, identidad después):
//   1. Campamento + institución responsable + revista SEBIN (solo lectura)
//   2. Buscador de cédula
//   3. Tras verificar: nombre + jerarquía / cargo

import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  IdCard,
  Loader2,
  MapPin,
  Shield,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RequiereNombreManualError,
  consultarIdentidadTerreno,
  entrarPorCedula,
  type ConsultaIdentidadTerreno,
  type LetraCedulaTerreno,
  type SesionCedulaResultado,
} from "@/data/loginTerreno";
import { CATALOGO_JERARQUIAS, jerarquiaCanonica } from "@/domain/jerarquiasSebin";
import { cn } from "@/lib/utils";

interface Props {
  token: string;
  centroNombre: string;
  /** Cuerpo asignado al campamento (institución responsable del centro). */
  centroCuerpo: string;
  /** Unidad SEBIN de revista diaria del campamento. */
  centroUnidad: string;
  onIdentificado: (
    resultado: SesionCedulaResultado & {
      cedula: string;
      letra: LetraCedulaTerreno;
      jerarquia: string;
      institucion: string;
    },
  ) => void;
}

type Paso = "cedula" | "confirmar";

/** Bloque de contexto del campamento (no es dato del operador). */
function ContextoCampamento({
  nombre,
  cuerpo,
  unidad,
}: {
  nombre: string;
  cuerpo: string;
  unidad: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
        <MapPin className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Campamento
          </p>
          <p className="truncate text-sm font-medium">{nombre}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
        <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Institución responsable del centro
          </p>
          <p className="truncate text-sm font-medium">{cuerpo || "—"}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Organismo a cargo de este campamento. No indica a qué institución
            pertenece usted.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
        <Shield className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Revista diaria del SEBIN
          </p>
          <p className="truncate text-sm font-medium">{unidad || "—"}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Unidad interna SEBIN que pasa revista a este campamento.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Identificación por cédula: verificar → confirmar → entrar. */
export function IdentificacionCedula({
  token,
  centroNombre,
  centroCuerpo,
  centroUnidad,
  onIdentificado,
}: Props) {
  const [paso, setPaso] = useState<Paso>("cedula");
  const [letra, setLetra] = useState<LetraCedulaTerreno>("V");
  const [cedula, setCedula] = useState("");
  const [consulta, setConsulta] = useState<ConsultaIdentidadTerreno | null>(null);
  const [jerarquia, setJerarquia] = useState("");
  const [nombreManual, setNombreManual] = useState("");
  const [pideNombreManual, setPideNombreManual] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const digits = cedula.replace(/\D/g, "");
  const cedulaValida = digits.length >= 5 && digits.length <= 12;

  async function verificarCedula() {
    if (!cedulaValida || cargando) return;
    setCargando(true);
    setError("");
    try {
      const resultado = await consultarIdentidadTerreno(token, digits, letra);
      setConsulta(resultado);
      if (resultado.tipo === "no_encontrada") {
        setError(
          "No se encontró esa cédula en el registro. Revise el número e intente de nuevo.",
        );
        return;
      }
      setJerarquia(
        resultado.tipo === "perfil" ? (jerarquiaCanonica(resultado.jerarquia) ?? "") : "",
      );
      setPideNombreManual(resultado.tipo === "no_disponible");
      setNombreManual("");
      setPaso("confirmar");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo verificar la cédula. Intente de nuevo.",
      );
    } finally {
      setCargando(false);
    }
  }

  async function entrar() {
    if (!consulta || !jerarquia || cargando) return;
    if (pideNombreManual && nombreManual.trim().length < 7) {
      setError("Escriba el nombre y apellido completos.");
      return;
    }
    setCargando(true);
    setError("");
    try {
      const resultado = await entrarPorCedula(token, {
        cedula: digits,
        letra,
        jerarquia,
        ...(pideNombreManual ? { nombre_manual: nombreManual.trim() } : {}),
      });
      onIdentificado({
        ...resultado,
        cedula: digits,
        letra,
        jerarquia,
        // No es la institución del funcionario: el cuerpo del campamento
        // vive en el contexto del centro (ContextoCampamento). Vacío a
        // propósito para no confundirlo con afiliación personal.
        institucion: "",
      });
    } catch (err) {
      if (err instanceof RequiereNombreManualError) {
        setPideNombreManual(true);
        setError("Nexus no está disponible: indique el nombre completo para continuar.");
      } else {
        setError(
          err instanceof Error ? err.message : "No se pudo registrar su acceso. Intente de nuevo.",
        );
      }
    } finally {
      setCargando(false);
    }
  }

  function corregirCedula() {
    setPaso("cedula");
    setConsulta(null);
    setError("");
    setPideNombreManual(false);
  }

  const nombreConocido =
    consulta && (consulta.tipo === "perfil" || consulta.tipo === "nexus")
      ? consulta.nombre
      : null;

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <IdCard className="size-4 text-primary" />
          Identifíquese con su cédula
        </CardTitle>
        <CardDescription>
          Su cédula lo identifica una sola vez para siempre, en cualquier campamento y
          desde cualquier teléfono.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4">
          <ContextoCampamento
            nombre={centroNombre}
            cuerpo={centroCuerpo || consulta?.centro.cuerpo || ""}
            unidad={centroUnidad || consulta?.centro.unidad || ""}
          />

          {paso === "cedula" && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void verificarCedula();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="id-cedula">Cédula de identidad</Label>
                <div className="flex gap-2">
                  <Select
                    value={letra}
                    onValueChange={(v) => setLetra(v === "E" ? "E" : "V")}
                    disabled={cargando}
                  >
                    <SelectTrigger className="h-11 w-20 shrink-0" aria-label="Nacionalidad">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="V">V</SelectItem>
                      <SelectItem value="E">E</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="id-cedula"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    enterKeyHint="go"
                    placeholder="12345678"
                    value={cedula}
                    disabled={cargando}
                    onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
                    className="h-11 flex-1 text-base tracking-wide"
                  />
                </div>
                <p className="text-xs leading-snug text-muted-foreground">
                  Se verifica contra el registro de identidad. No necesita usuario ni
                  contraseña.
                </p>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button
                type="submit"
                className="h-11 w-full"
                disabled={!cedulaValida || cargando}
              >
                {cargando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Verificando…
                  </>
                ) : (
                  <>
                    Verificar cédula
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {paso === "confirmar" && consulta && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void entrar();
              }}
            >
              {nombreConocido ? (
                <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3">
                  <div className="flex items-start gap-3">
                    <UserRound className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {letra}-{digits}
                      </p>
                      <p className="text-base font-semibold leading-snug">{nombreConocido}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        {consulta.tipo === "perfil" ? (
                          <>
                            <BadgeCheck className="size-3.5 text-primary" />
                            Ya identificado antes en la red
                          </>
                        ) : (
                          <>
                            <BadgeCheck className="size-3.5 text-primary" />
                            Verificado en el registro de identidad
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-medium">¿Es usted esta persona?</p>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-3">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs leading-snug">
                      El registro de identidad no está disponible ahora. Puede continuar
                      escribiendo su nombre; quedará marcado{" "}
                      <span className="font-medium">sin verificar</span> hasta que un
                      analista lo revise.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="id-nombre-manual">Nombre y apellido</Label>
                    <Input
                      id="id-nombre-manual"
                      value={nombreManual}
                      disabled={cargando}
                      onChange={(e) => setNombreManual(e.target.value)}
                      placeholder="Nombre completo"
                      className="h-11"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="id-jerarquia">Jerarquía / cargo</Label>
                <Select value={jerarquia} onValueChange={setJerarquia} disabled={cargando}>
                  <SelectTrigger
                    id="id-jerarquia"
                    className="!h-11 w-full border-2 border-primary/40 bg-muted/40 px-3 text-sm font-medium shadow-sm data-[placeholder]:text-muted-foreground [&_svg]:size-5 [&_svg]:text-primary"
                  >
                    <SelectValue placeholder="Toque para elegir su jerarquía" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATALOGO_JERARQUIAS.map((g) => (
                      <SelectGroup key={g.grupo}>
                        <SelectLabel>{g.grupo}</SelectLabel>
                        {g.jerarquias.map((j) => (
                          <SelectItem key={j} value={j}>
                            {j}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={cargando || !jerarquia || (pideNombreManual && nombreManual.trim().length < 7)}
                >
                  {cargando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Entrando…
                    </>
                  ) : (
                    <>
                      {nombreConocido ? "Sí, soy yo — Entrar" : "Continuar sin verificar"}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-10 w-full")}
                  disabled={cargando}
                  onClick={corregirCedula}
                >
                  No — corregir cédula
                </Button>
              </div>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
