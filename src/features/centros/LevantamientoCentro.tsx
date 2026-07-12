import {
  Ambulance,
  HeartPulse,
  Landmark,
  Scale,
  Shield,
  Stethoscope,
} from "lucide-react";
import { AccionesContacto } from "@/components/AccionesContacto";
import {
  etiquetaRespuesta,
  type ContactoReporte,
  type RespuestaLevantamiento,
  type SeguridadCentro,
  type ServiciosCentro,
} from "@/domain/centrosTransitorios";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";
import { cn } from "@/lib/utils";

const COLOR_RESPUESTA: Record<string, string> = {
  si: "#22c55e",
  no: "#ef4444",
  pendiente: "#f59e0b",
};

function colorRespuesta(valor: RespuestaLevantamiento): string {
  if (valor === true) return COLOR_RESPUESTA.si;
  if (valor === false) return COLOR_RESPUESTA.no;
  return COLOR_RESPUESTA.pendiente;
}

/** Badge de sí / no / en proceso para servicios del reporte. */
export function BadgeRespuesta({ valor }: { valor: RespuestaLevantamiento }) {
  const color = colorRespuesta(valor);
  return (
    <Badge
      variant="outline"
      className="text-[10px]"
      style={{ borderColor: `${color}66`, color }}
    >
      {etiquetaRespuesta(valor)}
    </Badge>
  );
}

