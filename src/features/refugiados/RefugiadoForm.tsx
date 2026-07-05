// Formulario integrado de alta de refugiado con pestañas.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Home, Search, UserPlus, Users } from "lucide-react";
import {
  esMenor,
  normalizarCedula,
  nombreCompleto,
  PARENTESCOS_JEFE,
  type FamiliaCentro,
  type SexoRefugiado,
  type TipoDoc,
} from "@/domain/refugiados";
import {
  buscarRefugiadoPorCedula,
  crearFamilia,
  crearRefugiado,
  guardarResidenciaAfectada,
  listarAlojamientosActivosRefugiado,
  registrarAlojamiento,
} from "@/data/reposRefugiados";
import { subirFotoResidencia, supabaseDisponible } from "@/data/supabase";
import { claveDia } from "@/data/reposSupabase";
import {
  CamposResidenciaAfectada,
  valoresResidenciaVacios,
  type ValoresResidenciaForm,
} from "./CamposResidenciaAfectada";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  centroId: string;
  familias: FamiliaCentro[];
  nombresCentros: Map<string, string>;
  onCancelar: () => void;
  onRegistrado: (alojamientoId: string) => void;
}

export function RefugiadoForm({
  centroId,
  familias,
  nombresCentros,
  onCancelar,
  onRegistrado,
}: Props) {
  const [pestana, setPestana] = useState("identidad");
  const [modoMenor, setModoMenor] = useState(false);
  const [tipoDoc, setTipoDoc] = useState<TipoDoc>("V");
  const [cedulaInput, setCedulaInput] = useState("");
  const [refugiadoExistenteId, setRefugiadoExistenteId] = useState<string | null>(null);
  const [alertasActivos, setAlertasActivos] = useState<string[]>([]);

  const [primerNombre, setPrimerNombre] = useState("");
  const [segundoNombre, setSegundoNombre] = useState("");
  const [primerApellido, setPrimerApellido] = useState("");
  const [segundoApellido, setSegundoApellido] = useState("");
  const [lugarNac, setLugarNac] = useState("");
  const [fechaNac, setFechaNac] = useState("");
  const [sexo, setSexo] = useState<SexoRefugiado | "">("");
  const [embarazada, setEmbarazada] = useState(false);
  const [discapacidad, setDiscapacidad] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [whatsapp, setWhatsapp] = useState(true);
  const [consentimientoFoto, setConsentimientoFoto] = useState(false);
  const [tallaCamisa, setTallaCamisa] = useState("");
  const [tallaPantalon, setTallaPantalon] = useState("");

  const [familiaId, setFamiliaId] = useState<string>("ninguna");
  const [nuevaFamilia, setNuevaFamilia] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(() => claveDia(Date.now()));
  const [itinerante, setItinerante] = useState(false);
  const [esJefe, setEsJefe] = useState(false);

  const [registrarResidencia, setRegistrarResidencia] = useState(false);
  const [valoresResidencia, setValoresResidencia] = useState<ValoresResidenciaForm>(valoresResidenciaVacios);
  const [fotosResidencia] = useState<string[]>([]);
  const [fotosPendientes, setFotosPendientes] = useState<File[]>([]);

  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esMenorActual = useMemo(() => esMenor(fechaNac) || modoMenor, [fechaNac, modoMenor]);
  const tieneFamilia = familiaId !== "ninguna";

  useEffect(() => {
    setError(null);
  }, [pestana]);

  async function buscarCedula() {
    setError(null);
    setBuscando(true);
    try {
      const norm = normalizarCedula(cedulaInput, tipoDoc);
      if (!norm.cedula_norm) {
        setError("Ingrese un documento válido");
        return;
      }
      const existente = await buscarRefugiadoPorCedula(norm.cedula_norm);
      if (existente) {
        setRefugiadoExistenteId(existente.id);
        setPrimerNombre(existente.primer_nombre);
        setSegundoNombre(existente.segundo_nombre);
        setPrimerApellido(existente.primer_apellido);
        setSegundoApellido(existente.segundo_apellido);
        setLugarNac(existente.lugar_nacimiento);
        setFechaNac(existente.fecha_nacimiento ?? "");
        setSexo(existente.sexo ?? "");
        setEmbarazada(Boolean(existente.vulnerabilidades.embarazada));
        setDiscapacidad(Boolean(existente.vulnerabilidades.discapacidad));
        const activos = await listarAlojamientosActivosRefugiado(existente.id);
        const otros = activos
          .filter((a) => a.centro_id !== centroId)
          .map((a) => nombresCentros.get(a.centro_id) ?? a.centro_id);
        setAlertasActivos(otros);
      } else {
        setRefugiadoExistenteId(null);
        setAlertasActivos([]);
      }
      setPestana("personal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setBuscando(false);
    }
  }

  function validarPersonal(): boolean {
    if (!primerNombre.trim()) {
      setError("El primer nombre es obligatorio");
      setPestana("personal");
      return false;
    }
    if (!esMenorActual && !refugiadoExistenteId && !cedulaInput.trim()) {
      setError("El documento es obligatorio para adultos");
      setPestana("identidad");
      return false;
    }
    return true;
  }

  function validarHogar(): boolean {
    if (tieneFamilia && !esJefe && !parentesco.trim()) {
      setError("El parentesco con el jefe de familia es obligatorio para miembros no jefes.");
      setPestana("familia");
      return false;
    }
    return true;
  }

  async function guardar() {
    if (!validarPersonal()) return;
    if (!validarHogar()) return;
    setError(null);
    setGuardando(true);
    try {
      let refId = refugiadoExistenteId;
      if (!refId) {
        refId = await crearRefugiado({
          cedula: esMenorActual ? null : cedulaInput,
          tipo_doc: esMenorActual ? null : tipoDoc,
          primer_nombre: primerNombre,
          segundo_nombre: segundoNombre,
          primer_apellido: primerApellido,
          segundo_apellido: segundoApellido,
          lugar_nacimiento: lugarNac,
          fecha_nacimiento: fechaNac || null,
          sexo: sexo || null,
          vulnerabilidades: { embarazada, discapacidad },
          contacto: telefono ? { telefono_principal: telefono, whatsapp_principal: whatsapp } : undefined,
          tallas: tallaCamisa || tallaPantalon ? { camisa: tallaCamisa, pantalon: tallaPantalon } : undefined,
          consentimiento_foto: consentimientoFoto,
        }, centroId);
      }

      let famId: string | null = familiaId === "ninguna" ? null : familiaId;
      if (familiaId === "nueva" && nuevaFamilia.trim()) {
        famId = await crearFamilia({ centro_id: centroId, nombre: nuevaFamilia.trim() });
      }

      const alojId = await registrarAlojamiento({
        refugiado_id: refId,
        centro_id: centroId,
        familia_id: famId,
        fecha_ingreso: fechaIngreso,
        itinerante,
        es_jefe_familia: esJefe,
        parentesco_jefe: esJefe ? "" : parentesco,
      });

      if (registrarResidencia && famId) {
        const paths = [...fotosResidencia];
        if (fotosPendientes.length > 0 && supabaseDisponible()) {
          for (const file of fotosPendientes) {
            const path = await subirFotoResidencia(centroId, famId, file);
            paths.push(path);
          }
        }
        await guardarResidenciaAfectada({
          familia_id: famId,
          centro_id: centroId,
          pais: valoresResidencia.pais,
          estado_federativo: valoresResidencia.estado_federativo,
          municipio: valoresResidencia.municipio,
          parroquia: valoresResidencia.parroquia,
          sector: valoresResidencia.sector,
          direccion: valoresResidencia.direccion,
          referencia: valoresResidencia.referencia,
          estatus_vivienda: valoresResidencia.estatus_vivienda,
          lat: valoresResidencia.lat,
          lng: valoresResidencia.lng,
          fotos: paths,
          observaciones: valoresResidencia.observaciones,
        });
      }

      onRegistrado(alojId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-3xl space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
        <Tabs value={pestana} onValueChange={setPestana} className="gap-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="identidad" className="gap-1.5">
              <Search className="size-3.5" />
              Identidad
            </TabsTrigger>
            <TabsTrigger value="personal" className="gap-1.5">
              <UserPlus className="size-3.5" />
              Ficha personal
            </TabsTrigger>
            <TabsTrigger value="familia" className="gap-1.5">
              <Users className="size-3.5" />
              Hogar
            </TabsTrigger>
            <TabsTrigger value="residencia" className="gap-1.5" disabled={!tieneFamilia}>
              <Home className="size-3.5" />
              Residencia
            </TabsTrigger>
          </TabsList>

          <TabsContent value="identidad">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="size-4" />
                  Identidad
                </CardTitle>
                <CardDescription>
                  Busque el documento en toda la red antes de crear un registro nuevo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="menor"
                    checked={modoMenor}
                    onCheckedChange={(v) => setModoMenor(Boolean(v))}
                  />
                  <Label htmlFor="menor">Es menor (sin cédula)</Label>
                </div>

                {!modoMenor ? (
                  <>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">Tipo</Label>
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
                      <div className="col-span-3">
                        <Label className="text-xs">Documento</Label>
                        <Input
                          value={cedulaInput}
                          onChange={(e) => setCedulaInput(e.target.value)}
                          placeholder="12345678"
                          className="mt-1 h-9"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full gap-1.5"
                      disabled={buscando}
                      onClick={() => void buscarCedula()}
                    >
                      <Search className="size-4" />
                      {buscando ? "Buscando…" : "Buscar en la red"}
                    </Button>
                  </>
                ) : (
                  <Button type="button" className="w-full" onClick={() => setPestana("personal")}>
                    Continuar como menor
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="personal">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ficha personal</CardTitle>
                <CardDescription>Datos de identidad completos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {alertasActivos.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle className="text-sm">Persona ya registrada en otro campamento</AlertTitle>
                    <AlertDescription className="text-xs">
                      Activo en: {alertasActivos.join(", ")}
                    </AlertDescription>
                  </Alert>
                )}
                {refugiadoExistenteId && (
                  <p className="text-sm text-muted-foreground">
                    Persona encontrada:{" "}
                    {nombreCompleto({
                      primer_nombre: primerNombre,
                      segundo_nombre: segundoNombre,
                      primer_apellido: primerApellido,
                      segundo_apellido: segundoApellido,
                      nombres: "",
                      apellidos: "",
                    })}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Primer nombre *</Label>
                    <Input value={primerNombre} onChange={(e) => setPrimerNombre(e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Segundo nombre</Label>
                    <Input value={segundoNombre} onChange={(e) => setSegundoNombre(e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Primer apellido</Label>
                    <Input value={primerApellido} onChange={(e) => setPrimerApellido(e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Segundo apellido</Label>
                    <Input value={segundoApellido} onChange={(e) => setSegundoApellido(e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Lugar de nacimiento</Label>
                    <Input value={lugarNac} onChange={(e) => setLugarNac(e.target.value)} className="mt-1 h-9" placeholder="Caracas, Miranda…" />
                  </div>
                  <div>
                    <Label className="text-xs">Fecha nacimiento</Label>
                    <Input type="date" value={fechaNac} onChange={(e) => setFechaNac(e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Sexo</Label>
                    <Select value={sexo || "none"} onValueChange={(v) => setSexo(v === "none" ? "" : (v as SexoRefugiado))}>
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
                </div>
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Teléfono</Label>
                    <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="mt-1 h-9" placeholder="0412…" />
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <Checkbox id="wa-alta" checked={whatsapp} onCheckedChange={(v) => setWhatsapp(Boolean(v))} />
                    <Label htmlFor="wa-alta">WhatsApp</Label>
                  </div>
                  <div>
                    <Label className="text-xs">Talla camisa (opc.)</Label>
                    <Input value={tallaCamisa} onChange={(e) => setTallaCamisa(e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Talla pantalón (opc.)</Label>
                    <Input value={tallaPantalon} onChange={(e) => setTallaPantalon(e.target.value)} className="mt-1 h-9" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="cons-alta" checked={consentimientoFoto} onCheckedChange={(v) => setConsentimientoFoto(Boolean(v))} />
                  <Label htmlFor="cons-alta">Consentimiento para foto de identificación</Label>
                </div>
                <Button type="button" className="w-full" onClick={() => { if (validarPersonal()) setPestana("familia"); }}>
                  Siguiente: Hogar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="familia">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hogar y alojamiento en el refugio</CardTitle>
                <CardDescription>
                  Define si la persona pertenece a un hogar del centro y su parentesco con el jefe.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Familia</Label>
                  <Select value={familiaId} onValueChange={setFamiliaId}>
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ninguna">Sin familia</SelectItem>
                      <SelectItem value="nueva">+ Nueva familia…</SelectItem>
                      {familias.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nombre || "Familia sin nombre"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {familiaId === "nueva" && (
                  <div>
                    <Label className="text-xs">Nombre de la familia</Label>
                    <Input
                      value={nuevaFamilia}
                      onChange={(e) => setNuevaFamilia(e.target.value)}
                      placeholder="Familia Pérez"
                      className="mt-1 h-9"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Fecha de ingreso</Label>
                  <Input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} className="mt-1 h-9" />
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <Label className="text-sm">Itinerante</Label>
                  <Switch checked={itinerante} onCheckedChange={setItinerante} />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="jefe" checked={esJefe} onCheckedChange={(v) => setEsJefe(Boolean(v))} />
                  <Label htmlFor="jefe">Jefe de familia</Label>
                </div>
                {!esJefe && tieneFamilia && (
                  <div>
                    <Label className="text-xs">Parentesco con el jefe de familia</Label>
                    <Select value={parentesco || "none"} onValueChange={(v) => setParentesco(v === "none" ? "" : v)}>
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue placeholder="Seleccionar…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {PARENTESCOS_JEFE.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setPestana("personal")}>
                    Atrás
                  </Button>
                  {tieneFamilia ? (
                    <Button type="button" className="flex-1" onClick={() => setPestana("residencia")}>
                      Siguiente: Residencia
                    </Button>
                  ) : (
                    <Button type="button" className="flex-1" disabled={guardando} onClick={() => void guardar()}>
                      {guardando ? "Guardando…" : "Registrar en el refugio"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="residencia">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Residencia afectada</CardTitle>
                <CardDescription>Vivienda de la familia al momento de la emergencia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="reg-res"
                    checked={registrarResidencia}
                    onCheckedChange={(v) => setRegistrarResidencia(Boolean(v))}
                  />
                  <Label htmlFor="reg-res">Registrar residencia afectada ahora</Label>
                </div>

                {registrarResidencia && (
                  <>
                    <CamposResidenciaAfectada
                      valores={valoresResidencia}
                      onChange={(p) => setValoresResidencia((prev) => ({ ...prev, ...p }))}
                      mostrarTenencia={false}
                    />
                    {supabaseDisponible() && (
                      <div>
                        <Label className="text-xs">Fotos de la vivienda</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="mt-1 text-xs"
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files) setFotosPendientes((prev) => [...prev, ...Array.from(files)]);
                            e.target.value = "";
                          }}
                        />
                        {fotosPendientes.length > 0 && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {fotosPendientes.length} foto(s) pendiente(s) de subir
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setPestana("familia")}>
                    Atrás
                  </Button>
                  <Button type="button" className="flex-1" disabled={guardando} onClick={() => void guardar()}>
                    {guardando ? "Guardando…" : "Registrar en el refugio"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end border-t border-border/60 pt-4">
          <Button type="button" variant="ghost" onClick={onCancelar}>
            Cancelar registro
          </Button>
        </div>
      </div>
    </div>
  );
}
