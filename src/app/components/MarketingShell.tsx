import type { CSSProperties, ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { CadovaLogo } from "./CadovaLogo";

const shellStyles = {
  page: {
    background: "#f4f1ff",
    color: "#140f26",
    fontFamily: "DM Sans, system-ui, sans-serif",
    minHeight: "100vh",
  } satisfies CSSProperties,
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    backdropFilter: "blur(16px)",
    background: "rgba(244,241,255,0.88)",
    borderBottom: "1px solid rgba(20,15,38,0.08)",
  } satisfies CSSProperties,
  inner: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  } satisfies CSSProperties,
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  navLink: {
    color: "#5b5570",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
    padding: "8px 0",
    borderBottom: "2px solid transparent",
  } satisfies CSSProperties,
  cta: {
    textDecoration: "none",
    background: "#5548f5",
    color: "white",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 700,
  } satisfies CSSProperties,
};

function getNavLinkStyle(isActive: boolean): CSSProperties {
  return {
    ...shellStyles.navLink,
    color: isActive ? "#140f26" : shellStyles.navLink.color,
    borderBottomColor: isActive ? "#5548f5" : "transparent",
  };
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
    <div style={shellStyles.page}>
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      <header style={shellStyles.header}>
        <div style={shellStyles.inner}>
          <Link to="/" aria-label="Cadova - accueil" style={{ display: "inline-flex", alignItems: "center" }}>
            <CadovaLogo width={72} />
          </Link>
          <nav aria-label="Navigation principale" style={shellStyles.nav}>
            <NavLink to="/modules" style={({ isActive }) => getNavLinkStyle(isActive)}>
              Modules
            </NavLink>
            <NavLink to="/modules/comparaison" style={({ isActive }) => getNavLinkStyle(isActive)}>
              Comparer
            </NavLink>
            <NavLink to="/pricing" style={({ isActive }) => getNavLinkStyle(isActive)}>
              Pricing
            </NavLink>
            <NavLink to="/login" style={({ isActive }) => getNavLinkStyle(isActive)}>
              Connexion
            </NavLink>
            <Link to={ctaHref} style={shellStyles.cta}>
              {ctaLabel}
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content">{children}</main>
    </div>
  );
}
