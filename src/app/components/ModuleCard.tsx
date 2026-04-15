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

  return (
    <Link
      to={module.route}
      className="marketing-module-card"
      aria-label={`${module.name}, a partir de ${startingPrice}`}
      style={{
        borderColor: module.hoverBorder,
        background: `radial-gradient(circle at top right, ${module.hoverBackground}, transparent 35%), linear-gradient(180deg, #ffffff 0%, #fbfbfd 100%)`,
        padding: compact ? 18 : 22,
      }}
    >
      <span className="marketing-module-icon-wrap">
        <module.icon size={20} style={{ color: module.accentColor }} />
      </span>
      <h3 style={{ fontSize: compact ? 20 : 22 }}>{module.name}</h3>
      <p className="marketing-card-copy">{module.shortDescription}</p>
      {showPrice ? (
        <div className="marketing-price-line">
          <strong style={{ color: module.accentColor }}>{startingPrice}</strong>
          <span className="marketing-price-note">{module.plans[0]?.priceNote}</span>
        </div>
      ) : null}
      <div className="marketing-card-footer">
        <span>Voir le module</span>
        <ArrowRight size={18} style={{ color: module.accentColor }} />
      </div>
    </Link>
  );
}
