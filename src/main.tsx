
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";

function renderConfigError(message: string) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <div
        style={{
          minHeight: "100svh",
          display: "grid",
          placeItems: "center",
          background: "#f7f7f9",
          color: "#070716",
          fontFamily: "Sora, system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 720, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, marginBottom: 12, fontWeight: 700 }}>Configuration indisponible</h1>
          <p style={{ color: "#697085", marginBottom: 12 }}>
            Cadova ne peut pas demarrer pour le moment. Merci de reessayer dans quelques instants.
          </p>
          <p style={{ color: "#697085", fontSize: 13 }}>
            Si vous etes administrateur, verifiez les variables Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY et VITE_API_URL.
          </p>
        </div>
      </div>
    </React.StrictMode>,
  );
  console.error(message);
}

async function bootstrap() {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    renderConfigError("Missing required VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for production build.");
    return;
  }

  const { default: App } = await import("./app/App.tsx");
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap().catch((error) => {
  renderConfigError(`App bootstrap failed: ${String(error)}`);
});
