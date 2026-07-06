import { useMemo, useRef } from "react";
import { Check, Loader2, MapPin, UserPlus } from "lucide-react";
import { SelectoresGeo } from "@/components/SelectoresGeo";
import { Button } from "@/components/ui/button";
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
import { CONDICIONES_VIVIENDA, type RegistroCenso } from "@/data/reposCenso";
import { cn } from "@/lib/utils";
import {
  AvisoCamposFaltantes,
  CEDULA_JEFE_NO_SE,
  CampoSiNo,
  GrupoOpcionesSegmentadas,
  LabelCampoCenso,
  PARENTESCOS_MENOR,
  SEXOS,
  TIPOS_DOC,
  camposFaltantesRegistro,
  claseGrupoFaltante,
  claseInputFaltante,
  esCampoFaltante,
  registroCensoCompleto,
} from "./censoFormularioShared";

interface Props {
  registro: RegistroCenso;
  onChange: (parcial: Partial<RegistroCenso>) => void;
  onSubmit: (e: React.FormEvent) => void;
  mostrarFaltantes: boolean;
  editando?: boolean;
  guardando?: boolean;
  errorGuardar?: string;
  idPrefix?: string;
  autoFocus?: boolean;
  pieExtra?: React.ReactNode;
}

export function FormularioRegistroCenso({
  registro,
  onChange,
  onSubmit,
  mostrarFaltantes,
  editando = false,
  guardando = false,
  errorGuardar,
  idPrefix = "censo",
  autoFocus = false,
  pieExtra,
}: Props) {
  const refPrimerNombre = useRef<HTMLInputElement>(null);
  const esMenor = registro.edad != null && registro.edad < 18;
  const conoceCedulaJefe = registro.jefe_documento !== CEDULA_JEFE_NO_SE;
  const faltantes = useMemo(
    () => camposFaltantesRegistro(registro, esMenor, conoceCedulaJefe),
    [registro, esMenor, conoceCedulaJefe],
  );
  const completo = registroCensoCompleto(registro);

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <LabelCampoCenso
            htmlFor={`${idPrefix}-pn`}
            resaltar={mostrarFaltantes && esCampoFaltante("primer_nombre", faltantes)}
          >
            Primer nombre
          </LabelCampoCenso>
          <Input
            id={`${idPrefix}-pn`}
            ref={autoFocus ? refPrimerNombre : undefined}
            value={registro.primer_nombre}
            onChange={(e) => onChange({ primer_nombre: e.target.value })}
            className={cn(
              "h-11",
              mostrarFaltantes &&
                esCampoFaltante("primer_nombre", faltantes) &&
                claseInputFaltante,
            )}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-sn`} className="text-muted-foreground">
            Segundo nombre
          </Label>
          <Input
            id={`${idPrefix}-sn`}
            value={registro.segundo_nombre}
            onChange={(e) => onChange({ segundo_nombre: e.target.value })}
            className="h-11"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <LabelCampoCenso
            htmlFor={`${idPrefix}-pa`}
            resaltar={mostrarFaltantes && esCampoFaltante("primer_apellido", faltantes)}
          >
            Primer apellido
          </LabelCampoCenso>
          <Input
            id={`${idPrefix}-pa`}
            value={registro.primer_apellido}
            onChange={(e) => onChange({ primer_apellido: e.target.value })}
            className={cn(
              "h-11",
              mostrarFaltantes &&
                esCampoFaltante("primer_apellido", faltantes) &&
                claseInputFaltante,
            )}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-sa`} className="text-muted-foreground">
            Segundo apellido
          </Label>
          <Input
            id={`${idPrefix}-sa`}
            value={registro.segundo_apellido}
            onChange={(e) => onChange({ segundo_apellido: e.target.value })}
            className="h-11"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Documento de identificación</Label>
        <div className="flex gap-2">
          <div className="flex overflow-hidden rounded-lg border">
            {TIPOS_DOC.map((t, i) => (
              <button
                key={t.valor}
                type="button"
                className={cn(
                  "h-11 px-3 text-sm font-semibold transition-colors",
                  i > 0 && "border-l",
                  registro.tipo_doc === t.valor
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted",
                )}
                onClick={() => onChange({ tipo_doc: t.valor })}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Input
            aria-label="Número de documento"
            inputMode={registro.tipo_doc === "P" ? "text" : "numeric"}
            value={registro.documento}
            onChange={(e) => onChange({ documento: e.target.value })}
            placeholder={registro.tipo_doc === "P" ? "N.º de pasaporte" : "N.º de cédula"}
            className="h-11 flex-1"
            autoComplete="off"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Deje el número vacío si la persona no posee documento.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <LabelCampoCenso
            htmlFor={`${idPrefix}-edad`}
            resaltar={mostrarFaltantes && esCampoFaltante("edad", faltantes)}
          >
            Edad
          </LabelCampoCenso>
          <Input
            id={`${idPrefix}-edad`}
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={registro.edad != null ? String(registro.edad) : ""}
            onChange={(e) =>
              onChange({
                edad: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
              })
            }
            className={cn(
              "h-11",
              mostrarFaltantes && esCampoFaltante("edad", faltantes) && claseInputFaltante,
            )}
          />
        </div>
        <div className="space-y-1.5">
          <LabelCampoCenso resaltar={mostrarFaltantes && esCampoFaltante("sexo", faltantes)}>
            Sexo
          </LabelCampoCenso>
          <div
            className={cn(
              "grid grid-cols-2 gap-2",
              mostrarFaltantes && esCampoFaltante("sexo", faltantes) && claseGrupoFaltante,
            )}
          >
            {SEXOS.map((s) => (
              <Button
                key={s.valor}
                type="button"
                variant={registro.sexo === s.valor ? "default" : "outline"}
                className="h-11 px-2 text-sm"
                onClick={() =>
                  onChange({
                    sexo: s.valor,
                    embarazada: s.valor === "F" ? registro.embarazada : false,
                    embarazo_semanas: s.valor === "F" ? registro.embarazo_semanas : null,
                  })
                }
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {esMenor && (
        <div className="space-y-3 rounded-lg border border-sky-500/40 bg-sky-500/5 p-3">
          <div>
            <p className="text-sm font-medium">Menor de edad — jefe de familia</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Indique el parentesco. La cédula del jefe es opcional (marque «No se conoce» si es
              huérfano o no la tiene).
            </p>
          </div>
          <div className="space-y-1.5">
            <LabelCampoCenso
              resaltar={mostrarFaltantes && esCampoFaltante("parentesco_jefe", faltantes)}
            >
              Parentesco con el jefe de familia
            </LabelCampoCenso>
            <Select
              value={registro.parentesco_jefe || undefined}
              onValueChange={(v) => onChange({ parentesco_jefe: v })}
            >
              <SelectTrigger
                className={cn(
                  "h-11 w-full",
                  mostrarFaltantes &&
                    esCampoFaltante("parentesco_jefe", faltantes) &&
                    claseInputFaltante,
                )}
              >
                <SelectValue placeholder="Seleccionar parentesco…" />
              </SelectTrigger>
              <SelectContent>
                {PARENTESCOS_MENOR.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CampoSiNo
            label="¿Se conoce la cédula del jefe de familia?"
            valor={conoceCedulaJefe}
            onChange={(conoce) =>
              onChange({
                jefe_documento: conoce ? "" : CEDULA_JEFE_NO_SE,
              })
            }
          >
            <div className="space-y-1.5">
              <LabelCampoCenso
                resaltar={mostrarFaltantes && esCampoFaltante("jefe_documento", faltantes)}
              >
                Cédula del jefe de familia
              </LabelCampoCenso>
              <div
                className={cn(
                  "flex gap-2",
                  mostrarFaltantes &&
                    esCampoFaltante("jefe_documento", faltantes) &&
                    claseGrupoFaltante,
                )}
              >
                <div className="flex overflow-hidden rounded-lg border">
                  {TIPOS_DOC.map((t, i) => (
                    <button
                      key={t.valor}
                      type="button"
                      className={cn(
                        "h-11 px-3 text-sm font-semibold transition-colors",
                        i > 0 && "border-l",
                        registro.jefe_tipo_doc === t.valor
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-muted",
                      )}
                      onClick={() => onChange({ jefe_tipo_doc: t.valor })}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <Input
                  aria-label="Cédula del jefe de familia"
                  inputMode={registro.jefe_tipo_doc === "P" ? "text" : "numeric"}
                  value={registro.jefe_documento}
                  onChange={(e) => onChange({ jefe_documento: e.target.value })}
                  placeholder="N.º de cédula del jefe"
                  className={cn(
                    "h-11 flex-1",
                    mostrarFaltantes &&
                      esCampoFaltante("jefe_documento", faltantes) &&
                      claseInputFaltante,
                  )}
                  autoComplete="off"
                />
              </div>
            </div>
          </CampoSiNo>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-tel`}>Teléfono</Label>
        <Input
          id={`${idPrefix}-tel`}
          type="tel"
          inputMode="tel"
          value={registro.telefono}
          onChange={(e) => onChange({ telefono: e.target.value })}
          placeholder="Teléfono de contacto (opcional)"
          className="h-11"
          autoComplete="off"
        />
      </div>

      {registro.sexo === "F" && (
        <CampoSiNo
          label="¿Embarazada?"
          valor={registro.embarazada}
          onChange={(v) =>
            onChange({
              embarazada: v,
              embarazo_semanas: v ? registro.embarazo_semanas : null,
            })
          }
        >
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-semanas`} className="text-xs">
              Semanas de embarazo
            </Label>
            <Input
              id={`${idPrefix}-semanas`}
              type="number"
              inputMode="numeric"
              min={1}
              max={45}
              value={registro.embarazo_semanas != null ? String(registro.embarazo_semanas) : ""}
              onChange={(e) =>
                onChange({
                  embarazo_semanas:
                    e.target.value === ""
                      ? null
                      : Math.min(45, Math.max(1, Number(e.target.value))),
                })
              }
              placeholder="Ej: 24"
              className="h-11"
            />
          </div>
        </CampoSiNo>
      )}

      <CampoSiNo
        label="¿Discapacitado?"
        valor={registro.discapacidad}
        onChange={(v) =>
          onChange({
            discapacidad: v,
            discapacidad_detalle: v ? registro.discapacidad_detalle : "",
          })
        }
      >
        <Input
          value={registro.discapacidad_detalle}
          onChange={(e) => onChange({ discapacidad_detalle: e.target.value })}
          placeholder="Indique la discapacidad"
          className="h-11"
          autoComplete="off"
        />
      </CampoSiNo>

      <CampoSiNo
        label="¿Enfermedad condicionante?"
        valor={registro.enfermedad}
        onChange={(v) =>
          onChange({
            enfermedad: v,
            enfermedad_detalle: v ? registro.enfermedad_detalle : "",
          })
        }
      >
        <Input
          value={registro.enfermedad_detalle}
          onChange={(e) => onChange({ enfermedad_detalle: e.target.value })}
          placeholder="Indique cuál enfermedad"
          className="h-11"
          autoComplete="off"
        />
      </CampoSiNo>

      <Separator />
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <MapPin className="size-3.5" />
        Dirección de la vivienda perdida
      </p>

      <div className="space-y-1.5">
        <Label>Condición de la vivienda</Label>
        <GrupoOpcionesSegmentadas
          opciones={CONDICIONES_VIVIENDA}
          valor={registro.condicion_vivienda}
          onChange={(v) => onChange({ condicion_vivienda: v })}
          columnas={3}
        />
      </div>

      <SelectoresGeo
        pais={registro.pais}
        estado={registro.estado_federativo}
        municipio={registro.municipio}
        parroquia={registro.parroquia}
        onPaisChange={(v) => onChange({ pais: v })}
        onEstadoChange={(v) => onChange({ estado_federativo: v })}
        onMunicipioChange={(v) => onChange({ municipio: v })}
        onParroquiaChange={(v) => onChange({ parroquia: v })}
        mostrarPais={false}
        paisBloqueado
        soloEstadosMetropolitanos
        permitirNoSe
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-calle`}>Calle</Label>
          <Input
            id={`${idPrefix}-calle`}
            value={registro.calle}
            onChange={(e) => onChange({ calle: e.target.value })}
            placeholder="Calle o avenida"
            className="h-11"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-casa`}>Casa / edificio</Label>
          <Input
            id={`${idPrefix}-casa`}
            value={registro.casa_edificio}
            onChange={(e) => onChange({ casa_edificio: e.target.value })}
            placeholder="N.º de casa, edificio, piso…"
            className="h-11"
            autoComplete="off"
          />
        </div>
      </div>

      {errorGuardar && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorGuardar}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="min-w-0 flex-1">
          <AvisoCamposFaltantes campos={faltantes} visible={mostrarFaltantes} />
        </div>
        <Button
          type="submit"
          className="h-12 w-full shrink-0 text-base sm:w-auto sm:min-w-[15rem]"
          disabled={!completo || guardando}
        >
          {guardando ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Guardando…
            </>
          ) : editando ? (
            <>
              <Check className="size-4" />
              Guardar cambios
            </>
          ) : (
            <>
              <UserPlus className="size-4" />
              Guardar registro
            </>
          )}
        </Button>
      </div>

      {pieExtra}
    </form>
  );
}
