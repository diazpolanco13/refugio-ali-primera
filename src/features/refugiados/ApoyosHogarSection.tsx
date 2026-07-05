// Apoyos entregados a la unidad familiar, separados de las dotaciones personales.

import { useState, type FormEvent } from "react";
import { Gift, Home, Trash2 } from "lucide-react";
import {
  CATALOGO_BENEFICIOS_FAMILIARES,
  etiquetaBeneficioFamiliar,
  META_BENEFICIO_FAMILIAR,
  yaRecibioBeneficioFamiliar,
  type BeneficioFamiliar,
  type TipoBeneficioFamiliar,
} from "@/domain/beneficios";
import { eliminarBeneficioFamiliar, otorgarBeneficioFamiliar } from "@/data/reposRefugiados";
import { claveDia } from "@/data/reposSupabase";
import { useBeneficiosFamiliares } from "@/data/useBeneficiosFamiliares";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  familiaId?: string | null;
  centroId: string;
  puedeEditar: boolean;
}

export function ApoyosHogarSection({ familiaId, centroId, puedeEditar }: Props) {
  const { beneficios, cargando, error, recargar } = useBeneficiosFamiliares(familiaId ?? undefined);
  const [tipo, setTipo] = useState<TipoBeneficioFamiliar>("cocina");
  const [cantidad, setCantidad] = useState("1");
  const [fecha, setFecha] = useState(() => claveDia(Date.now()));
  const [observacion, setObservacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [errorMutacion, setErrorMutacion] = useState<string | null>(null);

  const previo = yaRecibioBeneficioFamiliar(beneficios, tipo);

  async function registrar(e: FormEvent) {
    e.preventDefault();
    if (!familiaId) return;
    setGuardando(true);
    setErrorMutacion(null);
    try {
      await otorgarBeneficioFamiliar({
        familia_id: familiaId,
        centro_id: centroId,
        tipo,
        cantidad: Math.max(1, parseInt(cantidad, 10) || 1),
        fecha,
        observacion,
      });
      setObservacion("");
      await recargar();
    } catch (err) {
      setErrorMutacion(err instanceof Error ? err.message : "No se pudo registrar el apoyo del hogar");
    } finally {
      setGuardando(false);
    }
  }

  async function anular(b: BeneficioFamiliar) {
    setEliminandoId(b.id);
    setErrorMutacion(null);
    try {
      await eliminarBeneficioFamiliar(b.id);
      setConfirmandoId(null);
      await recargar();
    } catch (err) {
      setErrorMutacion(err instanceof Error ? err.message : "No se pudo anular el apoyo del hogar");
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Home className="size-4" />
          Apoyos entregados al hogar
        </CardTitle>
        <CardDescription className="text-xs">
          Bienes o apoyos familiares asociados al hogar completo; no cuentan como dotación personal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!familiaId ? (
          <p className="text-sm text-muted-foreground">
            Asigna un hogar para registrar apoyos familiares.
          </p>
        ) : error ? (
          <Alert>
            <Gift className="size-4" />
            <AlertTitle className="text-sm">Apoyos del hogar pendientes de activar</AlertTitle>
            <AlertDescription className="text-xs">
              La tabla de apoyos familiares aún no está disponible en Supabase. El SQL quedó
              versionado para aplicarlo y verificarlo antes de usar esta tarjeta.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {cargando ? (
              <p className="text-xs text-muted-foreground">Cargando apoyos del hogar…</p>
            ) : beneficios.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin apoyos familiares registrados.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {beneficios.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
                  >
                    <Badge variant="outline" className="text-[10px]">
                      {etiquetaBeneficioFamiliar(b)}
                    </Badge>
                    <span className="tabular-nums">×{b.cantidad}</span>
                    <span className="text-muted-foreground">{b.fecha}</span>
                    {b.observacion && <span className="text-muted-foreground">· {b.observacion}</span>}
                    {puedeEditar && (
                      <AlertDialog
                        open={confirmandoId === b.id}
                        onOpenChange={(open) => setConfirmandoId(open ? b.id : null)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-7 gap-1 px-2 text-[10px] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                            disabled={eliminandoId === b.id}
                          >
                            <Trash2 className="size-3" />
                            Anular
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Anular este apoyo del hogar?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se quitará del historial familiar: <strong>{etiquetaBeneficioFamiliar(b)}</strong>{" "}
                              ×{b.cantidad} ({b.fecha}). La acción queda registrada en la bitácora.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              type="button"
                              variant="destructive"
                              disabled={eliminandoId === b.id}
                              onClick={(e) => {
                                e.preventDefault();
                                void anular(b);
                              }}
                            >
                              {eliminandoId === b.id ? "Anulando…" : "Anular apoyo"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {puedeEditar && (
              <form onSubmit={(e) => void registrar(e)} className="space-y-2 rounded-lg border p-3">
                {previo && (
                  <Alert className="py-2">
                    <Gift className="size-4" />
                    <AlertTitle className="text-xs">
                      Este hogar ya recibió {META_BENEFICIO_FAMILIAR[tipo]?.label}
                    </AlertTitle>
                    <AlertDescription className="text-[11px]">
                      Entregado el {previo.fecha}. Verifica antes de registrar otra entrega.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-[10px]">Tipo de apoyo</Label>
                    <Select value={tipo} onValueChange={(v) => setTipo(v as TipoBeneficioFamiliar)}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATALOGO_BENEFICIOS_FAMILIARES.map((b) => (
                          <SelectItem key={b.valor} value={b.valor}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Fecha</Label>
                    <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-1 h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Cantidad</Label>
                    <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="mt-1 h-8 text-xs" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-[10px]">Observación</Label>
                    <Textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} className="mt-1 text-xs" />
                  </div>
                </div>
                <Button type="submit" size="sm" className="h-8 text-xs" disabled={guardando}>
                  {guardando ? "Guardando…" : "Registrar apoyo del hogar"}
                </Button>
              </form>
            )}
          </>
        )}

        {errorMutacion && <p className="text-xs text-destructive">{errorMutacion}</p>}
      </CardContent>
    </Card>
  );
}
