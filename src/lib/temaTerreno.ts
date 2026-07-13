// Tema (claro/oscuro) del dispositivo. El toggle vive en /terreno (en campo
// el modo claro ayuda a leer bajo el sol), pero la preferencia se aplica a
// TODA la app desde main.tsx: el operador que elige claro conserva el tema al
// pasar al reporte (/centros/reportes), al censo (/censo), etc. Se guarda en
// localStorage por dispositivo y se aplica quitando o poniendo la clase
// `dark` de <html> (mismo mecanismo que shadcn/Tailwind). Default: oscuro.

export type TemaTerreno = "claro" | "oscuro";

const TEMA_KEY = "terreno_tema_v1";

export function temaTerrenoGuardado(): TemaTerreno {
  try {
    return localStorage.getItem(TEMA_KEY) === "claro" ? "claro" : "oscuro";
  } catch {
    return "oscuro";
  }
}

export function aplicarTemaTerreno(tema: TemaTerreno): void {
  document.documentElement.classList.toggle("dark", tema === "oscuro");
  // Barra de estado del navegador/PWA acorde al fondo.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", tema === "claro" ? "#f7f6f3" : "#0a0a0a");
}

export function guardarTemaTerreno(tema: TemaTerreno): void {
  try {
    localStorage.setItem(TEMA_KEY, tema);
  } catch {
    /* ignorar: el tema aplica igual en esta carga */
  }
  aplicarTemaTerreno(tema);
}
