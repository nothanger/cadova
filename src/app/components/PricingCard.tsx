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
      style={{
        background: featured ? "linear-gradient(180deg, rgba(85,72,245,0.08) 0%, white 35%)" : "white",
        borderRadius: 8,
        border: `1px solid ${featured ? "rgba(85,72,245,0.2)" : "rgba(20,15,38,0.08)"}`,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: featured ? accentColor : "#8d86a2" }}>
        {title}
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: "#140f26" }}>{price}</div>
        <div style={{ color: "#8d86a2" }}>{note}</div>
      </div>
      <p style={{ marginTop: 14, marginBottom: 0, color: "#625b76", lineHeight: 1.7 }}>{summary}</p>
      <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
        {highlights.map((item) => (
          <div key={item} style={{ display: "flex", alignItems: "start", gap: 10, color: "#4f4764" }}>
            <CheckCircle2 size={16} style={{ color: accentColor, marginTop: 3 }} />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <Link
        to={ctaHref}
        style={{
          marginTop: 20,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 16px",
          borderRadius: 8,
          background: accentColor,
          color: "white",
          textDecoration: "none",
          fontWeight: 700,
        }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
