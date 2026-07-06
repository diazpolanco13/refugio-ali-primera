import { CEDULA_JEFE_NO_SE } from "@/domain/catalogosHumanitarios";
import {
  PARENTESCOS_MENOR,
  type FuncionarioCenso,
  type RegistroCenso,
} from "@/data/reposCenso";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const TIPOS_DOC: { valor: RegistroCenso["tipo_doc"]; label: string }[] = [
  { valor: "V", label: "V-" },
  { valor: "E", label: "E-" },
  { valor: "P", label: "PP" },
];

export const SEXOS: { valor: RegistroCenso["sexo"]; label: string }[] = [
  { valor: "M", label: "Masculino" },
  { valor: "F", label: "Femenino" },
];

export function registroVacio(): RegistroCenso {
  return {
    primer_nombre: "",
    segundo_nombre: "",
    primer_apellido: "",
    segundo_apellido: "",
    edad: null,
    tipo_doc: "V",
    documento: "",
    sexo: "",
    telefono: "",
    embarazada: false,
    embarazo_semanas: null,
    discapacidad: false,
    discapacidad_detalle: "",
    enfermedad: false,
    enfermedad_detalle: "",
    jefe_tipo_doc: "V",
    jefe_documento: "",
    parentesco_jefe: "",
    pais: "Venezuela",
    estado_federativo: "",
    municipio: "",
    parroquia: "",
    condicion_vivienda: "",
    calle: "",
    casa_edificio: "",
  };
}

type IdCampoRegistro =
  | "primer_nombre"
  | "primer_apellido"
  | "edad"
  | "sexo"
  | "parentesco_jefe"
  | "jefe_documento";

type IdCampoFuncionario = "jerarquia" | "nombre" | "institucion" | "telefono";

export interface CampoFaltanteCenso {
  id: IdCampoRegistro | IdCampoFuncionario;
  label: string;
}

export function camposFaltantesRegistro(
  registro: RegistroCenso,
  esMenor: boolean,
  conoceCedulaJefe: boolean,
): CampoFaltanteCenso[] {
  const faltantes: CampoFaltanteCenso[] = [];
  if (!registro.primer_nombre.trim()) faltantes.push({ id: "primer_nombre", label: "primer nombre" });
  if (!registro.primer_apellido.trim()) {
    faltantes.push({ id: "primer_apellido", label: "primer apellido" });
  }
  if (registro.edad == null) faltantes.push({ id: "edad", label: "edad" });
  if (!registro.sexo) faltantes.push({ id: "sexo", label: "sexo" });
  if (esMenor) {
    if (!registro.parentesco_jefe.trim()) {
      faltantes.push({ id: "parentesco_jefe", label: "parentesco con el jefe" });
    }
    if (conoceCedulaJefe && !registro.jefe_documento.trim()) {
      faltantes.push({ id: "jefe_documento", label: "cédula del jefe" });
    }
  }
  return faltantes;
}

export function camposFaltantesFuncionario(funcionario: FuncionarioCenso): CampoFaltanteCenso[] {
  const faltantes: CampoFaltanteCenso[] = [];
  if (!funcionario.jerarquia.trim()) faltantes.push({ id: "jerarquia", label: "jerarquía" });
  if (!funcionario.nombre.trim()) faltantes.push({ id: "nombre", label: "nombre" });
  if (!funcionario.institucion.trim()) faltantes.push({ id: "institucion", label: "institución" });
  if (!funcionario.telefono.trim()) faltantes.push({ id: "telefono", label: "teléfono" });
  return faltantes;
}

export function esCampoFaltante(id: CampoFaltanteCenso["id"], faltantes: CampoFaltanteCenso[]): boolean {
  return faltantes.some((c) => c.id === id);
}

export function registroCensoCompleto(registro: RegistroCenso): boolean {
  const esMenor = registro.edad != null && registro.edad < 18;
  return (
    registro.primer_nombre.trim() !== "" &&
    registro.primer_apellido.trim() !== "" &&
    registro.edad != null &&
    registro.sexo !== "" &&
    (!esMenor ||
      (registro.parentesco_jefe.trim() !== "" &&
        (registro.jefe_documento === CEDULA_JEFE_NO_SE || registro.jefe_documento.trim() !== "")))
  );
}

export const claseInputFaltante =
  "border-amber-500/45 ring-1 ring-amber-500/15 focus-visible:border-amber-500/60 focus-visible:ring-amber-500/25";

export const claseGrupoFaltante = "rounded-lg ring-1 ring-amber-500/20 ring-offset-0";

export function LabelCampoCenso({
  htmlFor,
  resaltar,
  className,
  children,
}: {
  htmlFor?: string;
  resaltar?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className={cn(resaltar && "text-amber-800 dark:text-amber-300", className)}
    >
      {children}
      {resaltar && (
        <span
          className="ml-1.5 inline-block size-1.5 rounded-full bg-amber-500 align-middle"
          aria-hidden
        />
      )}
    </Label>
  );
}

export function AvisoCamposFaltantes({
  campos,
  visible,
}: {
  campos: CampoFaltanteCenso[];
  visible: boolean;
}) {
  if (!visible || campos.length === 0) return null;
  return (
    <p className="text-xs leading-snug text-amber-700 dark:text-amber-400" role="status">
      Faltan {campos.length} campo{campos.length === 1 ? "" : "s"} obligatorio
      {campos.length === 1 ? "" : "s"}: {campos.map((c) => c.label).join(", ")}.
    </p>
  );
}

export function GrupoOpcionesSegmentadas<T extends string>({
  opciones,
  valor,
  onChange,
  columnas = 2,
  permitirDeseleccion = true,
}: {
  opciones: readonly { valor: T; label: string }[];
  valor: T | "";
  onChange: (valor: T | "") => void;
  columnas?: 2 | 3;
  permitirDeseleccion?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm",
        columnas === 3 ? "grid-cols-3" : "grid-cols-2",
      )}
    >
      {opciones.map((opcion) => {
        const activo = valor === opcion.valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            className={cn(
              "h-11 px-2 text-sm font-semibold transition-colors",
              "border-border not-first:border-l",
              activo
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground hover:bg-muted/80",
            )}
            onClick={() => onChange(activo && permitirDeseleccion ? "" : opcion.valor)}
          >
            {opcion.label}
          </button>
        );
      })}
    </div>
  );
}

export function CampoSiNo({
  label,
  valor,
  onChange,
  children,
}: {
  label: string;
  valor: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm">{label}</Label>
        <div className="flex overflow-hidden rounded-lg border">
          <button
            type="button"
            className={cn(
              "h-9 px-4 text-sm font-semibold transition-colors",
              !valor
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
            onClick={() => onChange(false)}
          >
            No
          </button>
          <button
            type="button"
            className={cn(
              "h-9 border-l px-4 text-sm font-semibold transition-colors",
              valor
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
            onClick={() => onChange(true)}
          >
            Sí
          </button>
        </div>
      </div>
      {valor && children}
    </div>
  );
}

export { PARENTESCOS_MENOR, CEDULA_JEFE_NO_SE };
