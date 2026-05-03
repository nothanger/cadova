import { createBrowserRouter, RouterProvider } from "react-router";
import { PromoCadova } from "@/app/pages/PromoCadova";

function RouteErrorTiny() {
  return (
    <div
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        background: "#0B1020",
        color: "#E8EAFF",
        fontFamily: "Sora, system-ui, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 380 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Impossible de charger cette vue.</p>
        <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 16 }}>
          Recharge la page ou ouvre une URL promo&nbsp;: /promo ou /logo-animation
        </p>
        <a href="/promo" style={{ color: "#A5A6FF", fontWeight: 600 }}>
          Ouvrir /promo
        </a>
      </div>
    </div>
  );
}

function PromoStandaloneNotFound() {
  return (
    <div
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        background: "#0B1020",
        color: "#E8EAFF",
        fontFamily: "Sora, system-ui, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <p style={{ fontWeight: 600, marginBottom: 10 }}>Page introuvable</p>
        <p style={{ fontSize: 14, opacity: 0.76, marginBottom: 20, lineHeight: 1.5 }}>
          Le site Cadova complet nécessite la configuration Supabase/API. Seules les pages promo sont
          disponibles ici sans variables d&apos;environnement.
        </p>
        <p>
          <a href="/promo" style={{ color: "#A5A6FF", fontWeight: 600 }}>
            Ouvrir la page promo
          </a>
        </p>
      </div>
    </div>
  );
}

const router = createBrowserRouter(
  [
    {
      path: "/promo",
      Component: PromoCadova,
      errorElement: <RouteErrorTiny />,
    },
    {
      path: "/logo-animation",
      Component: PromoCadova,
      errorElement: <RouteErrorTiny />,
    },
    { path: "*", Component: PromoStandaloneNotFound },
  ],
  { basename: import.meta.env.BASE_URL },
);

/**
 * Shell minimal : aucun AuthProvider, aucune config Supabase.
 * Utilisé au bootstrap quand les clés manquent et que l’URL est une route promo.
 */
export default function PromoStandaloneApp() {
  return <RouterProvider router={router} />;
}
