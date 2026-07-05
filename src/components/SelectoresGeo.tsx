// Selectores en cascada: país → estado → municipio → parroquia (Venezuela).

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATALOGO_PAISES,
  estadosPorPais,
  municipiosPorEstado,
  normalizarPais,
  opcionesConLegacy,
  parroquiasPorMunicipio,
} from "@/domain/catalogosHumanitarios";
import type { CambioNivelGeo } from "@/domain/geografiaResidencia";
import { SelectCatalogo } from "./SelectCatalogo";

interface Props {
  pais: string;
  estado: string;
  municipio: string;
  parroquia: string;
  onPaisChange: (v: string) => void;
  onEstadoChange: (v: string) => void;
  onMunicipioChange: (v: string) => void;
  onParroquiaChange: (v: string) => void;
  /** Se dispara al cambiar un nivel administrativo (para mover el mapa). */
  onNivelChange?: (cambio: CambioNivelGeo) => void;
  disabled?: boolean;
  mostrarPais?: boolean;
  /** País bloqueado (ej. Venezuela por defecto). */
  paisBloqueado?: boolean;
}

export function SelectoresGeo({
  pais,
  estado,
  municipio,
  parroquia,
  onPaisChange,
  onEstadoChange,
  onMunicipioChange,
  onParroquiaChange,
  onNivelChange,
  disabled,
  mostrarPais = true,
  paisBloqueado = false,
}: Props) {
  const esVenezuela = normalizarPais(pais) === "Venezuela";
  const estados = opcionesConLegacy(estadosPorPais(pais), estado);
  const municipios = opcionesConLegacy(municipiosPorEstado(pais, estado), municipio);
  const parroquias = opcionesConLegacy(parroquiasPorMunicipio(pais, estado, municipio), parroquia);

  function cambiarPais(v: string) {
    onPaisChange(v);
    onEstadoChange("");
    onMunicipioChange("");
    onParroquiaChange("");
    if (v) onNivelChange?.({ nivel: "pais", valor: v });
  }

  function cambiarEstado(v: string) {
    onEstadoChange(v);
    onMunicipioChange("");
    onParroquiaChange("");
    if (v) onNivelChange?.({ nivel: "estado", valor: v });
  }

  function cambiarMunicipio(v: string) {
    onMunicipioChange(v);
    onParroquiaChange("");
    if (v) onNivelChange?.({ nivel: "municipio", valor: v });
  }

  function cambiarParroquia(v: string) {
    onParroquiaChange(v);
    if (v) onNivelChange?.({ nivel: "parroquia", valor: v });
  }

  if (!esVenezuela) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {mostrarPais && (
          <SelectCatalogo
            label="País"
            value={pais}
            opciones={CATALOGO_PAISES}
            onChange={cambiarPais}
            disabled={disabled || paisBloqueado}
            className="sm:col-span-2"
          />
        )}
        <CampoTexto
          label="Estado / provincia"
          value={estado}
          onChange={onEstadoChange}
          disabled={disabled}
          placeholder="Ej: Antioquia"
        />
        <CampoTexto
          label="Ciudad / municipio"
          value={municipio}
          onChange={onMunicipioChange}
          disabled={disabled}
          placeholder="Ej: Medellín"
        />
        <CampoTexto
          label="Parroquia / localidad"
          value={parroquia}
          onChange={cambiarParroquia}
          disabled={disabled}
          placeholder="Opcional"
          className="sm:col-span-2"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {mostrarPais && (
        <SelectCatalogo
          label="País"
          value={pais}
          opciones={CATALOGO_PAISES}
          onChange={cambiarPais}
          disabled={disabled || paisBloqueado}
          className="sm:col-span-2"
        />
      )}
      <SelectCatalogo
        label="Estado"
        value={estado}
        opciones={estados}
        onChange={cambiarEstado}
        disabled={disabled}
      />
      <SelectCatalogo
        label="Municipio"
        value={municipio}
        opciones={municipios}
        onChange={cambiarMunicipio}
        disabled={disabled || !estado}
        placeholder={estado ? "Seleccionar municipio…" : "Primero el estado"}
      />
      <SelectCatalogo
        label="Parroquia"
        value={parroquia}
        opciones={parroquias}
        onChange={cambiarParroquia}
        disabled={disabled || !municipio}
        placeholder={municipio ? "Seleccionar parroquia…" : "Primero el municipio"}
        className="sm:col-span-2"
      />
    </div>
  );
}

function CampoTexto({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="mt-1 h-9"
      />
    </div>
  );
}
