import { useState } from "react";
import {
  CATALOGO_TIPOS,
  CONDICIONES,
  ESTADOS_PUNTO,
  GENEROS,
  META_POR_TIPO,
  MOVILIDADES,
  ORGANISMOS_COMUNES,
  type EstadoPunto,
  type PuntoServicio,
  type TipoPunto,
} from "../../domain/tipos";
import {
  esMantenimiento,
  formatoDuracion,
  frecuenciaPorDefecto,
  infoLimpieza,
} from "../../domain/limpieza";
import { Modal } from "../../ui/Modal";
import { btnPeligro, btnPrimario, btnSecundario, inputCls, labelCls } from "../../ui/clases";

interface Props {
  geom: GeoJSON.Point;
  inicial?: PuntoServicio;
  soloLectura?: boolean;
  onGuardar: (datos: Omit<PuntoServicio, "id" | "updated_at" | "updated_by"> & { id?: string }) => void;
  onEliminar?: () => void;
  onCerrar: () => void;
}

export function PuntoForm({
  geom,
  inicial,
  soloLectura = false,
  onGuardar,
  onEliminar,
  onCerrar,
}: Props) {
  const [tipo, setTipo] = useState<TipoPunto>(inicial?.tipo ?? "hidratacion");
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [estado, setEstado] = useState<EstadoPunto>(inicial?.estado ?? "operativo");
  const [capacidad, setCapacidad] = useState(inicial?.capacidad ?? 0);
  const [organismo, setOrganismo] = useState(inicial?.organismo ?? "");
  const [movilidad, setMovilidad] = useState(inicial?.movilidad ?? "");
  const [genero, setGenero] = useState(inicial?.genero ?? "");
  const [condicion, setCondicion] = useState(inicial?.condicion ?? "estandar");
  const [frecuencia, setFrecuencia] = useState(
    inicial?.frecuenciaLimpiezaHoras ?? frecuenciaPorDefecto(inicial?.tipo ?? "sanitarios"),
  );
  const [ultimaLimpieza] = useState(inicial?.ultimaLimpieza);
  const [notas, setNotas] = useState(inicial?.notas ?? "");

  const meta = META_POR_TIPO[tipo];
  const esSeguridad = tipo === "seguridad";
  const muestraOrganismo = tipo === "seguridad" || tipo === "salud";
  const esWash = tipo === "sanitarios" || tipo === "duchas";
  const esMant = esMantenimiento(tipo);
  const accion = tipo === "residuos" ? "recolección" : "limpieza";

  function datos(ultima?: number) {
    return {
      id: inicial?.id,
      tipo,
      nombre: nombre.trim() || meta.label,
      geom,
      estado,
      capacidad,
      organismo: muestraOrganismo ? organismo.trim() || undefined : undefined,
      movilidad: esSeguridad ? movilidad || undefined : undefined,
      genero: esWash ? genero || undefined : undefined,
      condicion: esWash ? condicion || undefined : undefined,
      frecuenciaLimpiezaHoras: esMant ? frecuencia || undefined : undefined,
      ultimaLimpieza: esMant ? (ultima ?? ultimaLimpieza) : undefined,
      notas: notas.trim(),
    };
  }

  function guardar() {
    onGuardar(datos());
  }
  function marcarLimpio() {
    onGuardar(datos(Date.now()));
  }

  const infoLimp = esMant
    ? infoLimpieza(
        { tipo, frecuenciaLimpiezaHoras: frecuencia, ultimaLimpieza } as PuntoServicio,
        Date.now(),
      )
    : null;

  return (
    <Modal titulo={inicial ? "Editar punto" : "Nuevo punto de servicio"} onCerrar={onCerrar}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Tipo de servicio (capa)</label>
          <select
            className={inputCls}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoPunto)}
          >
            {CATALOGO_TIPOS.map((m) => (
              <option key={m.tipo} value={m.tipo}>
                {m.icono} {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Nombre / referencia</label>
          <input
            className={inputCls}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={meta.label}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Estado</label>
            <select
              className={inputCls}
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoPunto)}
            >
              {ESTADOS_PUNTO.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              Capacidad {meta.unidadCapacidad ? `(${meta.unidadCapacidad})` : ""}
            </label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={capacidad}
              onChange={(e) => setCapacidad(Number(e.target.value))}
            />
          </div>
        </div>

        {muestraOrganismo && (
          <div className="grid grid-cols-2 gap-3">
            <div className={esSeguridad ? "" : "col-span-2"}>
              <label className={labelCls}>Organismo</label>
              <input
                className={inputCls}
                list="organismos-comunes"
                value={organismo}
                onChange={(e) => setOrganismo(e.target.value)}
                placeholder="Ej: PNB, GNB, Bomberos…"
              />
              <datalist id="organismos-comunes">
                {ORGANISMOS_COMUNES.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            {esSeguridad && (
              <div>
                <label className={labelCls}>Movilidad</label>
                <select
                  className={inputCls}
                  value={movilidad}
                  onChange={(e) => setMovilidad(e.target.value)}
                >
                  <option value="">— Sin especificar —</option>
                  {MOVILIDADES.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.icono} {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {esWash && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Género</label>
              <select
                className={inputCls}
                value={genero}
                onChange={(e) => setGenero(e.target.value)}
              >
                <option value="">— Sin especificar —</option>
                {GENEROS.map((g) => (
                  <option key={g.valor} value={g.valor}>
                    {g.icono} {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Condición</label>
              <select
                className={inputCls}
                value={condicion}
                onChange={(e) => setCondicion(e.target.value)}
              >
                {CONDICIONES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {esMant && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-300">
              🧹 Cronómetro de {accion}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Cada cuántas horas</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={frecuencia}
                  onChange={(e) => setFrecuencia(Number(e.target.value))}
                />
                {frecuencia > 0 && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    ≈ {Math.round(24 / frecuencia)} veces al día
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-xs">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ background: infoLimp?.color ?? "#94a3b8" }}
                  />
                  <span className="text-slate-300">
                    {ultimaLimpieza
                      ? `Hace ${formatoDuracion(Date.now() - ultimaLimpieza)}`
                      : "Sin registro"}
                  </span>
                </div>
              </div>
            </div>
            {!soloLectura && (
              <button
                type="button"
                onClick={marcarLimpio}
                className="mt-3 w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
              >
                🧹 {tipo === "residuos" ? "Basura recogida ahora" : "Marcar limpiado ahora"}
              </button>
            )}
          </div>
        )}

        <div>
          <label className={labelCls}>Notas</label>
          <textarea
            className={inputCls}
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        {soloLectura ? (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">Solo lectura</span>
            <button className={btnSecundario} onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-2">
            {onEliminar ? (
              <button className={btnPeligro} onClick={onEliminar}>
                Eliminar
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button className={btnSecundario} onClick={onCerrar}>
                Cancelar
              </button>
              <button className={btnPrimario} onClick={guardar}>
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
