import { RouterProvider } from "react-router";
import { router } from "./routes";
import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    // ── Favicon ──
    const existingFavicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    const favicon = existingFavicon ?? document.createElement("link");
    favicon.setAttribute("rel", "icon");
    favicon.setAttribute("type", "image/svg+xml");
    favicon.setAttribute("href", "/cadova-app-icon.svg?v=2");
    if (!existingFavicon) document.head.appendChild(favicon);

    // ── Apple touch icon (pour iOS "Ajouter à l'écran d'accueil") ──
    const existingApple = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
    if (!existingApple) {
      const apple = document.createElement("link");
      apple.setAttribute("rel", "apple-touch-icon");
      apple.setAttribute("href", "/cadova-apple-touch-icon.png");
      document.head.appendChild(apple);
    }

    // ── PWA theme color ──
    const existingTheme = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
    if (!existingTheme) {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      meta.setAttribute("content", "#0C0B1A");
      document.head.appendChild(meta);
    }

    // ── Title ──
    document.title = "Cadova — L'IA qui décuple tes chances d'embauche";
  }, []);

  return <RouterProvider router={router} />;
}
