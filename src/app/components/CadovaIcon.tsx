/**
 * Icône simplifiée de Cadova pour les favicons et app icons
 * Design moderne avec le cerveau stylisé et dégradé violet/indigo
 */
export function CadovaIcon({ size = 512 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Fond avec dégradé subtil */}
      <rect width="512" height="512" rx="115" fill="url(#bgGradient)" />

      {/* Cerveau simplifié - forme principale */}
      <g transform="translate(100, 80)">
        {/* Hémisphère gauche */}
        <path
          d="M 160 230 C 100 230 50 180 50 120 C 50 60 100 10 160 10 C 180 10 200 20 215 35"
          fill="url(#brainGradient1)"
          opacity="0.95"
        />

        {/* Hémisphère droit */}
        <path
          d="M 160 230 C 220 230 270 180 270 120 C 270 60 220 10 160 10 C 140 10 120 20 105 35"
          fill="url(#brainGradient2)"
          opacity="0.95"
        />

        {/* Détails du cerveau - circonvolutions */}
        <path
          d="M 110 80 Q 120 70 130 80 Q 140 90 150 80"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 170 80 Q 180 70 190 80 Q 200 90 210 80"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 100 130 Q 110 120 120 130 Q 130 140 140 130"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 180 130 Q 190 120 200 130 Q 210 140 220 130"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Point d'accent brillant */}
        <ellipse
          cx="160"
          cy="100"
          rx="40"
          ry="45"
          fill="url(#highlightGradient)"
          opacity="0.4"
        />
      </g>

      {/* Lettre "C" stylisée en bas */}
      <text
        x="256"
        y="440"
        fontFamily="Syne, sans-serif"
        fontSize="140"
        fontWeight="700"
        fill="url(#textGradient)"
        textAnchor="middle"
      >
        C
      </text>

      <defs>
        {/* Dégradé de fond */}
        <linearGradient id="bgGradient" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2B1430" />
          <stop offset="50%" stopColor="#4E1D58" />
          <stop offset="100%" stopColor="#34163A" />
        </linearGradient>

        {/* Dégradé cerveau gauche */}
        <linearGradient id="brainGradient1" x1="50" y1="10" x2="160" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B84DCE" />
          <stop offset="30%" stopColor="#AD49C2" />
          <stop offset="60%" stopColor="#9540A7" />
          <stop offset="100%" stopColor="#843E92" />
        </linearGradient>

        {/* Dégradé cerveau droit */}
        <linearGradient id="brainGradient2" x1="270" y1="10" x2="160" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B84DCE" />
          <stop offset="30%" stopColor="#A044B3" />
          <stop offset="60%" stopColor="#8C3C9D" />
          <stop offset="100%" stopColor="#672374" />
        </linearGradient>

        {/* Highlight brillant */}
        <radialGradient id="highlightGradient" cx="0.5" cy="0.3">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* Dégradé texte */}
        <linearGradient id="textGradient" x1="0" y1="380" x2="512" y2="440" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B74DCD" />
          <stop offset="50%" stopColor="#9540A7" />
          <stop offset="100%" stopColor="#B84DCE" />
        </linearGradient>
      </defs>
    </svg>
  );
}
