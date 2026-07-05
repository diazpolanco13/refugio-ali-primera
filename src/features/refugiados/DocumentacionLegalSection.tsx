// Documentación personal: catálogo fijo (cédula, partida, pasaporte, licencia)
// con estado por documento, para contabilizar operativos de emisión.

import { useState } from "react";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import {
  CATALOGO_DOCUMENTOS_PERSONALES,
  documentosPorTramitar,
  ESTADOS_DOCUMENTO,
  ESTADOS_DOCUMENTO_PERSONAL,
  type DocumentacionRefugiado,
  type DocumentoPerdido,
  type EstadoDocumentoPersonal,
  type TipoDocumentoPersonal,
} from "@/domain/refugiados";
import { actualizarDocumentacion } from "@/data/reposRefugiados";
import type { DetalleAlojamiento } from "@/data/useAlojamientoDetalle";
import { cn } from "@/lib/utils";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  detalle: DetalleAlojamiento;
  puedeEditar: boolean;
}

const CLASES_ESTADO: Record<EstadoDocumentoPersonal, string> = {
  vigente: "border-emerald-500/50 text-emerald-400",
  en_tramite: "border-sky-500/50 text-sky-400",
  perdida: "border-rose-500/50 text-rose-400",
  danada: "border-amber-500/50 text-amber-400",
  no_posee: "border-border text-muted-foreground",
};

function etiquetaEstado(estado: EstadoDocumentoPersonal): string {
  return ESTADOS_DOCUMENTO_PERSONAL.find((e) => e.valor === estado)?.label ?? estado;
}

export function DocumentacionLegalSection({ detalle, puedeEditar }: Props) {
  const d = detalle.refugiado.documentacion;
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState<DocumentacionRefugiado>(() => ({
    ...d,
    documentos: { ...d.documentos },
    documentos_perdidos: d.documentos_perdidos ?? [],
  }));

  function empezarEdicion() {
    setForm({ ...d, documentos: { ...d.documentos }, documentos_perdidos: d.documentos_perdidos ?? [] });
    setEditando(true);
  }

  async function guardar() {
    setGuardando(true);
    try {
      await actualizarDocumentacion(detalle.refugiado.id, form);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  function setEstadoDoc(tipo: TipoDocumentoPersonal, estado: EstadoDocumentoPersonal | null) {
    setForm((p) => {
      const docs = { ...p.documentos };
      if (estado) docs[tipo] = estado;
      else delete docs[tipo];
      return { ...p, documentos: docs };
    });
  }

  const soloLectura = !puedeEditar || !editando;
  const datos = soloLectura ? d : form;
  const porTramitar = documentosPorTramitar(datos);
  const otros = datos.documentos_perdidos ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="size-4" />
            Documentación
          </CardTitle>
          <CardDescription className="text-xs">
            Estado de los documentos personales para operativos de emisión
          </CardDescription>
        </div>
        {puedeEditar && !editando && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={empezarEdicion}>
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {porTramitar.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            {porTramitar.length === 1 ? "1 documento" : `${porTramitar.length} documentos`} por
            reponer:{" "}
            {porTramitar
              .map((t) => CATALOGO_DOCUMENTOS_PERSONALES.find((c) => c.valor === t)?.label ?? t)
              .join(", ")}
          </div>
        )}

        <div className="divide-y divide-border/60 rounded-lg border">
          {CATALOGO_DOCUMENTOS_PERSONALES.map(({ valor, label }) => {
            const estado = datos.documentos?.[valor];
            return (
              <div key={valor} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm">{label}</span>
                {soloLectura ? (
                  estado ? (
                    <Badge variant="outline" className={cn("text-[10px]", CLASES_ESTADO[estado])}>
                      {etiquetaEstado(estado)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin registrar</span>
                  )
                ) : (
                  <Select
                    value={estado ?? "sin_registrar"}
                    onValueChange={(v) =>
                      setEstadoDoc(valor, v === "sin_registrar" ? null : (v as EstadoDocumentoPersonal))
                    }
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sin_registrar">Sin registrar</SelectItem>
                      {ESTADOS_DOCUMENTO_PERSONAL.map((e) => (
                        <SelectItem key={e.valor} value={e.valor}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>

        {(otros.length > 0 || !soloLectura) && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Otros documentos perdidos o dañados</Label>
            {otros.map((doc, i) =>
              soloLectura ? (
                <div key={i} className="flex items-center justify-between gap-3 rounded border px-3 py-2">
                  <span className="text-sm">{doc.tipo || "—"}</span>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", CLASES_ESTADO[doc.estado] ?? "")}
                  >
                    {etiquetaEstado(doc.estado)}
                  </Badge>
                </div>
              ) : (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={doc.tipo}
                    placeholder="Tipo de documento"
                    className="h-9 flex-1"
                    onChange={(e) => {
                      const docs = [...(form.documentos_perdidos ?? [])];
                      docs[i] = { ...docs[i], tipo: e.target.value };
                      setForm((p) => ({ ...p, documentos_perdidos: docs }));
                    }}
                  />
                  <Select
                    value={doc.estado}
                    onValueChange={(v) => {
                      const docs = [...(form.documentos_perdidos ?? [])];
                      docs[i] = { ...docs[i], estado: v as DocumentoPerdido["estado"] };
                      setForm((p) => ({ ...p, documentos_perdidos: docs }));
                    }}
                  >
                    <SelectTrigger className="h-9 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_DOCUMENTO.map((e) => (
                        <SelectItem key={e.valor} value={e.valor}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-rose-400"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        documentos_perdidos: (p.documentos_perdidos ?? []).filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ),
            )}
            {!soloLectura && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    documentos_perdidos: [
                      ...(p.documentos_perdidos ?? []),
                      { tipo: "", estado: "perdida" },
                    ],
                  }))
                }
              >
                <Plus className="size-3.5" /> Agregar otro documento
              </Button>
            )}
          </div>
        )}

        {soloLectura && datos.notas && (
          <>
            <Separator />
            <p className="text-sm text-muted-foreground">{datos.notas}</p>
          </>
        )}
        {!soloLectura && (
          <Textarea
            value={form.notas ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
            placeholder="Notas"
            rows={2}
            className="text-xs"
          />
        )}

        {editando && (
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={guardando} onClick={() => void guardar()}>
              {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
