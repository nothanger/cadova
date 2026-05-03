interface CadovaLogoProps {
  width?: number;
  maxHeight?: number;
  size?: "sm" | "md" | "lg" | number;
  white?: boolean;
}

const LOGO_LIGHT_SRC = "/logo-full.svg";
const LOGO_DARK_SRC = "/logo-dark.svg";
const LOGO_DIMENSIONS = {
  light: { width: 963, height: 261 },
  dark: { width: 713, height: 241 },
};
const SIZE_WIDTHS = {
  sm: 96,
  md: 132,
  lg: 180,
} as const;

function resolveWidth(width?: number, size?: CadovaLogoProps["size"]) {
  if (typeof width === "number") return width;
  if (typeof size === "number") return size;
  if (size) return SIZE_WIDTHS[size];
  return 100;
}

export function CadovaLogo({ width, maxHeight, size, white = false }: CadovaLogoProps) {
  const resolvedWidth = resolveWidth(width, size);
  const dimensions = white ? LOGO_DIMENSIONS.dark : LOGO_DIMENSIONS.light;
  const resolvedHeight = Math.round(
    (resolvedWidth * dimensions.height) / dimensions.width,
  );
  const constrainedHeight = maxHeight
    ? Math.min(resolvedHeight, maxHeight)
    : resolvedHeight;

  return (
    <img
      src={white ? LOGO_DARK_SRC : LOGO_LIGHT_SRC}
      alt="Cadova"
      width={resolvedWidth}
      height={constrainedHeight}
      draggable={false}
      style={{
        display: "block",
        width: resolvedWidth,
        height: "auto",
        maxWidth: "100%",
        maxHeight: constrainedHeight,
        objectFit: "contain",
        flexShrink: 0,
      }}
    />
  );
}
