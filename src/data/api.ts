import { cerrarSesion, getToken, type Sesion } from "./auth";

const BASE = "/api";

export interface FilaSync {
  id: string;
  updated_at: number;
  updated_by?: string | null;
  deleted: boolean;
  data: unknown;
}

export interface RespuestaPull {
  sectores: FilaSync[];
  puntos: FilaSync[];
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

  push(body: { sectores: FilaSync[]; puntos: FilaSync[] }): Promise<{
    serverTime: number;
    aplicados: { sectores: number; puntos: number };
  }> {
    return req("/sync", { method: "POST", body: JSON.stringify(body) });
  },

  historial(entry: {
    accion: string;
    entidad?: string;
    entidad_id?: string;
    detalle?: unknown;
  }): Promise<{ id: string }> {
    return req("/historial", { method: "POST", body: JSON.stringify(entry) });
  },
};
