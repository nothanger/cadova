import { Link } from "react-router";
import { CheckCircle2 } from "lucide-react";

export function PricingCard({
  title,
  price,
  note,
  badge,
  subtitle,
  summary,
  highlights,
  accentColor,
  ctaLabel,
  ctaHref,
  featured = false,
}: {
  title: string;
  price: string;
  note: string;
  badge?: string;
  subtitle?: string;
  summary: string;
  highlights: string[];
  accentColor: string;
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`marketing-pricing-card${featured ? " is-featured" : ""}`}
      style={{
        borderColor: featured ? `${accentColor}33` : "rgba(22,20,38,0.08)",
      }}
    >
      <div className="marketing-pricing-heading">
        {badge ? <span className="marketing-recommended-badge">{badge}</span> : null}
        <span className="marketing-pricing-badge" style={{ color: featured ? accentColor : undefined }}>
          {title}
        </span>
      </div>
      <div className="marketing-price-line">
        <strong>{price}</strong>
        <span className="marketing-price-note">{note}</span>
      </div>
      {subtitle ? <div className="marketing-pricing-subtitle">{subtitle}</div> : null}
      <p className="marketing-card-copy">{summary}</p>
      <div className="marketing-list" style={{ marginTop: 18 }}>
        {highlights.map((item) => (
          <div key={item} className="marketing-list-item" style={{ color: "#453f55" }}>
            <CheckCircle2 size={16} style={{ color: accentColor, marginTop: 3, flexShrink: 0 }} />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <Link
        to={ctaHref}
        className={featured ? "marketing-button-primary marketing-pricing-cta-featured" : "marketing-button-primary"}
        style={featured ? { marginTop: 22 } : { marginTop: 22, background: accentColor, boxShadow: "none" }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
