import { cerrarSesion, getToken, type Rol, type Sesion } from "./auth";

const BASE = "/api";

export interface FilaSync {
  id: string;
  updated_at: number;
  updated_by?: string | null;
  deleted: boolean;
  data: unknown;
}

export interface UsuarioRegistro {
  id: string;
  username: string;
  nombre: string | null;
  rol: Rol;
  sector_asignado: string | null;
  created_at: number;
  jerarquia: string | null;
  cedula: string | null;
  responsabilidad: string | null;
  whatsapp: string | null;
  telegram: string | null;
  brazalete: string | null;
  hash_id: string | null;
  marca_agua: boolean;
}

/** Campos ampliados de la ficha de usuario, todos opcionales. */
export interface DatosFichaUsuario {
  jerarquia?: string;
  cedula?: string;
  responsabilidad?: string;
  whatsapp?: string;
  telegram?: string;
  brazalete?: string;
  marca_agua?: boolean;
}

export interface RespuestaPull {
  sectores: FilaSync[];
  puntos: FilaSync[];
  lineas: FilaSync[];
  censos: FilaSync[];
  distribuciones: FilaSync[];
  limpiezas: FilaSync[];
  serverTime: number;
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...opts, headers });
  if (res.status === 401) {
    cerrarSesion();
    throw new Error("Sesión expirada");
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export const api = {
  async login(username: string, password: string): Promise<Sesion> {
    const res = await fetch(BASE + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || "No se pudo iniciar sesión");
    }
    return res.json() as Promise<Sesion>;
  },

  pull(since: number): Promise<RespuestaPull> {
    return req<RespuestaPull>(`/sync?since=${since}`);
  },

  push(body: {
    sectores: FilaSync[];
    puntos: FilaSync[];
    lineas: FilaSync[];
    censos: FilaSync[];
    distribuciones: FilaSync[];
    limpiezas: FilaSync[];
  }): Promise<{
    serverTime: number;
    aplicados: {
      sectores: number;
      puntos: number;
      lineas: number;
      censos: number;
      distribuciones: number;
      limpiezas: number;
    };
  }> {
    return req("/sync", { method: "POST", body: JSON.stringify(body) });
  },

  purgeMapa(): Promise<{
    ok: boolean;
    serverTime: number;
    borrados: { sectores: number; puntos: number; lineas: number };
  }> {
    return req("/sync/purge", { method: "POST", body: "{}" });
  },

  historial(entry: {
    accion: string;
    entidad?: string;
    entidad_id?: string;
    detalle?: unknown;
  }): Promise<{ id: string }> {
    return req("/historial", { method: "POST", body: JSON.stringify(entry) });
  },

  listarUsuarios(): Promise<UsuarioRegistro[]> {
    return req("/usuarios");
  },

  crearUsuario(
    body: {
      username: string;
      password: string;
      nombre?: string;
      rol?: Rol;
      sector_asignado?: string;
    } & DatosFichaUsuario,
  ): Promise<UsuarioRegistro> {
    return req("/usuarios", { method: "POST", body: JSON.stringify(body) });
  },

  actualizarUsuario(
    id: string,
    body: {
      nombre?: string | null;
      rol?: Rol;
      password?: string;
      sector_asignado?: string | null;
      jerarquia?: string | null;
      cedula?: string | null;
      responsabilidad?: string | null;
      whatsapp?: string | null;
      telegram?: string | null;
      brazalete?: string | null;
      marca_agua?: boolean;
    },
  ): Promise<UsuarioRegistro> {
    return req(`/usuarios/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
};
