// Campos compartidos de residencia afectada (selectores geo + mapa + dirección).

import { useMemo, useState } from "react";
import {
  ESTATUS_VIVIENDA,
  TIPOS_TENENCIA,
  type EstatusVivienda,
  type TipoTenencia,
} from "@/domain/refugiados";
import {
  objetivoPorCambioNivel,
  resolverObjetivoGeografico,
  type CambioNivelGeo,
  type ObjetivoGeografico,
} from "@/domain/geografiaResidencia";
import { SelectoresGeo } from "@/components/SelectoresGeo";
import { MapaResidencia } from "./MapaResidencia";
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
import { Textarea } from "@/components/ui/textarea";

export interface ValoresResidenciaForm {
  pais: string;
  estado_federativo: string;
  municipio: string;
  parroquia: string;
  sector: string;
  direccion: string;
  referencia: string;
  estatus_vivienda: EstatusVivienda;
  tipo_tenencia: TipoTenencia;
  perdio_todo: boolean;
  perdidas_materiales: string;
  observaciones: string;
  lat: number | null;
  lng: number | null;
}

interface Props {
  valores: ValoresResidenciaForm;
  onChange: (parcial: Partial<ValoresResidenciaForm>) => void;
  disabled?: boolean;
  /** Muestra campos de tenencia y pérdidas (ficha completa). */
  mostrarTenencia?: boolean;
  /** Requiere pin en mapa para guardar (validación visual). */
  requerirPin?: boolean;
}

