import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { CadovaLogo } from "./CadovaLogo";

function getNavClass(isActive: boolean) {
  return `marketing-nav-link${isActive ? " is-active" : ""}`;
}

export function MarketingShell({
  children,
  ctaHref = "/signup",
  ctaLabel = "Commencer",
}: {
  children: ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="marketing-shell">
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      <header className="marketing-header">
        <div className="marketing-header-inner">
          <Link to="/" aria-label="Cadova - accueil" className="marketing-logo-link">
            <CadovaLogo width={82} />
          </Link>
          <nav aria-label="Navigation principale" className="marketing-nav">
            <NavLink to="/modules" className={({ isActive }) => getNavClass(isActive)}>
              Modules
            </NavLink>
            <NavLink to="/modules/comparaison" className={({ isActive }) => getNavClass(isActive)}>
              Comparer
            </NavLink>
            <NavLink to="/pricing" className={({ isActive }) => getNavClass(isActive)}>
              Pricing
            </NavLink>
            <NavLink to="/login" className={({ isActive }) => getNavClass(isActive)}>
              Connexion
            </NavLink>
            <Link to={ctaHref} className="marketing-nav-cta">
              {ctaLabel}
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className="marketing-main">
        {children}
      </main>
    </div>
  );
}
