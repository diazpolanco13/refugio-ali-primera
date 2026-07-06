import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { ClipboardPaste, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  fotoUrl?: string;
  subiendo?: boolean;
  deshabilitado?: boolean;
  alt?: string;
  textoVacio?: string;
  onArchivo: (file: File) => void | Promise<void>;
  onQuitar?: () => void;
  className?: string;
}

function esImagen(file: File) {
  return file.type.startsWith("image/");
}

/** Windows a veces entrega archivos del portapapeles sin MIME type. */
function normalizarArchivoImagen(file: File): File | null {
  if (esImagen(file)) return file;
  if (file.size > 0 && (!file.type || file.type === "application/octet-stream")) {
    return new File([file], file.name || "pegado.png", { type: "image/png" });
  }
  return null;
}

function fileDesdeDataUrl(dataUrl: string): File | null {
  const match = dataUrl.trim().match(/^data:(image\/[\w.+-]+);base64,(.+)$/s);
  if (!match) return null;
  const [, mime, b64] = match;
  try {
    const binary = atob(b64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ext = mime.split("/")[1]?.replace("+xml", "") ?? "png";
    return new File([bytes], `pegado.${ext}`, { type: mime });
  } catch {
    return null;
  }
}

function fileDesdeHtml(html: string): File | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const src = doc.querySelector("img")?.getAttribute("src");
  if (!src?.startsWith("data:image/")) return null;
  return fileDesdeDataUrl(src);
}

function archivoDesdeDataTransfer(
  data: DataTransfer | ClipboardEvent["clipboardData"] | null,
): File | null {
  if (!data) return null;

  for (const file of data.files) {
    const normalizado = normalizarArchivoImagen(file);
    if (normalizado) return normalizado;
  }

  for (const item of data.items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (!file) continue;
    const normalizado = normalizarArchivoImagen(file);
    if (normalizado) return normalizado;
  }

  if ("getData" in data) {
    try {
      const html = data.getData("text/html");
      if (html) {
        const desdeHtml = fileDesdeHtml(html);
        if (desdeHtml) return desdeHtml;
      }
      const plain = data.getData("text/plain");
      if (plain?.startsWith("data:image/")) {
        const desdePlain = fileDesdeDataUrl(plain);
        if (desdePlain) return desdePlain;
      }
    } catch {
      // getData puede fallar fuera del evento paste.
    }
  }

  return null;
}

async function fileDesdeClipboardItem(item: ClipboardItem): Promise<File | null> {
  for (const type of item.types) {
    if (!type.startsWith("image/")) continue;
    try {
      const blob = await item.getType(type);
      const ext = type.split("/")[1]?.replace("+xml", "") ?? "png";
      return new File([blob], `pegado.${ext}`, { type });
    } catch {
      continue;
    }
  }

  if (item.types.includes("text/html")) {
    try {
      const blob = await item.getType("text/html");
      const html = await blob.text();
      const desdeHtml = fileDesdeHtml(html);
      if (desdeHtml) return desdeHtml;
    } catch {
      // ignorar
    }
  }

  if (item.types.includes("text/plain")) {
    try {
      const blob = await item.getType("text/plain");
      const text = await blob.text();
      if (text.startsWith("data:image/")) {
        const desdePlain = fileDesdeDataUrl(text);
        if (desdePlain) return desdePlain;
      }
    } catch {
      // ignorar
    }
  }

  return null;
}

async function leerImagenConClipboardApi(): Promise<File | null> {
  if (!navigator.clipboard?.read) return null;
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const file = await fileDesdeClipboardItem(item);
    if (file) return file;
  }
  return null;
}

