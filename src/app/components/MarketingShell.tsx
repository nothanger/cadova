import type { ReactNode } from "react";
import { useState } from "react";
import { Menu, X } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

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
          <button
            type="button"
            className="marketing-menu-toggle"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-controls="marketing-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <nav
            id="marketing-navigation"
            aria-label="Navigation principale"
            className={`marketing-nav${menuOpen ? " is-open" : ""}`}
          >
            <NavLink to="/modules" className={({ isActive }) => getNavClass(isActive)} onClick={closeMenu}>
              Modules
            </NavLink>
            <NavLink to="/pricing" className={({ isActive }) => getNavClass(isActive)} onClick={closeMenu}>
              nos formules
            </NavLink>
            <NavLink to="/login" className={({ isActive }) => getNavClass(isActive)} onClick={closeMenu}>
              Connexion
            </NavLink>
            <Link to={ctaHref} className="marketing-nav-cta" onClick={closeMenu}>
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
