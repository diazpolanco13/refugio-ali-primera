import { useState } from "react";
import {
  CATALOGO_LINEAS,
  META_LINEA_POR_TIPO,
  defaultsLinea,
  type EstiloTrazo,
  type LineaReferencia,
  type TipoLinea,
} from "../../domain/tipos";
import { Modal } from "../../ui/Modal";
import { btnPeligro, btnPrimario, btnSecundario, inputCls, labelCls } from "../../ui/clases";

interface Props {
  geom: GeoJSON.LineString;
  tipoInicial?: TipoLinea;
  inicial?: LineaReferencia;
  soloLectura?: boolean;
  onGuardar: (
    datos: Omit<LineaReferencia, "id" | "updated_at" | "updated_by"> & { id?: string },
  ) => void;
  onEliminar?: () => void;
  onCerrar: () => void;
}

const ESTILOS: { valor: EstiloTrazo; label: string }[] = [
  { valor: "solido", label: "Sólido (calles)" },
  { valor: "punteado", label: "Punteado (límites)" },
  { valor: "guiones", label: "Guiones (senderos)" },
];

export function LineaForm({
  geom,
  tipoInicial = "limite_parque",
  inicial,
  soloLectura = false,
  onGuardar,
  onEliminar,
  onCerrar,
}: Props) {
  const [tipo, setTipo] = useState<TipoLinea>(inicial?.tipo ?? tipoInicial);
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [color, setColor] = useState(inicial?.color ?? defaultsLinea(tipoInicial).color);
  const [estilo, setEstilo] = useState<EstiloTrazo>(
    inicial?.estilo ?? defaultsLinea(tipoInicial).estilo,
  );
  const [ancho, setAncho] = useState(inicial?.ancho ?? defaultsLinea(tipoInicial).ancho);
  const [notas, setNotas] = useState(inicial?.notas ?? "");

  const meta = META_LINEA_POR_TIPO[tipo];

  function cambiarTipo(nuevo: TipoLinea) {
    setTipo(nuevo);
    if (!inicial) {
      const d = defaultsLinea(nuevo);
      setColor(d.color);
      setEstilo(d.estilo);
      setAncho(d.ancho);
    }
  }

  function guardar() {
    onGuardar({
      id: inicial?.id,
      nombre: nombre.trim() || meta.label,
      tipo,
      geom,
      color,
      estilo,
      ancho,
      notas: notas.trim(),
    });
  }

  return (
    <Modal titulo={inicial ? "Editar línea" : "Nueva línea de referencia"} onCerrar={onCerrar}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Tipo de línea</label>
          <select
            className={inputCls}
            value={tipo}
            disabled={soloLectura}
            onChange={(e) => cambiarTipo(e.target.value as TipoLinea)}
          >
            {CATALOGO_LINEAS.map((m) => (
              <option key={m.tipo} value={m.tipo}>
                {m.icono} {m.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Cada tipo usa color y trazo distintos para distinguir límites, calles y caminerías.
          </p>
        </div>

        <div>
          <label className={labelCls}>Nombre / referencia</label>
          <input
            className={inputCls}
            value={nombre}
            disabled={soloLectura}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={meta.label}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 cursor-pointer rounded border border-slate-600 bg-slate-800"
                value={color}
                disabled={soloLectura}
                onChange={(e) => setColor(e.target.value)}
              />
              <input
                className={inputCls}
                value={color}
                disabled={soloLectura}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Grosor (px)</label>
            <input
              type="number"
              min={1}
              max={8}
              step={0.5}
              className={inputCls}
              value={ancho}
              disabled={soloLectura}
              onChange={(e) => setAncho(Number(e.target.value) || 2)}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Estilo de trazo</label>
          <select
            className={inputCls}
            value={estilo}
            disabled={soloLectura}
            onChange={(e) => setEstilo(e.target.value as EstiloTrazo)}
          >
            {ESTILOS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Vista previa del trazo */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2">
          <div className="mb-1 text-[11px] text-slate-500">Vista previa</div>
          <svg width="100%" height="24" aria-hidden>
            <line
              x1="4"
              y1="12"
              x2="96%"
              y2="12"
              stroke={color}
              strokeWidth={ancho}
              strokeDasharray={
                estilo === "punteado" ? "4 4" : estilo === "guiones" ? "10 6" : undefined
              }
            />
          </svg>
        </div>

        <div>
          <label className={labelCls}>Notas</label>
          <textarea
            className={`${inputCls} min-h-[60px] resize-y`}
            value={notas}
            disabled={soloLectura}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {!soloLectura && (
            <button className={btnPrimario} onClick={guardar}>
              Guardar
            </button>
          )}
          <button className={btnSecundario} onClick={onCerrar}>
            {soloLectura ? "Cerrar" : "Cancelar"}
          </button>
          {!soloLectura && onEliminar && (
            <button className={`${btnPeligro} ml-auto`} onClick={onEliminar}>
              Eliminar
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
