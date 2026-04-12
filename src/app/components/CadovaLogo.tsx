import Image1 from "../../imports/Image1";

interface CadovaLogoProps {
  /** Largeur d'affichage en pixels */
  width?: number;
  /** Applique un filtre blanc (pour fond sombre) */
  white?: boolean;
}

// Canvas SVG natif du composant Figma
const CANVAS = { w: 1441, h: 1424 };

// Zone de contenu réelle : icône cerveau (y≈491) + texte "cadova" (bottom≈1015)
// x de 420 à 900, y de 488 à 1020
const CROP = { x: 418, y: 486, w: 488, h: 538 };

export function CadovaLogo({ width = 100, white = false }: CadovaLogoProps) {
  const scale = width / CROP.w;
  const height = Math.round(CROP.h * scale);

  return (
    <div
      style={{
        width,
        height,
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
        filter: white ? "brightness(0) invert(1)" : undefined,
      }}
      aria-label="Cadova"
    >
      <div
        style={{
          width: CANVAS.w,
          height: CANVAS.h,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          left: -Math.round(CROP.x * scale),
          top: -Math.round(CROP.y * scale),
        }}
      >
        <Image1 />
      </div>
    </div>
  );
}
