import { Link, useRouteError } from "react-router";
import { CadovaLogo } from "./CadovaLogo";

export function RouteErrorFallback() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "";
  const blockedChunk =
    /failed to fetch dynamically imported module|loading chunk|import/i.test(message);

  return (
    <main className="cadova-route-fallback">
      <div className="cadova-route-fallback-card">
        <CadovaLogo width={82} />
        <div>
          <p className="cadova-kicker">Cadova</p>
          <h1>La page n’a pas pu se charger correctement.</h1>
          <p>
            {blockedChunk
              ? "Un bloqueur de contenu ou le réseau a interrompu le chargement d’une partie de l’interface."
              : "L’interface a rencontré un problème de rendu temporaire."}
          </p>
        </div>
        <div className="cadova-route-fallback-actions">
          <a href="/" className="cadova-button-primary">
            Recharger Cadova
          </a>
          <Link to="/pricing" className="cadova-button-secondary">
            Voir les formules
          </Link>
        </div>
      </div>
    </main>
  );
}
