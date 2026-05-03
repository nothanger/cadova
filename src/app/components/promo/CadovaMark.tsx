/**
 * Icône Cadova sans le mot « cadova » : le C protège / encadre l’utilisateur (rond animé séparément).
 * viewBox aligné sur public/logo-app.svg — ne pas étirer (object-fit / dimensions cohérentes).
 */

const C_PATH_APP =
  "M155.062 0.598545C133.614 3.06143 114.937 8.50032 95.542 18.1466C78.7123 26.4589 66.09 35.6947 50.7995 50.8825C36.2275 65.4546 26.5811 79.0005 17.5505 97.4722C-11.5936 157.197 -3.99972 227.595 37.0484 280.239C44.5397 289.783 60.8563 305.791 70.4 312.975C90.0005 327.65 116.374 339.246 140.182 343.864C152.804 346.224 172.61 347.353 185.951 346.326C225.254 343.453 259.837 328.163 288.263 301.379C306.427 284.139 307.966 260.125 291.957 243.706C277.693 229.031 253.475 228.826 237.774 243.193C235.927 244.938 231.001 251.403 226.896 257.662C213.042 278.7 196.213 291.425 174.457 297.274C162.758 300.455 143.158 300.558 130.433 297.377C111.346 292.656 90.6162 279.623 78.8149 264.949C45.258 223.49 49.3629 165.407 88.5638 127.848C99.0311 117.688 105.599 113.173 118.837 106.811C149.315 92.1359 185.13 92.8542 217.045 108.863C233.053 116.867 246.291 117.38 260.761 110.505C283.85 99.6272 292.778 71.304 280.566 47.3934C273.794 34.1554 248.549 17.1204 222.894 8.29507C204.114 1.93261 174.047 -1.45386 155.062 0.598545Z";

export const MARK_VIEWBOX_W = 400;
export const MARK_VIEWBOX_H = 400;

/** Centre du rond violet (après translate(65 47) scale(0.88)) dans la viewBox 400×400. */
export function markPurpleCenterFrac() {
  const gx = 65 + 0.88 * 163.528;
  const gy = 47 + 0.88 * 189.163;
  return { fx: gx / MARK_VIEWBOX_W, fy: gy / MARK_VIEWBOX_H };
}

export function CadovaMarkC({ className, cFill }: { className?: string; cFill: string }) {
  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX_W} ${MARK_VIEWBOX_H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <g transform="translate(65 47) scale(0.88)">
        <path d={C_PATH_APP} fill={cFill} />
      </g>
    </svg>
  );
}
