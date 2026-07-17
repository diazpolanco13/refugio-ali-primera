/** Etiquetas y constantes de la BD de relaciones externas (Excel / MCP).
 *  Tabla: `censo_registros` con `origen = 'import_excel'`.
 *  No es censo nominal verificado ni “censo anterior”. */

export const LABEL_IMPORTACIONES_EXCEL = "Importaciones Excel";

export const DESC_IMPORTACIONES_EXCEL =
  "Personas de planillas externas (MCP). No verificadas por el censo nominal.";

export const LABEL_IMPORT_VERIFICADO =
  "Import Excel verificadas en nominal";

export type OrigenCensoRegistro = "terreno" | "import_excel";

export type CentroMatchImport =
  | ""
  | "exacto"
  | "alias"
  | "fuzzy"
  | "manual"
  | "forzado";
