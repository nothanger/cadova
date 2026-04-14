interface CadovaLogoProps {
  width?: number;
  size?: "sm" | "md" | "lg" | number;
  white?: boolean;
}

const LOGO_SRC = "/cadova-logo.svg?v=20260414";
const LOGO_DIMENSIONS = { width: 392, height: 416 };
const SIZE_WIDTHS = {
  sm: 52,
  md: 76,
  lg: 112,
} as const;

function resolveWidth(width?: number, size?: CadovaLogoProps["size"]) {
  if (typeof width === "number") return width;
  if (typeof size === "number") return size;
  if (size) return SIZE_WIDTHS[size];
  return 100;
}

export function CadovaLogo({ width, size, white = false }: CadovaLogoProps) {
  const resolvedWidth = resolveWidth(width, size);
  const resolvedHeight = Math.round(
    (resolvedWidth * LOGO_DIMENSIONS.height) / LOGO_DIMENSIONS.width,
  );

  return (
    <img
      src={LOGO_SRC}
      alt="Cadova"
      width={resolvedWidth}
      height={resolvedHeight}
      draggable={false}
      style={{
        display: "block",
        width: resolvedWidth,
        height: resolvedHeight,
        flexShrink: 0,
        filter: white ? "brightness(0) invert(1)" : undefined,
      }}
    />
  );
}
