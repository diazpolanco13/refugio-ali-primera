// Pestaña Residencia afectada — dirección, estatus, mapa y fotos de la vivienda.

import { useEffect, useRef, useState } from "react";
import { Camera, Home, Loader2, Trash2 } from "lucide-react";
import {
  direccionResidencia,
  META_ESTATUS_VIVIENDA,
  type ResidenciaAfectada,
} from "@/domain/refugiados";
import { guardarResidenciaAfectada } from "@/data/reposRefugiados";
import { subirFotoResidencia, supabaseDisponible, urlFotoResidencia } from "@/data/supabase";
import {
  CamposResidenciaAfectada,
  residenciaAValoresForm,
  type ValoresResidenciaForm,
} from "./CamposResidenciaAfectada";
import { MapaResidencia } from "./MapaResidencia";
import { resolverObjetivoGeografico } from "@/domain/geografiaResidencia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  familiaId: string;
  centroId: string;
  familiaNombre?: string;
  residencia: ResidenciaAfectada | null;
  puedeEditar: boolean;
}

export function ResidenciaAfectadaSection({
  familiaId,
  centroId,
  familiaNombre,
  residencia,
  puedeEditar,
}: Props) {
  const [editando, setEditando] = useState(!residencia);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [valores, setValores] = useState<ValoresResidenciaForm>(() =>
    residencia
      ? residenciaAValoresForm(residencia)
      : residenciaAValoresForm({}),
  );
  const [fotos, setFotos] = useState<string[]>(residencia?.fotos ?? []);
  const [urlsFotos, setUrlsFotos] = useState<(string | null)[]>([]);

  useEffect(() => {
    if (!residencia) return;
    setValores(residenciaAValoresForm(residencia));
    setFotos(residencia.fotos);
  }, [residencia]);

  useEffect(() => {
    let cancelado = false;
    async function cargarUrls() {
      const urls = await Promise.all(fotos.map((p) => urlFotoResidencia(p)));
      if (!cancelado) setUrlsFotos(urls);
    }
    void cargarUrls();
    return () => {
      cancelado = true;
    };
  }, [fotos]);

  const soloLectura = !puedeEditar || !editando;
  const metaEstatus = META_ESTATUS_VIVIENDA[valores.estatus_vivienda];

  function actualizarValores(parcial: Partial<ValoresResidenciaForm>) {
    setValores((prev) => ({ ...prev, ...parcial }));
  }

  async function guardar() {
    setError(null);
    if (valores.lat == null || valores.lng == null) {
      setError("Marque la ubicación exacta de la vivienda en el mapa antes de guardar.");
      return;
    }
    setGuardando(true);
    try {
      await guardarResidenciaAfectada({
        familia_id: familiaId,
        centro_id: centroId,
        pais: valores.pais,
        estado_federativo: valores.estado_federativo,
        municipio: valores.municipio,
        parroquia: valores.parroquia,
        sector: valores.sector,
        direccion: valores.direccion,
        referencia: valores.referencia,
        estatus_vivienda: valores.estatus_vivienda,
        lat: valores.lat,
        lng: valores.lng,
        fotos,
        observaciones: valores.observaciones,
        tipo_tenencia: valores.tipo_tenencia,
        perdio_todo: valores.perdio_todo,
        perdidas_materiales: valores.perdidas_materiales
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar residencia");
    } finally {
      setGuardando(false);
    }
  }

  async function onFotoSeleccionada(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !supabaseDisponible()) return;
    setSubiendoFoto(true);
    setError(null);
    try {
      const path = await subirFotoResidencia(centroId, familiaId, file);
      setFotos((prev) => [...prev, path]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto");
    } finally {
      setSubiendoFoto(false);
    }
  }

  function quitarFoto(idx: number) {
    setFotos((prev) => prev.filter((_, i) => i !== idx));
  }

  const objetivoLectura = residencia
    ? resolverObjetivoGeografico({
        pais: residencia.pais,
        estado: residencia.estado_federativo,
        municipio: residencia.municipio,
        parroquia: residencia.parroquia,
      })
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Home className="size-4" />
              Residencia afectada
            </CardTitle>
            <CardDescription className="text-xs">
              {familiaNombre
                ? `Vivienda de la familia ${familiaNombre} al momento de la emergencia`
                : "Ubicación y estado de la vivienda de la familia"}
            </CardDescription>
          </div>
          {puedeEditar && residencia && !editando && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setEditando(true)}
            >
              Editar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!editando && residencia && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  style={{ borderColor: metaEstatus.color, color: metaEstatus.color }}
                >
                  {metaEstatus.label}
                </Badge>
              </div>
              <p className="text-sm font-medium">{direccionResidencia(residencia)}</p>
              {residencia.observaciones && (
                <p className="text-xs text-muted-foreground">{residencia.observaciones}</p>
              )}
              {residencia.geom && (
                <MapaResidencia
                  lat={residencia.geom.coordinates[1]}
                  lng={residencia.geom.coordinates[0]}
                  onChange={() => {}}
                  soloLectura
                  objetivo={objetivoLectura}
                />
              )}
              {urlsFotos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {urlsFotos.map(
                    (url, i) =>
                      url && (
                        <img
                          key={fotos[i]}
                          src={url}
                          alt={`Foto vivienda ${i + 1}`}
                          className="aspect-video rounded-lg border border-border object-cover"
                        />
                      ),
                  )}
                </div>
              )}
            </div>
          )}

          {editando && (
            <>
              <CamposResidenciaAfectada
                valores={valores}
                onChange={actualizarValores}
                disabled={soloLectura}
                mostrarTenencia
              />

              <div>
                <p className="text-xs font-medium">Fotos actuales de la vivienda</p>
                {urlsFotos.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {urlsFotos.map(
                      (url, i) =>
                        url && (
                          <div key={fotos[i]} className="group relative">
                            <img
                              src={url}
                              alt={`Foto ${i + 1}`}
                              className="aspect-video rounded-lg border border-border object-cover"
                            />
                            {!soloLectura && (
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute top-1 right-1 size-7 opacity-90"
                                onClick={() => quitarFoto(i)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        ),
                    )}
                  </div>
                )}
                {!soloLectura && supabaseDisponible() && (
                  <>
                    <input
                      ref={inputFotoRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => void onFotoSeleccionada(e)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8 gap-1.5"
                      disabled={subiendoFoto}
                      onClick={() => inputFotoRef.current?.click()}
                    >
                      {subiendoFoto ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Camera className="size-3.5" />
                      )}
                      {subiendoFoto ? "Subiendo…" : "Agregar foto"}
                    </Button>
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {residencia && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditando(false)}>
                    Cancelar
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={guardando || subiendoFoto}
                  onClick={() => void guardar()}
                >
                  {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar residencia"}
                </Button>
              </div>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
