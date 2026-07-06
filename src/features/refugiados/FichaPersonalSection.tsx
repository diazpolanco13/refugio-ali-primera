// Sección Personal de la ficha: una sola columna con secciones apiladas.
// Cabecera (foto + datos básicos + situación en el refugio), Identidad y Contacto,
// cada una con edición independiente.

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Phone, Plus, Trash2, User } from "lucide-react";
import {
  calcularEdad,
  formatearCedula,
  META_ESTADO_ALOJAMIENTO,
  type ContactoRefugiado,
  type SexoRefugiado,
  type TelefonoContacto,
  type TipoDoc,
} from "@/domain/refugiados";
import {
  CATALOGO_NACIONALIDADES,
  CATALOGO_TIPOS_ALOJAMIENTO,
  etiquetaTipoAlojamiento,
  normalizarNacionalidad,
  valorTipoAlojamiento,
} from "@/domain/catalogosHumanitarios";
import {
  actualizarAlojamiento,
  actualizarConsentimientoFoto,
  actualizarContacto,
  actualizarRefugiado,
} from "@/data/reposRefugiados";
import { subirFotoRefugiado, supabaseDisponible, urlFotoRefugiado } from "@/data/supabase";
import type { DetalleAlojamiento } from "@/data/useAlojamientoDetalle";
import { SelectCatalogo } from "@/components/SelectCatalogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";

interface Props {
  detalle: DetalleAlojamiento;
  nombreCampamento: string;
  puedeEditar: boolean;
}

const LABEL_SEXO: Record<string, string> = { M: "Masculino", F: "Femenino", O: "Otro" };

export function FichaPersonalSection({ detalle, nombreCampamento, puedeEditar }: Props) {
  return (
    <div className="space-y-4">
      <CabeceraRefugiado
        detalle={detalle}
        nombreCampamento={nombreCampamento}
        puedeEditar={puedeEditar}
      />
      <IdentidadCard detalle={detalle} puedeEditar={puedeEditar} />
      <ContactoCard detalle={detalle} puedeEditar={puedeEditar} />
    </div>
  );
}

/* ── Cabecera: foto + datos básicos + situación en el refugio ─────────────── */

