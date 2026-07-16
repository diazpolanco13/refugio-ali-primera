// PostgREST devuelve MÁXIMO 1000 filas por consulta (límite del servidor,
// silencioso: no hay error, solo faltan filas). Con 61+ campamentos y datos
// diarios, las ventanas de 30 días ya lo superan (ocupaciones_centros cruzó
// las 1000 el 16-jul y los centros "cortados" aparecían como reporte
// Parcial aunque estuvieran completos). Este helper trae TODAS las filas en
// páginas de 1000.

const PAGINA = 1000;

/** Lo mínimo que necesitamos de un builder de supabase-js. */
interface ConsultaPaginable<T> {
  range(
    desde: number,
    hasta: number,
  ): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}

/**
 * Ejecuta la consulta paginando con `.range()` hasta agotar las filas.
 * `construir` debe devolver una consulta NUEVA en cada llamada (los builders
 * de supabase-js no son reutilizables tras await) y con `order` estable para
 * que las páginas no se solapen.
 */
export async function selectPaginado<T>(
  construir: () => ConsultaPaginable<T>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const filas: T[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await construir().range(inicio, inicio + PAGINA - 1);
    if (error) return { data: filas, error };
    const lote = (data ?? []) as T[];
    filas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return { data: filas, error: null };
}
