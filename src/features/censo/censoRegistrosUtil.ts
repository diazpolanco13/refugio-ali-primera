import type { RegistroCensoGuardado } from "@/data/reposCenso";

export function normalizarBusquedaCenso(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function nombreCompletoRegistro(fila: RegistroCensoGuardado): string {
  return [fila.primer_nombre, fila.segundo_nombre, fila.primer_apellido, fila.segundo_apellido]
    .filter(Boolean)
    .join(" ");
}

export function filtrarRegistrosCenso<T extends RegistroCensoGuardado>(
  filas: T[],
  termino: string,
  extraCampos?: (fila: T) => string[],
): T[] {
  const q = normalizarBusquedaCenso(termino);
  if (!q) return filas;
  return filas.filter((f) => {
    const nombreCompleto = nombreCompletoRegistro(f);
    const doc = [f.tipo_doc, f.documento].filter(Boolean).join("");
    const campos = [
      nombreCompleto,
      f.primer_nombre,
      f.primer_apellido,
      doc,
      f.telefono,
      ...(extraCampos?.(f) ?? []),
    ];
    return campos.some((c) => normalizarBusquedaCenso(c).includes(q));
  });
}

export type OrdenRegistrosCenso = "reciente" | "nombre" | "campamento" | "edad";

export function ordenarRegistrosCenso<T extends RegistroCensoGuardado>(
  filas: T[],
  orden: OrdenRegistrosCenso,
  centroNombre?: (fila: T) => string,
): T[] {
  const copia = [...filas];
  switch (orden) {
    case "nombre":
      return copia.sort((a, b) =>
        nombreCompletoRegistro(a).localeCompare(nombreCompletoRegistro(b), "es"),
      );
    case "campamento":
      return copia.sort((a, b) => {
        const ca = centroNombre?.(a) ?? "";
        const cb = centroNombre?.(b) ?? "";
        return ca.localeCompare(cb, "es") || nombreCompletoRegistro(a).localeCompare(nombreCompletoRegistro(b), "es");
      });
    case "edad":
      return copia.sort((a, b) => (b.edad ?? -1) - (a.edad ?? -1));
    case "reciente":
    default:
      return copia.sort(
        (a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime(),
      );
  }
}

export function estadisticasRegistrosCenso(filas: RegistroCensoGuardado[]) {
  const total = filas.length;
  const mujeres = filas.filter((f) => f.sexo === "F").length;
  const hombres = filas.filter((f) => f.sexo === "M").length;
  const menores = filas.filter((f) => f.edad != null && f.edad < 18).length;
  const embarazadas = filas.filter((f) => f.embarazada).length;
  const discapacidad = filas.filter((f) => f.discapacidad).length;
  const enfermedad = filas.filter((f) => f.enfermedad).length;
  return { total, mujeres, hombres, menores, embarazadas, discapacidad, enfermedad };
}
