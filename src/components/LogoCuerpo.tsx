import { cn } from "@/lib/utils";

interface Props {
  src: string;
  /** Prioridad de carga: alta en mapa, baja en listas largas. */
  priority?: "high" | "low" | "auto";
  className?: string;
}

/** Logo de cuerpo policial optimizado (96×96 WebP). */
export function LogoCuerpo({ src, priority = "auto", className }: Props) {
  return (
    <img
      src={src}
      alt=""
      width={96}
      height={96}
      decoding="async"
      loading={priority === "high" ? "eager" : "lazy"}
      fetchPriority={priority === "high" ? "high" : priority === "low" ? "low" : undefined}
      className={cn("size-full object-cover", className)}
      draggable={false}
    />
  );
}
