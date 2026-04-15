import { Link } from "react-router";
import { CheckCircle2 } from "lucide-react";

export function PricingCard({
  title,
  price,
  note,
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
      <span className="marketing-pricing-badge" style={{ color: featured ? accentColor : undefined }}>
        {title}
      </span>
      <div className="marketing-price-line">
        <strong style={{ color: "#161426", fontSize: 38 }}>{price}</strong>
        <span className="marketing-price-note">{note}</span>
      </div>
      <p className="marketing-card-copy">{summary}</p>
      <div className="marketing-list" style={{ marginTop: 18 }}>
        {highlights.map((item) => (
          <div key={item} className="marketing-list-item" style={{ color: "#453f55" }}>
            <CheckCircle2 size={16} style={{ color: accentColor, marginTop: 3, flexShrink: 0 }} />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <Link to={ctaHref} className="marketing-button-primary" style={{ marginTop: 22, background: accentColor, boxShadow: "none" }}>
        {ctaLabel}
      </Link>
    </div>
  );
}
