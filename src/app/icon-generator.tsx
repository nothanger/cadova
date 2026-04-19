import { Download, Lightbulb, MonitorSmartphone, Palette, Sparkles } from "lucide-react";
import { useRef } from "react";
import { CadovaIcon } from "./components/CadovaIcon";


export default function GenerateIcons() {
  const iconRefs = useRef<{ [key: number]: SVGSVGElement | null }>({});

  const icons = [
    { size: 180, title: "Apple Touch Icon", filename: "apple-touch-icon.png", desc: "Icône iOS pour écran d'accueil" },
    { size: 192, title: "Android Chrome 192", filename: "android-chrome-192x192.png", desc: "Icône Android standard" },
    { size: 512, title: "Android Chrome 512", filename: "android-chrome-512x512.png", desc: "Haute résolution / Maskable" }
  ];

  const downloadIcon = (size: number, filename: string) => {
    const svgElement = iconRefs.current[size];
    if (!svgElement) return;

    // Créer un canvas pour convertir SVG en PNG
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

     
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    img.src = url;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="mb-4 font-syne text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#B84DCE] to-[#9540A7]">
            <span className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-current" />
              Générateur d'icônes Cadova
            </span>
          </h1>
          <p className="text-lg text-gray-700">
            Créez les icônes de votre app en un clic pour iOS et Android
          </p>
        </div>

        <div className="mb-8 rounded-xl bg-white p-6 shadow-lg border border-indigo-100">
          <h2 className="mb-4 font-syne text-2xl font-semibold text-[#4E1D58]">
            <span className="flex items-center gap-2">
              <MonitorSmartphone className="w-5 h-5 text-current" />
              Instructions rapides
            </span>
          </h2>
          <ol className="space-y-3 text-gray-700">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#B84DCE] to-[#9540A7] font-bold text-white text-sm">1</span>
              <span>Cliquez sur le bouton <strong>"⬇️ Télécharger"</strong> sous chaque icône</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#B84DCE] to-[#9540A7] font-bold text-white text-sm">2</span>
              <span>Les fichiers PNG seront automatiquement téléchargés avec le bon nom</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#B84DCE] to-[#9540A7] font-bold text-white text-sm">3</span>
              <span>Placez tous les fichiers dans le dossier <code className="rounded bg-indigo-100 px-2 py-1 text-sm font-mono text-[#4E1D58]">/public</code></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#B84DCE] to-[#9540A7] font-bold text-white text-sm">4</span>
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <span>Sur iPhone : Safari → Bouton Partager → "Sur l'écran d'accueil"</span>
              </span>
            </li>
          </ol>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 mb-8">
          {icons.map(({ size, title, filename, desc }) => (
            <div key={size} className="rounded-xl bg-white p-6 shadow-lg border border-indigo-100 hover:shadow-xl transition-shadow">
              <h2 className="mb-4 font-syne text-2xl font-semibold text-gray-900">
                {title}
              </h2>

              <div className="mb-6 flex items-center justify-center rounded-lg bg-gradient-to-br from-gray-50 to-indigo-50 p-6">
                <div ref={(el) => {
                  if (el) {
                    const svg = el.querySelector('svg');
                    if (svg) iconRefs.current[size] = svg;
                  }
                }}>
                  <CadovaIcon size={size} />
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-600"><strong>Dimensions :</strong> {size}×{size}px</p>
                  <p className="text-gray-600"><strong>Usage :</strong> {desc}</p>
                </div>
                <div className="rounded-lg bg-indigo-50 p-3">
                  <p className="font-mono text-xs text-[#4E1D58] font-semibold">{filename}</p>
                </div>
              </div>

              <button
                onClick={() => downloadIcon(size, filename)}
                className="mt-4 w-full rounded-lg bg-gradient-to-r from-[#B84DCE] to-[#9540A7] px-6 py-3 font-semibold text-white shadow-md transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="flex items-center justify-center gap-2">
                  <Download className="w-5 h-5 text-current" />
                  <span>Télécharger</span>
                </span>
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-gradient-to-r from-yellow-50 to-orange-50 p-6 border-l-4 border-[#B84DCE]">
          <p className="text-gray-800">
            <strong className="text-[#4E1D58] inline-flex items-center gap-2"><Lightbulb className="w-5 h-5 text-current" />Astuce :</strong> Une fois les fichiers placés dans <code className="rounded bg-white px-2 py-1 text-sm font-mono">/public</code>,
            ajoutez également le fichier <code className="rounded bg-white px-2 py-1 text-sm font-mono">manifest.json</code> (déjà créé)
            pour que votre app se comporte comme une vraie application native !
          </p>
        </div>
      </div>
    </div>
  );
}
