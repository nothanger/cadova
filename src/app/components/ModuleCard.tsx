import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import type { CadovaModule } from "../lib/module-data";

export function ModuleCard({
  module,
  showPrice = true,
  compact = false,
}: {
  module: CadovaModule;
  showPrice?: boolean;
  compact?: boolean;
}) {
  const startingPrice = module.plans[0]?.priceMonthly ?? "";
  const applyInteractiveState = (element: HTMLAnchorElement) => {
    element.style.background = module.hoverBackground;
    element.style.borderColor = module.hoverBorder;
    element.style.boxShadow = "0 12px 28px rgba(20,15,38,0.08)";
    element.style.transform = "translateY(-2px)";
  };

  const resetInteractiveState = (element: HTMLAnchorElement) => {
    element.style.background = "white";
    element.style.borderColor = "rgba(20,15,38,0.08)";
    element.style.boxShadow = "none";
    element.style.transform = "translateY(0)";
  };

  return (
    <Link
      to={module.route}
      aria-label={`${module.name}, a partir de ${startingPrice}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        background: "white",
        borderRadius: 8,
        padding: compact ? 18 : 20,
        border: "1px solid rgba(20,15,38,0.08)",
        borderTop: `3px solid ${module.accentColor}`,
        cursor: "pointer",
        transition: "background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
        display: "block",
      }}
      onMouseEnter={(event) => {
        applyInteractiveState(event.currentTarget);
      }}
      onMouseLeave={(event) => {
        resetInteractiveState(event.currentTarget);
      }}
      onFocus={(event) => {
        applyInteractiveState(event.currentTarget);
      }}
      onBlur={(event) => {
        resetInteractiveState(event.currentTarget);
      }}
    >
      <module.icon size={18} style={{ color: module.accentColor }} />
      <div style={{ marginTop: 14, fontSize: compact ? 20 : 22, fontWeight: 700 }}>{module.name}</div>
      <div style={{ marginTop: 6, color: "#5f5874", lineHeight: 1.6 }}>{module.shortDescription}</div>
      {showPrice ? (
        <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ color: module.accentColor }}>{startingPrice}</strong>
          <span style={{ color: "#8e87a3", fontSize: 14 }}>{module.plans[0]?.priceNote}</span>
        </div>
      ) : null}
      <div
        style={{
          marginTop: 16,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          color: "#241d39",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        Voir le module
        <ArrowRight size={16} style={{ color: module.accentColor }} />
      </div>
    </Link>
  );
}