export function CamposResidenciaAfectada({
  valores,
  onChange,
  disabled = false,
  mostrarTenencia = true,
  requerirPin = true,
}: Props) {
  const [objetivoMapa, setObjetivoMapa] = useState<ObjetivoGeografico | null>(() =>
    resolverObjetivoGeografico({
      pais: valores.pais,
      estado: valores.estado_federativo,
      municipio: valores.municipio,
      parroquia: valores.parroquia,
    }),
  );

  const objetivoActual = useMemo(
    () =>
      resolverObjetivoGeografico({
        pais: valores.pais,
        estado: valores.estado_federativo,
        municipio: valores.municipio,
        parroquia: valores.parroquia,
      }),
    [valores.pais, valores.estado_federativo, valores.municipio, valores.parroquia],
  );

  function onNivelChange(cambio: CambioNivelGeo) {
    const obj = objetivoPorCambioNivel(
      {
        pais: valores.pais,
        estado: valores.estado_federativo,
        municipio: valores.municipio,
        parroquia: valores.parroquia,
      },
      cambio,
    );
    setObjetivoMapa(obj);
  }

  const pinPendiente = requerirPin && (valores.lat == null || valores.lng == null);

  return (
    <div className="space-y-4">
      <SelectoresGeo
        pais={valores.pais}
        estado={valores.estado_federativo}
        municipio={valores.municipio}
        parroquia={valores.parroquia}
        onPaisChange={(v) => onChange({ pais: v })}
        onEstadoChange={(v) => onChange({ estado_federativo: v })}
        onMunicipioChange={(v) => onChange({ municipio: v })}
        onParroquiaChange={(v) => onChange({ parroquia: v })}
        onNivelChange={onNivelChange}
        disabled={disabled}
        paisBloqueado
      />

      {!disabled && (
        <MapaResidencia
          lat={valores.lat}
          lng={valores.lng}
          onChange={(la, ln) => onChange({ lat: la, lng: ln })}
          objetivo={objetivoMapa ?? objetivoActual}
        />
      )}

      {pinPendiente && !disabled && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Marque en el mapa la ubicación exacta de la vivienda para verificación posterior.
        </p>
      )}

      <div>
        <Label className="text-xs">Sector / urbanización</Label>
        <Input
          value={valores.sector}
          onChange={(e) => onChange({ sector: e.target.value })}
          className="mt-1 h-9"
          placeholder="Nombre del sector o urbanización"
          disabled={disabled}
        />
      </div>
      <div>
        <Label className="text-xs">Dirección de la vivienda</Label>
        <Textarea
          value={valores.direccion}
          onChange={(e) => onChange({ direccion: e.target.value })}
          rows={2}
          className="mt-1 text-sm"
          placeholder="Calle, edificio, piso, apartamento…"
          disabled={disabled}
        />
      </div>
      <div>
        <Label className="text-xs">Punto de referencia</Label>
        <Input
          value={valores.referencia}
          onChange={(e) => onChange({ referencia: e.target.value })}
          className="mt-1 h-9"
          placeholder="Frente a…, al lado de…"
          disabled={disabled}
        />
      </div>
      <div>
        <Label className="text-xs">Estatus de la vivienda</Label>
        <Select
          value={valores.estatus_vivienda}
          onValueChange={(v) => onChange({ estatus_vivienda: v as EstatusVivienda })}
          disabled={disabled}
        >
          <SelectTrigger className="mt-1 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTATUS_VIVIENDA.map((e) => (
              <SelectItem key={e.valor} value={e.valor}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mostrarTenencia && (
        <>
          <div>
            <Label className="text-xs">Tipo de tenencia</Label>
            <Select
              value={valores.tipo_tenencia || "none"}
              onValueChange={(v) =>
                onChange({ tipo_tenencia: v === "none" ? "" : (v as TipoTenencia) })
              }
              disabled={disabled}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_TENENCIA.map((t) => (
                  <SelectItem key={t.valor || "none"} value={t.valor || "none"}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="perdio-todo-res"
              checked={valores.perdio_todo}
              disabled={disabled}
              onCheckedChange={(v: boolean) => onChange({ perdio_todo: v })}
            />
            <Label htmlFor="perdio-todo-res">Perdió todo en la emergencia</Label>
          </div>
          <div>
            <Label className="text-xs">Pérdidas materiales (separadas por coma)</Label>
            <Input
              value={valores.perdidas_materiales}
              onChange={(e) => onChange({ perdidas_materiales: e.target.value })}
              className="mt-1 h-9"
              disabled={disabled}
            />
          </div>
        </>
      )}

      <div>
        <Label className="text-xs">Observaciones</Label>
        <Textarea
          value={valores.observaciones}
          onChange={(e) => onChange({ observaciones: e.target.value })}
          rows={2}
          className="mt-1 text-sm"
          disabled={disabled}
        />
      </div>

      {!disabled && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Latitud</Label>
            <Input
              inputMode="decimal"
              value={valores.lat != null ? String(valores.lat) : ""}
              onChange={(e) => {
                const v = e.target.value.replace(",", ".");
                onChange({ lat: v ? Number(v) : null });
              }}
              className="mt-1 h-9 font-mono text-xs"
              placeholder="10.48061"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Longitud</Label>
            <Input
              inputMode="decimal"
              value={valores.lng != null ? String(valores.lng) : ""}
              onChange={(e) => {
                const v = e.target.value.replace(",", ".");
                onChange({ lng: v ? Number(v) : null });
              }}
              className="mt-1 h-9 font-mono text-xs"
              placeholder="-66.90360"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function valoresResidenciaVacios(): ValoresResidenciaForm {
  return {
    pais: "Venezuela",
    estado_federativo: "Distrito Capital",
    municipio: "",
    parroquia: "",
    sector: "",
    direccion: "",
    referencia: "",
    estatus_vivienda: "sin_verificar",
    tipo_tenencia: "",
    perdio_todo: false,
    perdidas_materiales: "",
    observaciones: "",
    lat: null,
    lng: null,
  };
}

export function residenciaAValoresForm(
  r: Partial<Omit<ValoresResidenciaForm, "perdidas_materiales">> & {
    geom?: GeoJSON.Point | null;
    perdidas_materiales?: string[] | string;
  },
): ValoresResidenciaForm {
  const base = valoresResidenciaVacios();
  const perdidas = Array.isArray(r.perdidas_materiales)
    ? r.perdidas_materiales.join(", ")
    : (r.perdidas_materiales ?? base.perdidas_materiales);
  return {
    ...base,
    pais: r.pais ?? base.pais,
    estado_federativo: r.estado_federativo ?? base.estado_federativo,
    municipio: r.municipio ?? base.municipio,
    parroquia: r.parroquia ?? base.parroquia,
    sector: r.sector ?? base.sector,
    direccion: r.direccion ?? base.direccion,
    referencia: r.referencia ?? base.referencia,
    estatus_vivienda: r.estatus_vivienda ?? base.estatus_vivienda,
    tipo_tenencia: r.tipo_tenencia ?? base.tipo_tenencia,
    perdio_todo: r.perdio_todo ?? base.perdio_todo,
    perdidas_materiales: perdidas,
    observaciones: r.observaciones ?? base.observaciones,
    lat: r.lat ?? r.geom?.coordinates[1] ?? null,
    lng: r.lng ?? r.geom?.coordinates[0] ?? null,
  };
}
