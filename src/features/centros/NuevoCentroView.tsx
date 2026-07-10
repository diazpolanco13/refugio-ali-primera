// Alta de un centro nuevo a pantalla completa (`/centro/nuevo`).

import { useMemo, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { nuevoId } from "@/data/reposSupabase";
import type { Sesion } from "@/data/authSupabase";
import { puedeCrearCentros } from "@/domain/permisos";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { CentroForm } from "./CentroForm";

interface Props {
  sesion: Sesion;
}

/** Vista dedicada para registrar un centro nuevo en la red. */
export function NuevoCentroView({ sesion }: Props) {
  const navigate = useNavigate();
  const puedeCrear = puedeCrearCentros(sesion.user.rol);
  const idRef = useRef(nuevoId());

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );

  const centros = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );

  const centroNuevo = useMemo((): CentroTransitorio => {
    const nro = centros.reduce((max, c) => Math.max(max, c.nro ?? 0), 0) + 1;
    return {
      id: idRef.current,
      nro,
      nombre: "",
      grupo: "Área Metropolitana",
      cuerpo: "SEBIN",
      parroquia: "",
      direccion: "",
      mapsUrl: "",
      geom: null,
      notas: "",
      estado: "preparacion",
      supervision: { unidad_sebin: "", supervisor_sebin: "", analistas_sae: [] },
    };
  }, [centros]);

  if (!puedeCrear) {
    return <Navigate to="/centros/mapa" replace />;
  }

  if (filasCentros.length === 0) {
    return (
      <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL} marcoClassName="flex min-h-[50vh] items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Preparando formulario…</p>
      </MarcoVista>
    );
  }

  function volver() {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/centros/mapa");
  }

  return (
    <CentroForm
      centro={centroNuevo}
      esNuevo
      puedeEliminar={false}
      variant="pantallaCompleta"
      onCerrar={volver}
      onGuardado={(id) => navigate(`/centro/${id}`, { replace: true })}
    />
  );
}
