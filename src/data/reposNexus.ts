// Cliente del gateway Nexus (VPN en Dokploy) con caché en Supabase.
// El navegador llama a https://nexus.… con el JWT de la sesión Supabase.
// La API key de Nexus nunca sale del contenedor.
// Cada consulta exitosa se guarda en `nexus_consultas`: la próxima búsqueda de
// esa cédula sale de nuestra base (más rápido y funciona con la VPN caída).

import { supabase } from "./supabaseClient";
import { usuarioActual } from "./reposSupabase";
import type { PersonaNexusCenso } from "@/domain/nexusPersona";

const GATEWAY_URL = (
  import.meta.env.VITE_NEXUS_GATEWAY_URL as string | undefined
)?.replace(/\/$/, "") || "https://nexus.m0n1t0r-d3-3v3nt0s.net";

export function urlGatewayNexus(): string {
  return GATEWAY_URL;
}

/** Busca una persona por cédula (modo slim para censo). Requiere sesión. */
export async function buscarPersonaNexus(
  letra: "V" | "E" | "J",
  cedula: string,
): Promise<PersonaNexusCenso> {
  const digits = cedula.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 12) {
    throw new Error("Cédula inválida");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Inicie sesión o entre con el QR del campamento para consultar cédulas.");
  }

  const url = `${GATEWAY_URL}/v1/person/search/external/full/${letra}/${digits}/censo`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: "{}",
  });

  const texto = await resp.text();
  let json: PersonaNexusCenso | { error?: string; message?: string };
  try {
    json = JSON.parse(texto) as PersonaNexusCenso;
  } catch {
    throw new Error(`Respuesta inválida del gateway (${resp.status})`);
  }

  if (resp.status === 401) {
    throw new Error("Sesión no autorizada para consultar Nexus. Vuelva a entrar.");
  }
  if (resp.status === 404 || (json as PersonaNexusCenso).ok === false) {
    const err = (json as PersonaNexusCenso).error || "no_encontrado";
    if (err === "no_encontrado") {
      throw new Error("No se encontró esa cédula en el registro.");
    }
    throw new Error(`No se pudo obtener la ficha (${err})`);
  }
  if (!resp.ok) {
    throw new Error(
      (json as { error?: string; message?: string }).error ||
        (json as { message?: string }).message ||
        `Error HTTP ${resp.status}`,
    );
  }

  return json as PersonaNexusCenso;
}

/** Ficha para el censo con procedencia: de la caché propia o del gateway. */
export interface FichaNexusCenso {
  persona: PersonaNexusCenso;
  desdeCache: boolean;
  /** Momento (ms) en que se consultó Nexus por última vez para esta cédula. */
  consultadaTs: number | null;
}

async function leerConsultaGuardada(
  letra: string,
  digits: string,
): Promise<{ persona: PersonaNexusCenso; ts: number } | null> {
  const { data, error } = await supabase
    .from("nexus_consultas")
    .select("data, actualizado_ts")
    .eq("letra", letra)
    .eq("cedula", digits)
    .maybeSingle();
  if (error || !data) return null;
  return {
    persona: data.data as PersonaNexusCenso,
    ts: Number(data.actualizado_ts),
  };
}

function guardarConsulta(letra: string, digits: string, persona: PersonaNexusCenso): void {
  // Fire-and-forget: la caché nunca debe romper el flujo de censo.
  void supabase
    .from("nexus_consultas")
    .upsert(
      {
        letra,
        cedula: digits,
        data: persona,
        actualizado_ts: Date.now(),
        actualizado_por: usuarioActual(),
      },
      { onConflict: "letra,cedula" },
    )
    .then(({ error }) => {
      if (error) console.warn("[reposNexus] cache:", error.message);
    });
}

/**
 * Busca la ficha primero en `nexus_consultas` (nuestra BD) y solo si no está
 * consulta el gateway; la respuesta nueva queda guardada para la próxima.
 * `forzarNexus` salta la caché (botón «Reconsultar»).
 */
export async function buscarPersonaNexusConCache(
  letra: "V" | "E" | "J",
  cedula: string,
  opts?: { forzarNexus?: boolean },
): Promise<FichaNexusCenso> {
  const digits = cedula.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 12) {
    throw new Error("Cédula inválida");
  }

  if (!opts?.forzarNexus) {
    const guardada = await leerConsultaGuardada(letra, digits).catch(() => null);
    if (guardada) {
      return { persona: guardada.persona, desdeCache: true, consultadaTs: guardada.ts };
    }
  }

  const persona = await buscarPersonaNexus(letra, digits);
  guardarConsulta(letra, digits, persona);
  return { persona, desdeCache: false, consultadaTs: Date.now() };
}
