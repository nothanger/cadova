/**
 * AuthGuard — Layout route de protection (pattern React Router Data Mode)
 *
 * Au lieu de wrapper chaque route avec <ProtectedRoute children={...}>,
 * on utilise le pattern natif React Router : une route parent qui
 * rend <Outlet /> si l'utilisateur est authentifié, ou redirige sinon.
 *
 * Avantages vs ProtectedRoute avec children :
 * - Pas de JSX dans routes.tsx (évite les problèmes de rendu React Router)
 * - Pattern idiomatique React Router v7 data mode
 * - Un seul point de contrôle pour toutes les routes enfants
 */

import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/contexts/AuthContext";

export function AuthGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // En cours d'initialisation → écran neutre (empêche le flash de contenu)
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#080719" }}
      >
        <div
          className="size-7 rounded-full border-2 animate-spin"
          style={{
            borderColor: "rgba(80,68,245,0.15)",
            borderTopColor: "#5044f5",
          }}
        />
      </div>
    );
  }

  // Pas d'utilisateur → redirect /login avec état pour retour post-login
  if (!user) {
    return (
      <Navigate to="/login" state={{ from: location }} replace />
    );
  }

  // Authentifié → rend la route enfant demandée
  return <Outlet />;
}
