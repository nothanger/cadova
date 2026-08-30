import fullLogo from "@/assets/cadova-logo.png?inline"
import mark from "@/assets/cadova-mark.png?inline"

export function CadovaLogo({
  variant = "full",
  className,
  alt = "Cadova",
}: {
  variant?: "full" | "mark"
  className?: string
  alt?: string
}) {
  return (
    <img
      src={variant === "full" ? fullLogo : mark}
      alt={alt}
      className={className}
      loading="eager"
      decoding="sync"
      fetchPriority="high"
      style={{ objectFit: "contain" }}
    />
  )
}
