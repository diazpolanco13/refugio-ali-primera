import { useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  Fingerprint,
  IdCard,
  Pencil,
  Phone,
  Send,
  Shield,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type { Rol } from "@/data/authSupabase";
import { useCatalogoCuerposActivos } from "@/data/useCuerposPoliciales";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { BadgeRol } from "@/components/BadgeRol";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/** Fila de `perfiles` usada en la ficha de usuario. */
export interface UsuarioPerfil {
  user_id: string;
  username: string | null;
  nombre: string | null;
  rol: Rol;
  centros_asignados: string[] | null;
  ambito_analista?: "red" | "cuerpo" | "centros" | null;
  cuerpo_asignado?: string | null;
  jerarquia: string | null;
  cedula: string | null;
  responsabilidad: string | null;
  whatsapp: string | null;
  telegram: string | null;
  brazalete: string | null;
  hash_id: string | null;
  marca_agua: boolean;
  created_at?: string;
}

const CHIPS_VISIBLES = 3;

/** Etiqueta corta: "N.° 12 · Nombre". */
export function etiquetaCentro(
  centro: CentroTransitorio | undefined,
  id: string,
): string {
  if (!centro) return id;
  return `${centro.nro != null ? `N.° ${centro.nro} · ` : ""}${centro.nombre}`;
}

function DatoFicha({
  icono,
  children,
}: {
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {icono}
      {children}
    </span>
  );
}

function ChipCentro({
  etiqueta,
}: {
  etiqueta: string;
}) {
  return (
    <Badge
      variant="outline"
      className="gap-1 text-[10px] text-muted-foreground"
    >
      <Building2 className="size-3" />
      <span className="max-w-44 truncate">{etiqueta}</span>
    </Badge>
  );
}

type Props = {
  usuario: UsuarioPerfil;
  esYo: boolean;
  centros: CentroTransitorio[];
  onEditar: () => void;
  onEliminar?: () => void;
};

/** Ficha de usuario con centros colapsables (máx. 3 chips visibles). */
export function TarjetaUsuario({
  usuario,
  esYo,
  centros,
  onEditar,
  onEliminar,
}: Props) {
  const [centrosAbiertos, setCentrosAbiertos] = useState(false);
  const cuerposCatalogo = useCatalogoCuerposActivos();
  const alcancePorCuerpo =
    usuario.ambito_analista === "cuerpo" && usuario.cuerpo_asignado
      ? (cuerposCatalogo.find((c) => c.clave === usuario.cuerpo_asignado)?.label ??
        usuario.cuerpo_asignado)
      : null;
  const porId = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros]);
  const asignados = usuario.centros_asignados ?? [];
  const tieneTodaLaRed =
    centros.length > 0 && centros.every((c) => asignados.includes(c.id));
  const ocultos = Math.max(0, asignados.length - CHIPS_VISIBLES);
  const visibles = asignados.slice(0, CHIPS_VISIBLES);
  const resto = asignados.slice(CHIPS_VISIBLES);

  return (
    <Card size="sm" className="py-3">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className="truncate">{usuario.nombre || usuario.username}</span>
              {esYo && (
                <Badge
                  variant="outline"
                  className="border-primary/40 text-[10px] text-primary"
                >
                  tú
                </Badge>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              @{usuario.username}
              {usuario.jerarquia && <> · {usuario.jerarquia}</>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="outline" onClick={onEditar}>
              <Pencil className="size-3" />
              Editar
            </Button>
            {onEliminar && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={onEliminar}
                title="Eliminar usuario"
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <BadgeRol rol={usuario.rol} />
          {alcancePorCuerpo && (
            <Badge
              variant="outline"
              className="gap-1 border-sky-500/40 text-[10px] text-sky-400"
              title="Alcance dinámico: todos los campamentos supervisados por unidades de este cuerpo"
            >
              <Shield className="size-3" />
              {alcancePorCuerpo} — todo el cuerpo
            </Badge>
          )}
          {usuario.hash_id && (
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 font-mono text-[10px] tracking-wider text-primary"
            >
              <Fingerprint className="size-3" />
              {usuario.hash_id}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              "gap-1 text-[10px]",
              usuario.marca_agua
                ? "border-emerald-500/40 text-emerald-400"
                : "border-amber-500/40 text-amber-400",
            )}
            title="Marca de agua de seguridad"
          >
            <ShieldAlert className="size-3" />
            {usuario.marca_agua ? "Marca ON" : "Marca OFF"}
          </Badge>
        </div>

        {asignados.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {tieneTodaLaRed ? (
              <Badge
                variant="outline"
                className="gap-1 border-primary/40 text-[10px] text-primary"
              >
                <Building2 className="size-3" />
                Toda la red ({centros.length} campamentos)
              </Badge>
            ) : (
              <Collapsible open={centrosAbiertos} onOpenChange={setCentrosAbiertos}>
                <div className="flex flex-wrap gap-1">
                  {visibles.map((id) => (
                    <ChipCentro
                      key={id}
                      etiqueta={etiquetaCentro(porId.get(id), id)}
                    />
                  ))}
                </div>
                {ocultos > 0 && (
                  <>
                    <CollapsibleContent>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {resto.map((id) => (
                          <ChipCentro
                            key={id}
                            etiqueta={etiquetaCentro(porId.get(id), id)}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 gap-1 px-2 text-[11px] text-muted-foreground"
                      >
                        <ChevronDown
                          className={cn(
                            "size-3.5 transition-transform",
                            centrosAbiertos && "rotate-180",
                          )}
                        />
                        {centrosAbiertos
                          ? "Ocultar centros"
                          : `Ver ${ocultos} centro${ocultos === 1 ? "" : "s"} más`}
                      </Button>
                    </CollapsibleTrigger>
                  </>
                )}
              </Collapsible>
            )}
          </div>
        )}

        {(usuario.responsabilidad ||
          usuario.cedula ||
          usuario.brazalete ||
          usuario.whatsapp ||
          usuario.telegram) && (
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2.5">
            {usuario.responsabilidad && (
              <DatoFicha icono={<BadgeCheck className="size-3" />}>
                {usuario.responsabilidad}
              </DatoFicha>
            )}
            {usuario.cedula && (
              <DatoFicha icono={<IdCard className="size-3" />}>{usuario.cedula}</DatoFicha>
            )}
            {usuario.brazalete && (
              <DatoFicha icono={<BadgeCheck className="size-3" />}>
                Brazalete {usuario.brazalete}
              </DatoFicha>
            )}
            {usuario.whatsapp && (
              <DatoFicha icono={<Phone className="size-3" />}>{usuario.whatsapp}</DatoFicha>
            )}
            {usuario.telegram && (
              <DatoFicha icono={<Send className="size-3" />}>{usuario.telegram}</DatoFicha>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
