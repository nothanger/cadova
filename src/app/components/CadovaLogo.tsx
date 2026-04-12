interface CadovaLogoProps {
  width?: number;
  white?: boolean;
}

export function CadovaLogo({ width = 100, white = false }: CadovaLogoProps) {
  return (
    <img
      src="/cadova-app-icon.svg?v=3"
      alt="Cadova"
      width={width}
      style={{
        height: "auto",
        display: "block",
        flexShrink: 0,
        filter: white ? "brightness(0) invert(1)" : undefined,
      }}
    />
  );
}
