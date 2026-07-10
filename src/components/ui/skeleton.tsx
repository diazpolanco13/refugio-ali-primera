import { cn } from "@/lib/utils"

type SkeletonVariant = "pulse" | "shimmer"

function Skeleton({
  className,
  variant = "shimmer",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: SkeletonVariant
}) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-muted",
        variant === "pulse" && "animate-pulse",
        variant === "shimmer" && "animate-skeleton-shimmer",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
export type { SkeletonVariant }
