import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";

function RouteLoadingFallback() {
  return (
    <div
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        background: "#f7f7f9",
        color: "#070716",
        fontFamily: "Sora, system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Chargement de Cadova</div>
        <div style={{ marginTop: 8, color: "#697085" }}>Encore une seconde.</div>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const existingFavicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    const favicon = existingFavicon ?? document.createElement("link");
    favicon.setAttribute("rel", "icon");
    favicon.setAttribute("type", "image/svg+xml");
    favicon.setAttribute("href", "/logo-app.svg");
    if (!existingFavicon) document.head.appendChild(favicon);

    const existingApple = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
    const apple = existingApple ?? document.createElement("link");
    apple.setAttribute("rel", "apple-touch-icon");
    apple.setAttribute("href", "/apple-touch-icon.png");
    if (!existingApple) document.head.appendChild(apple);

    const existingTheme = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
    if (!existingTheme) {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      meta.setAttribute("content", "#0B1020");
      document.head.appendChild(meta);
    }

    document.title = "Cadova - IA pour CV, entretiens et candidatures";
  }, []);

  return <RouterProvider router={router} fallbackElement={<RouteLoadingFallback />} />;
}