/** Selector sí / no / pendiente al estilo del reporte de campo. */
export function SelectorRespuesta({
  valor,
  onChange,
  deshabilitado,
  id,
}: {
  valor: RespuestaLevantamiento;
  onChange: (v: RespuestaLevantamiento) => void;
  deshabilitado?: boolean;
  id?: string;
}) {
  const opciones: { v: RespuestaLevantamiento; label: string }[] = [
    { v: true, label: "Sí" },
    { v: false, label: "No" },
    { v: null, label: "En proceso" },
  ];
  return (
    <div id={id} className="flex gap-1" role="group">
      {opciones.map(({ v, label }) => {
        const activo = valor === v;
        const color = colorRespuesta(v);
        return (
          <button
            key={label}
            type="button"
            disabled={deshabilitado}
            onClick={() => onChange(v)}
            className={cn(
              "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
              activo
                ? "border-transparent text-white"
                : "border-border bg-transparent text-muted-foreground hover:bg-muted/50",
            )}
            style={activo ? { background: color } : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Bloque de formulario para coordinador político o ministerial. */
export function FormularioContacto({
  titulo,
  contacto,
  onChange,
  deshabilitado,
}: {
  titulo: string;
  contacto: ContactoReporte;
  onChange: (patch: Partial<ContactoReporte>) => void;
  deshabilitado?: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader className="px-3 py-2">
        <CardTitle className="text-xs">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        <div>
          <Label className="text-[11px] text-muted-foreground">Nombre y apellido</Label>
          <Input
            className="mt-1"
            value={contacto.nombre}
            disabled={deshabilitado}
            onChange={(e) => onChange({ nombre: e.target.value })}
            placeholder="Nombre completo"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Cédula</Label>
            <Input
              className="mt-1"
              value={contacto.cedula}
              disabled={deshabilitado}
              onChange={(e) => onChange({ cedula: e.target.value })}
              placeholder="V-…"
              inputMode="numeric"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Teléfono</Label>
            <Input
              className="mt-1"
              value={contacto.telefono}
              disabled={deshabilitado}
              onChange={(e) => onChange({ telefono: e.target.value })}
              placeholder="04xx-…"
              inputMode="tel"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">
            Ministerio, ente u organización
          </Label>
          <Input
            className="mt-1"
            value={contacto.ente}
            disabled={deshabilitado}
            onChange={(e) => onChange({ ente: e.target.value })}
            placeholder="Ej. Alcaldía del Municipio Sucre - PSUV"
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Bloque de formulario para jefe de seguridad (sección III). */
export function FormularioSeguridad({
  seguridad,
  onChange,
  deshabilitado,
  organismoSugerido,
}: {
  seguridad: SeguridadCentro;
  onChange: (patch: Partial<SeguridadCentro>) => void;
  deshabilitado?: boolean;
  /** Cuerpo asignado del catálogo (prellena organismo). */
  organismoSugerido?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader className="px-3 py-2">
        <CardTitle className="flex items-center gap-1.5 text-xs">
          <Shield className="size-3.5" />
          Jefe de seguridad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        <div>
          <Label className="text-[11px] text-muted-foreground">Nombre y apellido</Label>
          <Input
            className="mt-1"
            value={seguridad.nombre}
            disabled={deshabilitado}
            onChange={(e) => onChange({ nombre: e.target.value })}
            placeholder="Ej. PC Henry Antonio Naveda Ponce"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Cédula</Label>
            <Input
              className="mt-1"
              value={seguridad.cedula}
              disabled={deshabilitado}
              onChange={(e) => onChange({ cedula: e.target.value })}
              inputMode="numeric"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Teléfono</Label>
            <Input
              className="mt-1"
              value={seguridad.telefono}
              disabled={deshabilitado}
              onChange={(e) => onChange({ telefono: e.target.value })}
              inputMode="tel"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Organismo de seguridad</Label>
          <Input
            className="mt-1"
            value={seguridad.organismo || organismoSugerido || ""}
            disabled={deshabilitado}
            onChange={(e) => onChange({ organismo: e.target.value })}
            placeholder="SEBIN, GNB, PNB…"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Personal a su mando</Label>
            <NumInput
              className="mt-1"
              value={seguridad.personal_mando}
              disabled={deshabilitado}
              onChange={(n) => onChange({ personal_mando: n })}
              max={2_000}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Vehículos disponibles</Label>
            <NumInput
              className="mt-1"
              value={seguridad.vehiculos}
              disabled={deshabilitado}
              onChange={(n) => onChange({ vehiculos: n })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const SERVICIOS_SALUD: {
  clave: keyof ServiciosCentro;
  label: string;
  icono: React.ReactNode;
}[] = [
  { clave: "medicos", label: "Cuenta con médicos", icono: <Stethoscope className="size-4" /> },
  { clave: "ambulancias", label: "Ambulancias", icono: <Ambulance className="size-4" /> },
  { clave: "psicologo", label: "Psicólogo", icono: <HeartPulse className="size-4" /> },
  {
    clave: "contacto_juez_paz",
    label: "Contacto juez de paz",
    icono: <Scale className="size-4" />,
  },
];

/** Formulario de servicios de salud y apoyo (sección IV). */
export function FormularioServicios({
  servicios,
  onChange,
  deshabilitado,
}: {
  servicios: ServiciosCentro;
  onChange: (clave: keyof ServiciosCentro, valor: RespuestaLevantamiento) => void;
  deshabilitado?: boolean;
}) {
  return (
    <div className="space-y-2">
      {SERVICIOS_SALUD.map(({ clave, label, icono }) => (
        <Card key={clave} size="sm" className="py-2">
          <CardContent className="px-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
              {icono}
              {label}
            </div>
            <SelectorRespuesta
              valor={servicios[clave]}
              onChange={(v) => onChange(clave, v)}
              deshabilitado={deshabilitado}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Tarjeta de lectura para un contacto del reporte. */
export function TarjetaContacto({
  titulo,
  contacto,
  icono,
}: {
  titulo: string;
  contacto: ContactoReporte;
  icono?: React.ReactNode;
}) {
  const vacio =
    !contacto.nombre.trim() &&
    !contacto.telefono.trim() &&
    !contacto.cedula.trim() &&
    !contacto.ente.trim();
  if (vacio) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icono}
        {titulo}
      </p>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          {contacto.nombre.trim() && (
            <p className="text-sm font-medium text-foreground">{contacto.nombre}</p>
          )}
          {contacto.cedula.trim() && (
            <p className="text-[11px] text-muted-foreground">C.I. {contacto.cedula}</p>
          )}
          {contacto.ente.trim() && (
            <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
              <Landmark className="mt-0.5 size-3 shrink-0" />
              {contacto.ente}
            </p>
          )}
        </div>
        <AccionesContacto telefono={contacto.telefono} />
      </div>
    </div>
  );
}

/** Tarjeta de lectura para seguridad (sección III). */
export function TarjetaSeguridad({
  seguridad,
  organismoCatalogo,
}: {
  seguridad: SeguridadCentro;
  organismoCatalogo?: string;
}) {
  const vacio =
    !seguridad.nombre.trim() &&
    !seguridad.telefono.trim() &&
    seguridad.personal_mando === 0 &&
    seguridad.vehiculos === 0;
  if (vacio) return null;

  const organismo = seguridad.organismo.trim() || organismoCatalogo || "";

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Shield className="size-3" />
        Jefe de seguridad
      </p>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          {seguridad.nombre.trim() && (
            <p className="text-sm font-medium text-foreground">{seguridad.nombre}</p>
          )}
          {seguridad.cedula.trim() && (
            <p className="text-[11px] text-muted-foreground">C.I. {seguridad.cedula}</p>
          )}
          {organismo && (
            <p className="text-[11px] text-muted-foreground">Organismo: {organismo}</p>
          )}
          {(seguridad.personal_mando > 0 || seguridad.vehiculos > 0) && (
            <p className="text-[11px] text-muted-foreground">
              {seguridad.personal_mando > 0 &&
                `${seguridad.personal_mando.toLocaleString("es")} personal`}
              {seguridad.personal_mando > 0 && seguridad.vehiculos > 0 && " · "}
              {seguridad.vehiculos > 0 &&
                `${seguridad.vehiculos.toLocaleString("es")} vehículos`}
            </p>
          )}
        </div>
        <AccionesContacto telefono={seguridad.telefono} />
      </div>
    </div>
  );
}

/** Grid de servicios de salud en modo lectura. */
export function GridServicios({ servicios }: { servicios: ServiciosCentro }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {SERVICIOS_SALUD.map(({ clave, label, icono }) => (
        <div
          key={clave}
          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-2"
        >
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-foreground">
            {icono}
            <span className="truncate">{label.replace("Cuenta con ", "")}</span>
          </span>
          <BadgeRespuesta valor={servicios[clave]} />
        </div>
      ))}
    </div>
  );
}
