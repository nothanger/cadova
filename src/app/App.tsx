import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  useEffect(() => {
    const existingFavicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    const favicon = existingFavicon ?? document.createElement("link");
    favicon.setAttribute("rel", "icon");
    favicon.setAttribute("type", "image/svg+xml");
    favicon.setAttribute("href", "/favicon.svg?v=20260414");
    if (!existingFavicon) document.head.appendChild(favicon);

    const existingApple = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
    const apple = existingApple ?? document.createElement("link");
    apple.setAttribute("rel", "apple-touch-icon");
    apple.setAttribute("href", "/cadova-apple-touch-icon.png?v=20260414");
    if (!existingApple) document.head.appendChild(apple);

    const existingTheme = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
    if (!existingTheme) {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      meta.setAttribute("content", "#0C0B1A");
      document.head.appendChild(meta);
    }

    document.title = "Cadova — L'IA qui décuple tes chances d'embauche";
  }, []);

  return <RouterProvider router={router} />;
}
