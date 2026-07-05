// Sección de dotaciones/beneficios en la ficha de refugiado.

import { useEffect, useState } from "react";
import { AlertTriangle, Gift, Trash2 } from "lucide-react";
import {
  CATALOGO_BENEFICIOS,
  etiquetaBeneficio,
  META_BENEFICIO,
  yaRecibioBeneficio,
  type BeneficioOtorgado,
  type TipoBeneficio,
} from "@/domain/beneficios";
import {
  eliminarBeneficio,
  listarBeneficiosRefugiado,
  otorgarBeneficio,
} from "@/data/reposRefugiados";
import { claveDia } from "@/data/reposSupabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface Props {
  refugiadoId: string;
  centroId: string;
  puedeEditar: boolean;
  nombresCentros?: Map<string, string>;
  beneficiosExternos?: BeneficioOtorgado[];
  cargandoExterno?: boolean;
  /** Refetch del padre cuando la lista es externa; se llama tras cada mutación. */
  onMutado?: () => Promise<void> | void;
  /** Oculta el formulario legacy (solo historial + anular). */
  soloHistorial?: boolean;
}

export function BeneficiosRefugiadoSection({
  refugiadoId,
  centroId,
  puedeEditar,
  nombresCentros,
  beneficiosExternos,
  cargandoExterno,
  onMutado,
  soloHistorial = false,
}: Props) {
  const [beneficios, setBeneficios] = useState<BeneficioOtorgado[]>(beneficiosExternos ?? []);
  const [cargando, setCargando] = useState(cargandoExterno ?? true);
  const [tipo, setTipo] = useState<TipoBeneficio>("colchon");
  const [cantidad, setCantidad] = useState("1");
  const [fecha, setFecha] = useState(() => claveDia(Date.now()));
  const [observacion, setObservacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [confirmandoAnularId, setConfirmandoAnularId] = useState<string | null>(null);
  const [errorAnular, setErrorAnular] = useState<string | null>(null);
  const [legacyAbierto, setLegacyAbierto] = useState(false);

  async function recargar() {
    if (beneficiosExternos) return;
    setCargando(true);
    try {
      const lista = await listarBeneficiosRefugiado(refugiadoId);
      setBeneficios(lista);
    } catch (err) {
      console.error("[BeneficiosRefugiado]", err);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (beneficiosExternos) {
      setBeneficios(beneficiosExternos);
      setCargando(Boolean(cargandoExterno));
      return;
    }
    void recargar();
  }, [refugiadoId, beneficiosExternos, cargandoExterno]);

  const previo = yaRecibioBeneficio(beneficios, tipo);

  async function registrarLegacy(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await otorgarBeneficio({
        refugiado_id: refugiadoId,
        centro_id: centroId,
        tipo,
        cantidad: Math.max(1, parseInt(cantidad, 10) || 1),
        fecha,
        observacion,
      });
      setObservacion("");
      if (beneficiosExternos) {
        await onMutado?.();
      } else {
        await recargar();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar beneficio");
    } finally {
      setGuardando(false);
    }
  }

  async function anularEntrega(b: BeneficioOtorgado): Promise<boolean> {
    setError(null);
    setErrorAnular(null);
    setEliminandoId(b.id);
    try {
      await eliminarBeneficio(b.id);
      if (beneficiosExternos) {
        await onMutado?.();
      } else {
        await recargar();
      }
      setConfirmandoAnularId(null);
      return true;
    } catch (err) {
      setErrorAnular(err instanceof Error ? err.message : "No se pudo anular la entrega");
      return false;
    } finally {
      setEliminandoId(null);
    }
  }

  const listaCargando = cargandoExterno ?? cargando;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Gift className="size-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Historial de entregas</h4>
      </div>

      {listaCargando ? (
        <p className="text-xs text-muted-foreground">Cargando historial…</p>
      ) : beneficios.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin dotaciones registradas.</p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
          {beneficios.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
            >
              <Badge variant="outline" className="text-[10px]">
                {etiquetaBeneficio(b)}
              </Badge>
              {b.talla && <span className="text-muted-foreground">talla {b.talla}</span>}
              <span className="tabular-nums">×{b.cantidad}</span>
              <span className="text-muted-foreground">{b.fecha}</span>
              {nombresCentros?.get(b.centro_id) && (
                <span className="truncate text-muted-foreground">
                  · {nombresCentros.get(b.centro_id)}
                </span>
              )}
              {puedeEditar && (
                <AlertDialog
                  open={confirmandoAnularId === b.id}
                  onOpenChange={(open) => {
                    setConfirmandoAnularId(open ? b.id : null);
                    if (!open) setErrorAnular(null);
                  }}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7 gap-1 px-2 text-[10px] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      disabled={eliminandoId === b.id}
                      onClick={() => setConfirmandoAnularId(b.id)}
                    >
                      <Trash2 className="size-3" />
                      Anular
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Anular esta entrega?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se quitará del historial y volverá a aparecer como pendiente en el kit:{" "}
                        <strong>{etiquetaBeneficio(b)}</strong>
                        {b.talla ? ` talla ${b.talla}` : ""} ×{b.cantidad} ({b.fecha}).
                        La acción queda registrada en la bitácora.
                      </AlertDialogDescription>
                      {errorAnular && confirmandoAnularId === b.id && (
                        <p className="text-xs text-destructive">{errorAnular}</p>
                      )}
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        type="button"
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={eliminandoId === b.id}
                        onClick={(e) => {
                          e.preventDefault();
                          void anularEntrega(b);
                        }}
                      >
                        {eliminandoId === b.id ? "Anulando…" : "Anular entrega"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {puedeEditar && !soloHistorial && (
        <details
          className="rounded-lg border border-border/60 bg-muted/10"
          open={legacyAbierto}
          onToggle={(e) => setLegacyAbierto(e.currentTarget.open)}
        >
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            Otros beneficios (carpa, colchón, litera…)
          </summary>
          <form onSubmit={(e) => void registrarLegacy(e)} className="space-y-2 border-t border-border/60 p-3">
            {previo && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="size-4" />
                <AlertTitle className="text-xs">Ya recibió {META_BENEFICIO[tipo]?.label}</AlertTitle>
                <AlertDescription className="text-[11px]">
                  Entregado el {previo.fecha}
                </AlertDescription>
              </Alert>
            )}
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoBeneficio)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATALOGO_BENEFICIOS.map((b) => (
                  <SelectItem key={b.valor} value={b.valor}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Cantidad</Label>
                <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Fecha</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <Textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} className="text-xs" placeholder="Observación" />
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={guardando}>
              {guardando ? "Guardando…" : "Registrar beneficio"}
            </Button>
          </form>
        </details>
      )}
    </div>
  );
}
