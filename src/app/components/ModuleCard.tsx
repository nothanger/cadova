import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import type { CadovaModule } from "../lib/module-data";

export function ModuleCard({
  module,
  compact = false,
}: {
  module: CadovaModule;
  compact?: boolean;
}) {
  return (
    <Link
      to={module.route}
      className="marketing-module-card"
      aria-label={module.name}
      style={{
        borderColor: module.hoverBorder,
        background: "linear-gradient(180deg, #ffffff 0%, #fbfbfd 100%)",
        padding: compact ? 18 : 22,
      }}
    >
      <span className="marketing-module-icon-wrap">
        <module.icon size={20} style={{ color: module.accentColor }} />
      </span>
      <h3 style={{ fontSize: compact ? 20 : 22 }}>{module.name}</h3>
      <p className="marketing-card-copy">{module.shortDescription}</p>
      <div className="marketing-card-footer">
        <span>Ouvrir</span>
        <ArrowRight size={18} style={{ color: module.accentColor }} />
      </div>
    </Link>
  );
}