function CabeceraRefugiado({ detalle, nombreCampamento, puedeEditar }: Props) {
  const refugiado = detalle.refugiado;
  const metaEstado = META_ESTADO_ALOJAMIENTO[detalle.estado];
  const edad = calcularEdad(refugiado.fecha_nacimiento);

  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [consentimientoFoto, setConsentimientoFoto] = useState(refugiado.consentimiento_foto);
  const [itinerante, setItinerante] = useState(detalle.itinerante);
  const [plazaModulo, setPlazaModulo] = useState(detalle.plaza_modulo);
  const [tipoAlojamiento, setTipoAlojamiento] = useState(() =>
    valorTipoAlojamiento(detalle.tipo_alojamiento),
  );
  const [tipoDoc, setTipoDoc] = useState<TipoDoc>(refugiado.tipo_doc ?? "V");
  const [cedula, setCedula] = useState(refugiado.cedula ?? "");
  const [fechaNac, setFechaNac] = useState(refugiado.fecha_nacimiento ?? "");
  const [sexo, setSexo] = useState<SexoRefugiado | "">(refugiado.sexo ?? "");
  const [nacionalidad, setNacionalidad] = useState(refugiado.nacionalidad);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!refugiado.foto_url) {
      setFotoUrl(null);
      return;
    }
    void urlFotoRefugiado(refugiado.foto_url).then(setFotoUrl);
  }, [refugiado.foto_url]);

  useEffect(() => {
    setConsentimientoFoto(refugiado.consentimiento_foto);
    setItinerante(detalle.itinerante);
    setPlazaModulo(detalle.plaza_modulo);
    setTipoAlojamiento(valorTipoAlojamiento(detalle.tipo_alojamiento));
    setTipoDoc(refugiado.tipo_doc ?? "V");
    setCedula(refugiado.cedula ?? "");
    setFechaNac(refugiado.fecha_nacimiento ?? "");
    setSexo(refugiado.sexo ?? "");
    setNacionalidad(refugiado.nacionalidad);
  }, [
    refugiado.consentimiento_foto,
    refugiado.tipo_doc,
    refugiado.cedula,
    refugiado.fecha_nacimiento,
    refugiado.sexo,
    refugiado.nacionalidad,
    detalle.itinerante,
    detalle.plaza_modulo,
    detalle.tipo_alojamiento,
  ]);

  async function subirFoto(file: File) {
    if (!supabaseDisponible()) return;
    setSubiendoFoto(true);
    try {
      const path = await subirFotoRefugiado(refugiado.id, file);
      await actualizarConsentimientoFoto(refugiado.id, consentimientoFoto, path);
      const url = await urlFotoRefugiado(path);
      setFotoUrl(url);
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await actualizarConsentimientoFoto(refugiado.id, consentimientoFoto, refugiado.foto_url);
      await actualizarRefugiado(refugiado.id, {
        cedula: cedula || null,
        tipo_doc: cedula ? tipoDoc : null,
        fecha_nacimiento: fechaNac || null,
        sexo: sexo || null,
        nacionalidad: normalizarNacionalidad(nacionalidad),
      });
      if (detalle.estado === "activo") {
        const cambios: Parameters<typeof actualizarAlojamiento>[1] = {};
        if (itinerante !== detalle.itinerante) cambios.itinerante = itinerante;
        if (plazaModulo !== detalle.plaza_modulo) cambios.plaza_modulo = plazaModulo;
        if (tipoAlojamiento !== detalle.tipo_alojamiento) cambios.tipo_alojamiento = tipoAlojamiento;
        if (Object.keys(cambios).length > 0) await actualizarAlojamiento(detalle.id, cambios);
      }
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  const edadEdit = calcularEdad(fechaNac || null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-sm">Perfil en el campamento</CardTitle>
          <CardDescription className="text-xs">
            Identificación rápida y situación en {nombreCampamento}
          </CardDescription>
        </div>
        {puedeEditar && !editando && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 text-xs"
            onClick={() => setEditando(true)}
          >
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editando ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 border-b border-border/60 pb-5 sm:flex-row sm:items-start">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border bg-muted">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <User className="size-10 opacity-40" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 sm:items-start">
                {refugiado.codigo_ficha && (
                  <p className="font-mono text-xs text-sky-400">{refugiado.codigo_ficha}</p>
                )}
                {supabaseDisponible() && (
                  <>
                    <input
                      ref={inputFotoRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void subirFoto(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      disabled={subiendoFoto}
                      onClick={() => inputFotoRef.current?.click()}
                    >
                      <Camera className="size-3.5" />
                      {subiendoFoto ? "Subiendo…" : "Cambiar foto"}
                    </Button>
                  </>
                )}
                <label htmlFor="cons-foto" className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    id="cons-foto"
                    checked={consentimientoFoto}
                    onCheckedChange={(v) => setConsentimientoFoto(Boolean(v))}
                  />
                  <span className="text-xs">Consentimiento para usar la foto</span>
                </label>
              </div>
            </div>

            <section className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Datos básicos
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
                  <div className="w-20 shrink-0">
                    <Label className="text-[10px] text-muted-foreground">Tipo doc.</Label>
                    <Select value={tipoDoc} onValueChange={(v) => setTipoDoc(v as TipoDoc)}>
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="V">V</SelectItem>
                        <SelectItem value="E">E</SelectItem>
                        <SelectItem value="P">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Label className="text-[10px] text-muted-foreground">Documento</Label>
                    <Input
                      value={cedula}
                      onChange={(e) => setCedula(e.target.value)}
                      className="mt-1 h-9"
                      placeholder="12345678"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Fecha de nacimiento</Label>
                  <Input
                    type="date"
                    value={fechaNac}
                    onChange={(e) => setFechaNac(e.target.value)}
                    className="mt-1 h-9"
                  />
                  {edadEdit != null && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{edadEdit} años</p>
                  )}
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Sexo</Label>
                  <Select
                    value={sexo || "none"}
                    onValueChange={(v) => setSexo(v === "none" ? "" : (v as SexoRefugiado))}
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Femenino</SelectItem>
                      <SelectItem value="O">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <SelectCatalogo
                  label="Nacionalidad"
                  value={nacionalidad}
                  opciones={CATALOGO_NACIONALIDADES}
                  onChange={setNacionalidad}
                  className="sm:col-span-2 lg:col-span-1"
                />
              </div>
            </section>

            <section className="space-y-3 border-t border-border/60 pt-5">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Dónde duerme en el campamento
                </h3>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Ubicación física de la persona dentro de {nombreCampamento}. No es la dirección de
                  su casa antes de la emergencia (eso va en la pestaña Residencia).
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" style={{ borderColor: metaEstado.color, color: metaEstado.color }}>
                  {metaEstado.label}
                </Badge>
                {detalle.es_jefe_familia && <Badge variant="outline">Jefe de familia</Badge>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Dato label="Ingreso" valor={detalle.fecha_ingreso} />
                {detalle.familia?.nombre && <Dato label="Familia" valor={detalle.familia.nombre} />}
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Forma de alojamiento</Label>
                <p className="text-[10px] text-muted-foreground/80">
                  ¿Cómo está durmiendo esta persona en el campamento?
                </p>
                <Select
                  value={tipoAlojamiento || "none"}
                  onValueChange={(v) => setTipoAlojamiento(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder="Seleccionar forma…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seleccionar forma…</SelectItem>
                    {CATALOGO_TIPOS_ALOJAMIENTO.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">
                  Ubicación dentro del campamento
                </Label>
                <p className="text-[10px] text-muted-foreground/80">
                  Salón, módulo, litera o referencia interna (ej. &quot;Salón 3, litera B12&quot;)
                </p>
                <Input
                  value={plazaModulo}
                  onChange={(e) => setPlazaModulo(e.target.value)}
                  className="mt-1 h-9"
                  placeholder="Ej: Módulo A · Salón 2 · Litera 14"
                />
              </div>
              {detalle.estado === "activo" && (
                <label
                  htmlFor="itinerante-cab"
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-muted-foreground/50 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/35"
                >
                  <span className="text-xs">
                    <span className="font-medium">Itinerante</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — duerme o trabaja fuera del campamento pero mantiene alojamiento activo
                    </span>
                  </span>
                  <Switch id="itinerante-cab" checked={itinerante} onCheckedChange={setItinerante} />
                </label>
              )}
            </section>

            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" disabled={guardando} onClick={() => void guardar()}>
                {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="mx-auto shrink-0 sm:mx-0">
              <div className="relative size-28 overflow-hidden rounded-xl border bg-muted">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <User className="size-12 opacity-40" />
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {refugiado.codigo_ficha && (
                <p className="font-mono text-xs text-sky-400">{refugiado.codigo_ficha}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Dato label="Documento" valor={formatearCedula(refugiado.cedula, refugiado.tipo_doc)} />
                <Dato label="Edad" valor={edad != null ? `${edad} años` : "—"} />
                <Dato label="Sexo" valor={refugiado.sexo ? LABEL_SEXO[refugiado.sexo] : "—"} />
                <Dato label="Nacionalidad" valor={refugiado.nacionalidad || "—"} />
              </div>
              <Separator />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Situación en el campamento
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" style={{ borderColor: metaEstado.color, color: metaEstado.color }}>
                    {metaEstado.label}
                  </Badge>
                  {detalle.itinerante && (
                    <Badge variant="outline" className="border-sky-500/50 text-sky-400">
                      Itinerante
                    </Badge>
                  )}
                  {detalle.es_jefe_familia && <Badge variant="outline">Jefe de familia</Badge>}
                  {detalle.parentesco_jefe && !detalle.es_jefe_familia && (
                    <Badge variant="outline">{detalle.parentesco_jefe}</Badge>
                  )}
                  {refugiado.vulnerabilidades.embarazada && (
                    <Badge variant="secondary" className="text-[10px]">Embarazada</Badge>
                  )}
                  {refugiado.vulnerabilidades.discapacidad && (
                    <Badge variant="secondary" className="text-[10px]">Discapacidad</Badge>
                  )}
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Dato label="Ingreso" valor={detalle.fecha_ingreso} />
                  {detalle.fecha_egreso && <Dato label="Egreso" valor={detalle.fecha_egreso} />}
                  {detalle.familia?.nombre && <Dato label="Familia" valor={detalle.familia.nombre} />}
                  {detalle.tipo_alojamiento && (
                    <Dato label="Forma de alojamiento" valor={etiquetaTipoAlojamiento(detalle.tipo_alojamiento)} />
                  )}
                  {detalle.plaza_modulo && (
                    <Dato label="Ubicación en campamento" valor={detalle.plaza_modulo} />
                  )}
                </div>
              </div>
              {refugiado.consentimiento_foto && (
                <p className="text-[10px] text-muted-foreground">Consentimiento de foto registrado</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Identidad ────────────────────────────────────────────────────────────── */

function IdentidadCard({ detalle, puedeEditar }: { detalle: DetalleAlojamiento; puedeEditar: boolean }) {
  const refugiado = detalle.refugiado;

  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [primerNombre, setPrimerNombre] = useState(refugiado.primer_nombre);
  const [segundoNombre, setSegundoNombre] = useState(refugiado.segundo_nombre);
  const [primerApellido, setPrimerApellido] = useState(refugiado.primer_apellido);
  const [segundoApellido, setSegundoApellido] = useState(refugiado.segundo_apellido);
  const [lugarNac, setLugarNac] = useState(refugiado.lugar_nacimiento);
  const [embarazada, setEmbarazada] = useState(Boolean(refugiado.vulnerabilidades.embarazada));
  const [discapacidad, setDiscapacidad] = useState(Boolean(refugiado.vulnerabilidades.discapacidad));
  const [apodo, setApodo] = useState(refugiado.apodo);

  useEffect(() => {
    setPrimerNombre(refugiado.primer_nombre);
    setSegundoNombre(refugiado.segundo_nombre);
    setPrimerApellido(refugiado.primer_apellido);
    setSegundoApellido(refugiado.segundo_apellido);
    setLugarNac(refugiado.lugar_nacimiento);
    setEmbarazada(Boolean(refugiado.vulnerabilidades.embarazada));
    setDiscapacidad(Boolean(refugiado.vulnerabilidades.discapacidad));
    setApodo(refugiado.apodo);
  }, [refugiado]);

  async function guardar() {
    if (!primerNombre.trim()) {
      setError("El primer nombre es obligatorio");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await actualizarRefugiado(refugiado.id, {
        primer_nombre: primerNombre,
        segundo_nombre: segundoNombre,
        primer_apellido: primerApellido,
        segundo_apellido: segundoApellido,
        lugar_nacimiento: lugarNac,
        vulnerabilidades: { embarazada, discapacidad },
        apodo,
      });
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  const soloLectura = !puedeEditar || !editando;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-sm">Identidad</CardTitle>
          <CardDescription className="text-xs">Nombres, apodo y lugar de nacimiento</CardDescription>
        </div>
        {puedeEditar && !editando && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditando(true)}>
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CampoInput label="Primer nombre *" value={primerNombre} onChange={setPrimerNombre} disabled={soloLectura} />
          <CampoInput label="Segundo nombre" value={segundoNombre} onChange={setSegundoNombre} disabled={soloLectura} />
          <CampoInput label="Primer apellido" value={primerApellido} onChange={setPrimerApellido} disabled={soloLectura} />
          <CampoInput label="Segundo apellido" value={segundoApellido} onChange={setSegundoApellido} disabled={soloLectura} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CampoInput label="Apodo" value={apodo} onChange={setApodo} disabled={soloLectura} />
          <CampoInput label="Lugar de nacimiento" value={lugarNac} onChange={setLugarNac} disabled={soloLectura} className="sm:col-span-3" />
        </div>

        {!soloLectura && (
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="emb" checked={embarazada} onCheckedChange={(v) => setEmbarazada(Boolean(v))} />
              <Label htmlFor="emb">Embarazada</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="disc" checked={discapacidad} onCheckedChange={(v) => setDiscapacidad(Boolean(v))} />
              <Label htmlFor="disc">Discapacidad</Label>
            </div>
          </div>
        )}

        {editando && (
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={guardando} onClick={() => void guardar()}>
              {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

/* ── Contacto ─────────────────────────────────────────────────────────────── */

function ContactoCard({ detalle, puedeEditar }: { detalle: DetalleAlojamiento; puedeEditar: boolean }) {
  const contacto = detalle.refugiado.contacto;

  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState<ContactoRefugiado>(() => ({
    ...contacto,
    telefonos_alternos: contacto.telefonos_alternos ?? [],
  }));

  useEffect(() => {
    setForm({ ...contacto, telefonos_alternos: contacto.telefonos_alternos ?? [] });
  }, [contacto]);

  async function guardar() {
    setGuardando(true);
    try {
      await actualizarContacto(detalle.refugiado.id, form);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  function setAlterno(i: number, cambios: Partial<TelefonoContacto>) {
    setForm((p) => ({
      ...p,
      telefonos_alternos: (p.telefonos_alternos ?? []).map((t, j) => (j === i ? { ...t, ...cambios } : t)),
    }));
  }

  const soloLectura = !puedeEditar || !editando;
  const alternos = (soloLectura ? contacto.telefonos_alternos : form.telefonos_alternos) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Phone className="size-4" />
            Contacto
          </CardTitle>
          <CardDescription className="text-xs">Teléfonos, correo y contacto de emergencia</CardDescription>
        </div>
        {puedeEditar && !editando && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditando(true)}>
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {soloLectura ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <span className="text-[10px] text-muted-foreground">Teléfono principal</span>
              <p className="flex items-center gap-1.5 font-medium">
                {contacto.telefono_principal || "—"}
                {contacto.telefono_principal && contacto.whatsapp_principal && (
                  <Badge variant="outline" className="text-[10px]">WhatsApp</Badge>
                )}
              </p>
            </div>
            {alternos.map((t, i) => (
              <div key={i}>
                <span className="text-[10px] text-muted-foreground">Teléfono alterno</span>
                <p className="flex items-center gap-1.5 font-medium">
                  {t.numero}
                  {t.whatsapp && <Badge variant="outline" className="text-[10px]">WhatsApp</Badge>}
                </p>
              </div>
            ))}
            <Dato label="Email" valor={contacto.email || "—"} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Teléfono principal</Label>
                <Input
                  value={form.telefono_principal ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, telefono_principal: e.target.value }))}
                  className="mt-1 h-9"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    id="wa"
                    checked={Boolean(form.whatsapp_principal)}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, whatsapp_principal: Boolean(v) }))}
                  />
                  <Label htmlFor="wa" className="text-xs">Es WhatsApp</Label>
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Email</Label>
                <Input
                  value={form.email ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="mt-1 h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground">Teléfonos alternos</Label>
              {alternos.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={t.numero}
                    placeholder="Número"
                    className="h-9 flex-1"
                    onChange={(e) => setAlterno(i, { numero: e.target.value })}
                  />
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id={`wa-alt-${i}`}
                      checked={Boolean(t.whatsapp)}
                      onCheckedChange={(v) => setAlterno(i, { whatsapp: Boolean(v) })}
                    />
                    <Label htmlFor={`wa-alt-${i}`} className="text-xs">WA</Label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-rose-400"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        telefonos_alternos: (p.telefonos_alternos ?? []).filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    telefonos_alternos: [...(p.telefonos_alternos ?? []), { numero: "" }],
                  }))
                }
              >
                <Plus className="size-3.5" /> Agregar teléfono
              </Button>
            </div>
          </>
        )}

        <Separator />

        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Emergencia</p>
          {soloLectura ? (
            <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-2">
              <Dato label="Contacto de emergencia" valor={contacto.contacto_emergencia || "—"} />
              <Dato label="Teléfono de emergencia" valor={contacto.telefono_emergencia || "—"} />
              {contacto.tiene_acceso_telefono === false && (
                <Badge variant="secondary" className="self-center text-[10px]">
                  Sin acceso a teléfono
                </Badge>
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Contacto de emergencia</Label>
                  <Input
                    value={form.contacto_emergencia ?? ""}
                    placeholder="Nombre y parentesco"
                    onChange={(e) => setForm((p) => ({ ...p, contacto_emergencia: e.target.value }))}
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Teléfono de emergencia</Label>
                  <Input
                    value={form.telefono_emergencia ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, telefono_emergencia: e.target.value }))}
                    className="mt-1 h-9"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="acceso-tel"
                  checked={form.tiene_acceso_telefono !== false}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, tiene_acceso_telefono: Boolean(v) }))}
                />
                <Label htmlFor="acceso-tel" className="text-xs">Tiene acceso a teléfono</Label>
              </div>
            </div>
          )}
        </div>

        {editando && (
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={guardando} onClick={() => void guardar()}>
              {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Helpers de presentación ──────────────────────────────────────────────── */

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <p className="text-sm font-medium">{valor}</p>
    </div>
  );
}

function Campo({ label, valor, className }: { label: string; valor: string; className?: string }) {
  return (
    <div className={className}>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <p className="font-medium">{valor}</p>
    </div>
  );
}

function CampoInput({
  label,
  value,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (disabled) {
    return <Campo label={label} valor={value || "—"} className={className} />;
  }
  return (
    <div className={className}>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-9" />
    </div>
  );
}
