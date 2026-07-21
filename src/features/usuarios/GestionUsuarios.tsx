// Lista y gestión de usuarios (`/usuarios`). El alta y la edición viven en
// vistas a pantalla completa (`/usuarios/nuevo` y `/usuarios/:userId/editar`,
// ver FormUsuarioView); aquí quedan la lista agrupada por rol, los filtros
// (rol + cuerpo + búsqueda), la cobertura de centros y la eliminación con
// confirmación.
//
// Alcances (plan migración operadores §5): admin gestiona todos los usuarios;
// analista SAE y supervisor entran en modo «Mis operadores» — solo cuentas de
// operador de su alcance (la RLS filtra las filas; las edge functions
// create-user / update-user-password / delete-user validan en el servidor).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Rol, Sesion } from "@/data/authSupabase";
import { supabase } from "@/data/supabaseClient";
import { useCatalogoCuerposActivos } from "@/data/useCuerposPoliciales";
import { invocarEdgeFunction } from "@/data/edgeFunctions";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import {
  normalizarCuerpo,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import {
  INFO_ROLES,
  puedeGestionarOperadores,
  puedeGestionarUsuarios,
} from "@/domain/permisos";
import { Button } from "@/components/ui/button";
import { VistaPagina } from "@/components/VistaPagina";
import { EstadoVacio, LoadingTable } from "@/components/skeletons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BarraFiltrosUsuarios } from "./BarraFiltrosUsuarios";
import { calcularCoberturaCentros } from "./coberturaCentros";
import {
  agruparUsuariosPorRol,
  filtrarUsuariosGestion,
} from "./filtrarUsuarios";
import { ResumenCoberturaCentros } from "./ResumenCoberturaCentros";
import {
  etiquetaCentro,
  TarjetaUsuario,
  type UsuarioPerfil,
} from "./TarjetaUsuario";
import { BadgeRol } from "@/components/BadgeRol";

export function GestionUsuarios({ sesion }: { sesion: Sesion }) {
  const navigate = useNavigate();
  const esAdmin = puedeGestionarUsuarios(sesion.user.rol);
  // Analista/supervisor: modo «Mis operadores» (solo cuentas de operador de
  // su alcance; el servidor aplica el scoping real).
  const autorizado = esAdmin || puedeGestionarOperadores(sesion.user.rol);
  const soloOperadores = autorizado && !esAdmin;
  const usuarioActualId = sesion.user.sub;
  const [usuarios, setUsuarios] = useState<UsuarioPerfil[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [eliminando, setEliminando] = useState<UsuarioPerfil | null>(null);
  const [eliminandoEnCurso, setEliminandoEnCurso] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState("");
  const [filtroRol, setFiltroRol] = useState<Rol | "todos">("todos");
  const [filtroCuerpo, setFiltroCuerpo] = useState<string | "todos">("todos");
  const [busqueda, setBusqueda] = useState("");
  const cuerposCatalogo = useCatalogoCuerposActivos();

  // Los centros se leen de Supabase para etiquetar chips y clasificar por
  // cuerpo. `nro` vive dentro de `data` jsonb (no es columna top-level), así
  // que el orden se aplica en cliente (ver CentrosView.tsx para más detalle).
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

  const mapaCentrosEtiqueta = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of centros) m.set(c.id, etiquetaCentro(c, c.id));
    return m;
  }, [centros]);

  /** Centro → clave de cuerpo policial, para clasificar usuarios por cuerpo. */
  const mapaCentroCuerpo = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of centros) m.set(c.id, normalizarCuerpo(c.cuerpo));
    return m;
  }, [centros]);

  const recargar = useCallback(async () => {
    setError("");
    setCargando(true);
    try {
      let query = supabase.from("perfiles").select("*").order("username");
      // No-admin: la RLS igual deja ver analistas/supervisores (atribución en
      // otras vistas); aquí solo interesan sus operadores.
      if (soloOperadores) query = query.eq("rol", "operador");
      const { data, error: err } = await query;
      if (err) throw new Error(err.message);
      setUsuarios((data ?? []) as UsuarioPerfil[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar usuarios");
    } finally {
      setCargando(false);
    }
  }, [soloOperadores]);

  useEffect(() => {
    if (autorizado) void recargar();
    // Realtime: si otro admin edita un perfil, refrescar la lista.
    const canal = supabase
      .channel("perfiles-gestion")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "perfiles" },
        () => void recargar(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [autorizado, recargar]);

  /** Conteo por rol (sobre el total, no el filtro de búsqueda). */
  const conteos = useMemo(() => {
    const c = new Map<Rol, number>();
    for (const u of usuarios) c.set(u.rol, (c.get(u.rol) ?? 0) + 1);
    return c;
  }, [usuarios]);

  const cobertura = useMemo(
    () => calcularCoberturaCentros(centros, usuarios),
    [centros, usuarios],
  );

  /** Cuerpos con al menos un usuario vinculado (por asignación o campamentos). */
  const cuerposConUsuarios = useMemo(() => {
    const vinculados = new Set<string>();
    for (const u of usuarios) {
      if (u.cuerpo_asignado) vinculados.add(u.cuerpo_asignado);
      for (const id of u.centros_asignados ?? []) {
        const clave = mapaCentroCuerpo.get(id);
        if (clave && clave !== "sin_asignar") vinculados.add(clave);
      }
    }
    return cuerposCatalogo
      .filter((c) => vinculados.has(c.clave))
      .map((c) => ({ clave: c.clave, label: c.label }));
  }, [usuarios, mapaCentroCuerpo, cuerposCatalogo]);

  /** Usuarios visibles según rol + cuerpo + búsqueda, agrupados por rol. */
  const grupos = useMemo(() => {
    const visibles = filtrarUsuariosGestion({
      usuarios,
      mapaCentrosEtiqueta,
      filtroRol,
      busqueda,
      filtroCuerpo,
      mapaCentroCuerpo,
    });
    return agruparUsuariosPorRol(visibles);
  }, [usuarios, mapaCentrosEtiqueta, filtroRol, busqueda, filtroCuerpo, mapaCentroCuerpo]);

  const sinResultadosFiltro =
    !cargando &&
    usuarios.length > 0 &&
    grupos.length === 0 &&
    (busqueda.trim() !== "" || filtroRol !== "todos" || filtroCuerpo !== "todos");

  async function confirmarEliminar() {
    if (!eliminando) return;
    setErrorEliminar("");
    setEliminandoEnCurso(true);
    try {
      // Borra auth.users + perfil (cascade) vía Edge Function con service_role.
      await invocarEdgeFunction("delete-user", { user_id: eliminando.user_id });
      setEliminando(null);
      await recargar();
    } catch (err) {
      setErrorEliminar(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setEliminandoEnCurso(false);
    }
  }

  return (
    <>
    <VistaPagina
      icono={Users}
      acento="violet"
      titulo={soloOperadores ? "Mis operadores" : "Gestión de usuarios"}
      descripcion={
        soloOperadores
          ? "Cree, edite o elimine las cuentas de operador de sus campamentos"
          : "Fichas, roles y permisos de acceso a la plataforma"
      }
      acciones={
        autorizado ? (
          <Button onClick={() => navigate("/usuarios/nuevo")} className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">
              {soloOperadores ? "Nuevo operador" : "Nuevo usuario"}
            </span>
          </Button>
        ) : undefined
      }
      cuerpoClassName="p-4 lg:p-6"
    >
      {!autorizado ? (
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-background/70 p-6 text-center">
            <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Acceso restringido</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Solo administración, analistas SAE y supervisores gestionan usuarios.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {esAdmin && (
              <ResumenCoberturaCentros
                cobertura={cobertura}
                cargando={cargando}
              />
            )}

            {(cargando || usuarios.length > 0) && (
              <BarraFiltrosUsuarios
                busqueda={busqueda}
                onBusqueda={setBusqueda}
                filtroRol={filtroRol}
                onFiltroRol={setFiltroRol}
                conteos={conteos}
                total={usuarios.length}
                cuerpos={cuerposConUsuarios}
                filtroCuerpo={filtroCuerpo}
                onFiltroCuerpo={setFiltroCuerpo}
                disabled={cargando || usuarios.length === 0}
              />
            )}

            {cargando ? (
              <LoadingTable rows={6} cols={3} conToolbar={false} />
            ) : usuarios.length === 0 ? (
              <EstadoVacio titulo="No hay usuarios registrados" />
            ) : sinResultadosFiltro ? (
              <EstadoVacio titulo="Sin resultados para la búsqueda o el filtro" />
            ) : (
              grupos.map(({ rol, usuarios: lista }) => (
                <section key={rol} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BadgeRol rol={rol} />
                    <span className="text-xs text-muted-foreground">
                      {lista.length} usuario{lista.length === 1 ? "" : "s"}
                    </span>
                    <span
                      className="hidden truncate text-[11px] text-muted-foreground/70 sm:inline"
                      title={INFO_ROLES[rol].descripcion}
                    >
                      — {INFO_ROLES[rol].descripcion}
                    </span>
                  </div>
                  <ul className="grid gap-3 md:grid-cols-2">
                    {lista.map((u) => (
                      <TarjetaUsuario
                        key={u.user_id}
                        usuario={u}
                        esYo={u.user_id === usuarioActualId}
                        centros={centros}
                        onEditar={() => navigate(`/usuarios/${u.user_id}/editar`)}
                        onEliminar={
                          u.user_id !== usuarioActualId
                            ? () => {
                                setErrorEliminar("");
                                setEliminando(u);
                              }
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        )}
    </VistaPagina>

      {/* Confirmación de eliminación: borra el perfil Y el registro de
          autenticación (Edge Function `delete-user` con service_role). */}
      <Dialog
        open={eliminando != null}
        onOpenChange={(o) => !o && setEliminando(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres eliminar a{" "}
              <span className="font-medium text-foreground">
                {eliminando?.nombre || eliminando?.username}
              </span>
              ? Se borra su cuenta de acceso y su ficha. Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          {errorEliminar && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorEliminar}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEliminando(null)}
              disabled={eliminandoEnCurso}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmarEliminar()}
              disabled={eliminandoEnCurso}
            >
              {eliminandoEnCurso ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Eliminar usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
