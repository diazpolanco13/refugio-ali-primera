import { useState } from "react";
import {
  CATEGORIAS_RESPONSABLE,
  FUNCIONES_COMUNES,
  SECTOR_COLORES,
  type Responsable,
  type Sector,
} from "../../domain/tipos";
import { nuevoId } from "../../data/db";
import { Modal } from "../../ui/Modal";
import { btnPeligro, btnPrimario, btnSecundario, inputCls, labelCls } from "../../ui/clases";

interface Props {
  geom: GeoJSON.Polygon;
  inicial?: Sector;
  colorSugerido: string;
  soloLectura?: boolean;
  onGuardar: (datos: Omit<Sector, "id" | "updated_at" | "updated_by"> & { id?: string }) => void;
  onEliminar?: () => void;
  onCerrar: () => void;
}

export function SectorForm({
  geom,
  inicial,
  colorSugerido,
  soloLectura = false,
  onGuardar,
  onEliminar,
  onCerrar,
}: Props) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [color, setColor] = useState(inicial?.color ?? colorSugerido);
  const [responsables, setResponsables] = useState<Responsable[]>(
    inicial?.responsables ?? [],
  );
  const [poblacion, setPoblacion] = useState(inicial?.poblacion_estimada ?? 0);
  const [familias, setFamilias] = useState(inicial?.familias ?? 0);
  const [ninos, setNinos] = useState(inicial?.vulnerables.ninos ?? 0);
  const [embarazadas, setEmbarazadas] = useState(inicial?.vulnerables.embarazadas ?? 0);
  const [mayores, setMayores] = useState(inicial?.vulnerables.adultos_mayores ?? 0);
  const [discapacidad, setDiscapacidad] = useState(inicial?.vulnerables.discapacidad ?? 0);
  const [notas, setNotas] = useState(inicial?.notas ?? "");

  function agregarResponsable() {
    setResponsables((prev) => [
      ...prev,
      { id: nuevoId(), nombre: "", telefono: "", categoria: "funcionario", funcion: "" },
    ]);
  }
  function actualizarResponsable(id: string, patch: Partial<Responsable>) {
    setResponsables((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function eliminarResponsable(id: string) {
    setResponsables((prev) => prev.filter((r) => r.id !== id));
  }

  function guardar() {
    onGuardar({
      id: inicial?.id,
      nombre: nombre.trim() || "Sector",
      geom,
      color,
      responsables: responsables
        .filter((r) => r.nombre.trim() || r.telefono.trim())
        .map((r) => ({ ...r, nombre: r.nombre.trim(), telefono: r.telefono.trim(), funcion: r.funcion.trim() })),
      poblacion_estimada: poblacion,
      familias,
      vulnerables: { ninos, embarazadas, adultos_mayores: mayores, discapacidad },
      notas: notas.trim(),
    });
  }

  return (
    <Modal titulo={inicial ? "Editar sector" : "Nuevo sector"} onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nombre / código</label>
            <input
              className={inputCls}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: A, B, Sector Norte…"
            />
          </div>
          <div>
            <label className={labelCls}>Población estimada</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={poblacion}
              onChange={(e) => setPoblacion(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Color del sector */}
        <div>
          <label className={labelCls}>Color del sector</label>
          <div className="flex flex-wrap items-center gap-2">
            {SECTOR_COLORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${
                  color === c ? "border-white" : "border-transparent"
                }`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
            <label className="ml-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-600 text-xs text-slate-300">
              +
              <input
                type="color"
                className="sr-only"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nº de familias</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={familias}
              onChange={(e) => setFamilias(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Responsables */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={labelCls + " mb-0"}>
              Responsables ({responsables.length})
            </label>
            <button
              type="button"
              onClick={agregarResponsable}
              className="rounded-md bg-teal-600/20 px-2 py-1 text-xs font-medium text-teal-300 hover:bg-teal-600/30"
            >
              + Agregar
            </button>
          </div>

          {responsables.length === 0 && (
            <p className="text-xs text-slate-500">
              Sin responsables. Agrega los encargados por función (censo, basura,
              baños, coordinación…).
            </p>
          )}

          <div className="space-y-2">
            {responsables.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-700 bg-slate-800/40 p-2">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    className={inputCls}
                    value={r.nombre}
                    onChange={(e) => actualizarResponsable(r.id, { nombre: e.target.value })}
                    placeholder="Nombre y apellido"
                  />
                  {r.telefono.trim() && (
                    <div className="flex gap-1">
                      <a
                        href={`tel:${r.telefono.replace(/[^\d+]/g, "")}`}
                        className="rounded-md bg-slate-700 px-2 py-1.5 text-sm hover:bg-slate-600"
                        title="Llamar"
                      >
                        📞
                      </a>
                      <a
                        href={`https://wa.me/${r.telefono.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-green-700/60 px-2 py-1.5 text-sm hover:bg-green-700"
                        title="WhatsApp"
                      >
                        💬
                      </a>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => eliminarResponsable(r.id)}
                    className="rounded-md px-2 py-1.5 text-sm text-red-300 hover:bg-red-950"
                    title="Quitar"
                  >
                    🗑
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputCls}
                    value={r.telefono}
                    onChange={(e) => actualizarResponsable(r.id, { telefono: e.target.value })}
                    placeholder="Teléfono"
                    inputMode="tel"
                  />
                  <select
                    className={inputCls}
                    value={r.categoria}
                    onChange={(e) =>
                      actualizarResponsable(r.id, {
                        categoria: e.target.value as Responsable["categoria"],
                      })
                    }
                  >
                    {CATEGORIAS_RESPONSABLE.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  className={inputCls + " mt-2"}
                  list="funciones-comunes"
                  value={r.funcion}
                  onChange={(e) => actualizarResponsable(r.id, { funcion: e.target.value })}
                  placeholder="Función (ej: Recolección de basura)"
                />
              </div>
            ))}
          </div>
          <datalist id="funciones-comunes">
            {FUNCIONES_COMUNES.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>

        {/* Grupos vulnerables */}
        <div>
          <label className={labelCls}>Grupos vulnerables</label>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Niños/as" value={ninos} onChange={setNinos} />
            <NumField label="Embarazadas" value={embarazadas} onChange={setEmbarazadas} />
            <NumField label="Adultos mayores" value={mayores} onChange={setMayores} />
            <NumField label="Discapacidad" value={discapacidad} onChange={setDiscapacidad} />
          </div>
        </div>

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
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500">Solo lectura</span>
            <button className={btnSecundario} onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-1">
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

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5">
      <span className="text-xs text-slate-300">{label}</span>
      <input
        type="number"
        min={0}
        className="w-16 rounded bg-slate-700 px-2 py-1 text-right text-sm text-slate-100 outline-none"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