/** Zona interactiva para subir imágenes: arrastrar, pegar (Ctrl+V) o seleccionar archivo. */
export function ZonaSubidaImagen({
  fotoUrl,
  subiendo = false,
  deshabilitado = false,
  alt = "Imagen",
  textoVacio = "Sin imagen",
  onArchivo,
  onQuitar,
  className,
}: Props) {
  const [arrastrando, setArrastrando] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const [esperandoPegado, setEsperandoPegado] = useState(false);
  const [pegando, setPegando] = useState(false);
  const [errorPegado, setErrorPegado] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pegadoRef = useRef<HTMLDivElement>(null);
  const esperaPegadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activa = !deshabilitado && !subiendo;

  function limpiarEsperaPegado() {
    if (esperaPegadoTimer.current) {
      clearTimeout(esperaPegadoTimer.current);
      esperaPegadoTimer.current = null;
    }
    setEsperandoPegado(false);
  }

  function procesarArchivo(file: File | null | undefined) {
    const normalizado = file ? normalizarArchivoImagen(file) : null;
    if (!normalizado || !activa) return false;
    limpiarEsperaPegado();
    setErrorPegado(null);
    void onArchivo(normalizado);
    return true;
  }

  function enfocarZonaPegado() {
    requestAnimationFrame(() => pegadoRef.current?.focus());
  }

  useEffect(
    () => () => {
      if (esperaPegadoTimer.current) clearTimeout(esperaPegadoTimer.current);
    },
    [],
  );

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    if (!activa) return;
    e.preventDefault();
    if (pegadoRef.current) pegadoRef.current.textContent = "";

    const file = archivoDesdeDataTransfer(e.clipboardData);
    if (procesarArchivo(file)) return;

    setErrorPegado(
      "No se detectó imagen al pegar. Prueba con una captura (Win+Shift+S) o copia la imagen desde el explorador de archivos.",
    );
  }

  async function pegarDesdePortapapeles() {
    if (!activa) return;
    setErrorPegado(null);
    setPegando(true);
    limpiarEsperaPegado();

    try {
      const file = await leerImagenConClipboardApi();
      if (procesarArchivo(file)) return;

      // En Windows muchas capturas solo están disponibles vía Ctrl+V, no vía Clipboard API.
      enfocarZonaPegado();
      setEsperandoPegado(true);
      esperaPegadoTimer.current = setTimeout(() => {
        setEsperandoPegado(false);
        setErrorPegado(
          "Pulsa Ctrl+V con la imagen copiada. Si ya lo hiciste, prueba «Seleccionar archivo» o arrastra la imagen.",
        );
      }, 12000);
    } catch {
      enfocarZonaPegado();
      setEsperandoPegado(true);
      esperaPegadoTimer.current = setTimeout(() => {
        setEsperandoPegado(false);
      }, 12000);
      setErrorPegado(null);
    } finally {
      setPegando(false);
    }
  }

  function onDragOver(e: DragEvent) {
    if (!activa) return;
    e.preventDefault();
    e.stopPropagation();
    setArrastrando(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setArrastrando(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setArrastrando(false);
    if (!activa) return;

    const file = e.dataTransfer.files[0] ?? archivoDesdeDataTransfer(e.dataTransfer);
    procesarArchivo(file);
  }

  if (deshabilitado && !fotoUrl) {
    return (
      <div
        className={cn(
          "flex h-36 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 text-xs text-muted-foreground",
          className,
        )}
      >
        {textoVacio}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border bg-muted/20 transition-colors",
          fotoUrl ? "border-border" : "border-dashed border-border/70",
          activa && "hover:border-primary/50 hover:bg-muted/30",
          (enfocado || esperandoPegado) && "border-primary ring-2 ring-primary/30",
          arrastrando && "border-primary bg-primary/10 ring-2 ring-primary/30",
        )}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {fotoUrl ? (
          <>
            <img src={fotoUrl} alt={alt} className="h-40 w-full object-cover" />
            {activa && (
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white opacity-0 transition-opacity",
                  (enfocado || arrastrando || esperandoPegado) && "opacity-100",
                )}
              >
                <Upload className="size-5" />
                <span className="text-xs font-medium">
                  {arrastrando
                    ? "Suelta la imagen"
                    : esperandoPegado
                      ? "Pulsa Ctrl+V ahora"
                      : "Arrastra o pega otra imagen"}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="pointer-events-none flex h-36 flex-col items-center justify-center gap-2 px-4 text-center">
            {subiendo ? (
              <>
                <Loader2 className="size-8 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Subiendo…</span>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full border border-border/80 bg-background/80 transition-colors",
                    arrastrando && "border-primary bg-primary/15 text-primary",
                  )}
                >
                  {arrastrando ? (
                    <Upload className="size-5" />
                  ) : (
                    <ImagePlus className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-foreground">
                    {arrastrando
                      ? "Suelta la imagen aquí"
                      : esperandoPegado
                        ? "Pulsa Ctrl+V para pegar"
                        : "Arrastra una imagen aquí"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {esperandoPegado
                      ? "La imagen se pegará en unos segundos…"
                      : enfocado
                        ? "Listo — pulsa Ctrl+V"
                        : "Haz clic aquí y usa Ctrl+V, o usa los botones"}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {subiendo && fotoUrl && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="size-7 animate-spin text-white" />
          </div>
        )}

        {activa && (
          <div
            ref={pegadoRef}
            contentEditable
            suppressContentEditableWarning
            tabIndex={0}
            role="textbox"
            aria-label="Zona para pegar imagen con Ctrl+V"
            onPaste={onPaste}
            onFocus={() => {
              setEnfocado(true);
              setErrorPegado(null);
            }}
            onBlur={() => setEnfocado(false)}
            className="absolute inset-0 z-10 cursor-pointer opacity-0 outline-none [caret-color:transparent]"
          />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={!activa}
        onChange={(e) => {
          procesarArchivo(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {activa && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-3.5" />
            Seleccionar archivo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pegando}
            onClick={() => void pegarDesdePortapapeles()}
          >
            {pegando ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ClipboardPaste className="size-3.5" />
            )}
            Pegar imagen
          </Button>
          {fotoUrl && onQuitar && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onQuitar}
            >
              <Trash2 className="size-3.5" />
              Quitar
            </Button>
          )}
        </div>
      )}

      {errorPegado && <p className="text-[11px] text-destructive">{errorPegado}</p>}
    </div>
  );
}
